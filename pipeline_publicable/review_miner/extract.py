"""Mention extraction with protocol-driven cues.

The five mention-level cue families (exposure, dose, association,
speculative, negation) are now loaded from the protocol rather than baked
into module-level regex constants. The relations module reads the same
:class:`CueSet` to apply the ``strong_association`` family.
"""

from __future__ import annotations

from collections import defaultdict

from .protocol import CueSet, SectionConfig
from .schema import Article, LexiconEntity, Mention
from .sections import detect_sections, section_for_position
from .text import context_window, page_for_position, sentence_at


def extract_mentions(
    article: Article,
    entities: list[LexiconEntity],
    cues: CueSet,
    sections: SectionConfig,
    context_radius: int = 260,
) -> list[Mention]:
    """Find every dictionary mention in ``article.text``.

    For each match we:
      * estimate the section it falls in (using protocol-defined headers)
      * pull a context window of ``context_radius`` chars on each side
      * flag which cue families fire inside that context window

    Cues with empty pattern lists simply contribute ``False`` — protocols
    can disable a family by removing all of its patterns.

    Overlapping matches of the SAME entity (``\\bdementia\\b`` and
    ``\\bvascular dementia\\b`` both firing on "vascular dementia") describe
    one textual occurrence, so only the longest span at that position is
    kept: ``n_mentions`` is a reported metric and must not double-count.
    """

    spans = detect_sections(article.text, sections)
    mentions: list[Mention] = []
    for entity in entities:
        for start, end, matched_text in _dedupe_spans(entity, article.text):
            section = section_for_position(spans, start)
            sentence = sentence_at(article.text, start, end)
            context = context_window(article.text, start, end, radius=context_radius)
            mentions.append(
                Mention(
                    article_id=article.article_id,
                    source_path=article.source_path,
                    entity_type=entity.entity_type,
                    entity_id=entity.entity_id,
                    label_es=entity.label_es,
                    label_en=entity.label_en,
                    category=entity.category,
                    matched_text=matched_text,
                    section=section,
                    start=start,
                    end=end,
                    page=page_for_position(article.text, start, article.pages),
                    context=context,
                    sentence=sentence,
                    is_generic=entity.generic,
                    cue_exposure=cues.any_match("exposure", context),
                    cue_dose=cues.any_match("dose", context),
                    cue_association=cues.any_match("association", context),
                    cue_speculative=cues.any_match("speculative", context),
                    cue_negation=cues.any_match("negation", context),
                )
            )
    return sorted(mentions, key=lambda item: (item.start, item.entity_type, item.entity_id))


def _dedupe_spans(entity: LexiconEntity, text: str) -> list[tuple[int, int, str]]:
    """Non-overlapping spans of one entity, longest match wins.

    All patterns of the entity are matched first, then sorted by start and
    by decreasing length; a candidate is dropped when it intersects a span
    already accepted (the accepted span reaching furthest right is enough to
    test, because candidates are visited in ascending start order).
    """

    candidates: list[tuple[int, int, str]] = []
    for pattern in entity.patterns:
        for match in pattern.finditer(text):
            if match.end() > match.start():
                candidates.append((match.start(), match.end(), match.group(0)))
    candidates.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    accepted: list[tuple[int, int, str]] = []
    covered_until = -1
    for start, end, matched_text in candidates:
        if start < covered_until:
            continue
        accepted.append((start, end, matched_text))
        covered_until = max(covered_until, end)
    return accepted


def group_mentions_by_article_entity(
    mentions: list[Mention],
) -> dict[tuple[str, str, str], list[Mention]]:
    grouped: dict[tuple[str, str, str], list[Mention]] = defaultdict(list)
    for mention in mentions:
        grouped[(mention.article_id, mention.entity_type, mention.entity_id)].append(mention)
    return grouped
