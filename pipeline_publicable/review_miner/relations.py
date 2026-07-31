"""Build evidence-backed relations between Variable A and Variable B mentions.

A relation is emitted only when an A-mention and a B-mention share enough
local context (sentence overlap or within ``relation_distance`` characters)
to ground the association in a single quotable fragment. This keeps the
``Relation`` table strictly textual: every row carries the evidence string
the reviewer can re-read in the original article.

The fragment is built from the article text spanning *both* mentions, and
a row is emitted only if both matched forms are inside it. Every cue match
that decides the association label and the score is run on that joint span
alone, so a cue belonging to a neighbouring sentence about a different
variable can never label this pair.

The directionality (which slot ends up in ``entity_a_*`` vs ``entity_b_*``)
follows the protocol: ``"a"``-tagged mentions populate the A side and
``"b"``-tagged mentions populate the B side. The semantic meaning of A vs B
lives in the protocol's display labels.
"""

from __future__ import annotations

from collections import defaultdict

from .classify import mention_score
from .protocol import CueSet, SectionConfig
from .schema import Article, EntitySummary, Mention, Relation
from .sections import CENTRAL_SECTIONS
from .text import normalize_space


# Characters kept on each side of the joint span. Zero: the span already
# runs from the first entity to the last, so nothing extra is needed to
# make both readable, and any padding would let cue words that belong to a
# neighbouring sentence back into the fragment.
EVIDENCE_PAD = 0


def _contains_both(fragment: str, a: Mention, b: Mention) -> bool:
    """True when the fragment literally names both entities."""

    return (
        normalize_space(a.matched_text) in fragment
        and normalize_space(b.matched_text) in fragment
    )


def _overlap_context(text: str, a: Mention, b: Mention, max_span: int) -> str:
    """Return the fragment quoting both mentions, or ``""`` to drop the pair.

    Same-sentence pairs keep the whole sentence — the most readable quote,
    and it provably holds both entities. Every other pair gets the article
    text from the first mention's start to the last mention's end, so the
    fragment *is* the passage a reviewer must read to see both entities.
    Pairs whose joint span exceeds ``max_span`` (the protocol's
    ``relation_distance``) are dropped rather than quoted partially.

    The ``_contains_both`` guard is the invariant the exported
    ``evidence_text`` column claims; it also protects the same-sentence
    shortcut, which relies on two mentions resolving to the same sentence
    string.
    """

    if a.sentence and a.sentence == b.sentence and _contains_both(a.sentence, a, b):
        return a.sentence
    left = max(0, min(a.start, b.start) - EVIDENCE_PAD)
    right = min(len(text), max(a.end, b.end) + EVIDENCE_PAD)
    if right - left > max_span:
        return ""
    fragment = normalize_space(text[left:right])
    return fragment if _contains_both(fragment, a, b) else ""


def _evidence_section(a: Mention, b: Mention) -> str:
    """Section where the evidence fragment begins: the earlier mention's.

    Symmetric by construction — the fragment starts at whichever mention
    comes first in the article, so swapping the Variable-A and Variable-B
    slots cannot change the label, and the exported ``section`` describes
    where the quoted text lives instead of which slot the protocol author
    happened to fill first. Mentions starting at the same offset tie-break
    by section name so the result stays deterministic.
    """

    return min((a.start, a.section), (b.start, b.section))[1]


def _relation_confidence(score: int, section: str, association: str) -> str:
    if association == "asociacion_fuerte" and section in CENTRAL_SECTIONS and score >= 12:
        return "Alta"
    if association in {"asociacion_fuerte", "asociacion_debil"} and score >= 6:
        return "Media"
    return "Baja"


def _association_label(evidence: str, section: str, cues: CueSet) -> str:
    if not evidence:
        return "sin_evidencia_suficiente"
    if cues.any_match("negation", evidence):
        return "sin_evidencia_suficiente"
    has_strong = cues.any_match("strong_association", evidence)
    has_speculative = cues.any_match("speculative", evidence)
    if has_strong and not has_speculative:
        return "asociacion_fuerte" if section in CENTRAL_SECTIONS else "asociacion_debil"
    if cues.any_match("association", evidence):
        return "asociacion_debil"
    if has_speculative:
        return "mencion_especulativa"
    return "sin_evidencia_suficiente"


def build_relations(
    article: Article,
    mentions_a: list[Mention],
    mentions_b: list[Mention],
    summaries: dict[tuple[str, str], EntitySummary],
    cues: CueSet,
    sections: SectionConfig,
    relation_distance: int = 900,
) -> list[Relation]:
    """Pair every A-mention with every B-mention in the same article.

    Pairs that are too far apart and live in different sentences are
    discarded, as are pairs whose joint evidence span does not quote both
    entities. The surviving pairs are scored using ``mention_score`` plus
    bonus points when association or strong-association cues appear in the
    shared evidence; the best-scoring pair per ``(entity_a, entity_b)`` is
    kept.
    """

    candidates: dict[tuple[str, str], list[tuple[int, str, str]]] = defaultdict(list)
    for a in mentions_a:
        for b in mentions_b:
            if abs(a.start - b.start) > relation_distance and a.sentence != b.sentence:
                continue
            evidence = _overlap_context(article.text, a, b, relation_distance)
            if not evidence:
                continue
            section = _evidence_section(a, b)
            score = mention_score(a, sections) + mention_score(b, sections)
            if cues.any_match("association", evidence):
                score += 4
            if cues.any_match("strong_association", evidence):
                score += 4
            if cues.any_match("speculative", evidence):
                score -= 2
            if cues.any_match("negation", evidence):
                score -= 4
            candidates[(a.entity_id, b.entity_id)].append((score, section, evidence))

    by_id_a = {m.entity_id: m for m in mentions_a}
    by_id_b = {m.entity_id: m for m in mentions_b}
    relations: list[Relation] = []
    for (id_a, id_b), evidence_items in candidates.items():
        score, section, evidence = max(evidence_items, key=lambda item: item[0])
        a = by_id_a[id_a]
        b = by_id_b[id_b]
        association = _association_label(evidence, section, cues)
        summary_a = summaries.get(("a", id_a))
        relations.append(
            Relation(
                article_id=article.article_id,
                entity_a_id=id_a,
                entity_a_label=a.label_es or a.label_en,
                entity_a_category=a.category,
                entity_b_id=id_b,
                entity_b_label=b.label_es or b.label_en,
                entity_b_category=b.category,
                association=association,
                confidence=_relation_confidence(score, section, association),
                confidence_score=score,
                section=section,
                evidence_text=evidence,
                extraction_or_inference="inferencia_contextual_con_evidencia_textual",
                study_context=summary_a.study_context if summary_a else article.article_kind,
            )
        )
    return relations
