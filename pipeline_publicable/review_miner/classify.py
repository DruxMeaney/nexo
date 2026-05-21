"""Role and study-kind classification.

Two responsibilities:

  * :func:`detect_article_kind` looks at the title and the first ~1800
    characters of the article body and uses the protocol's ``review``,
    ``human``, ``in_vivo`` and ``in_vitro`` cue families to label the
    article as one of: ``review_or_synthesis``, ``human_epidemiological``,
    ``experimental_in_vivo``, ``experimental_in_vitro``,
    ``experimental_preclinical`` or ``unclear``.

  * :func:`summarize_entity` aggregates every mention of a given entity
    inside one article into an :class:`EntitySummary`. The role assigned to
    the entity is one of seven generic IDs that apply equally to Variable A
    or Variable B — the human display label is resolved later by the UI /
    report layer from the protocol.
"""

from __future__ import annotations

from collections import Counter

from .protocol import CueSet, SectionConfig
from .schema import Article, EntitySummary, Mention
from .sections import CENTRAL_SECTIONS, INFORMATIVE_SECTIONS, section_weight


# --------------------------------------------------------------------------- #
# Stable role identifiers                                                     #
# --------------------------------------------------------------------------- #
#
# Same IDs for Variable A and B — the protocol-level UI maps them to human
# labels (and could translate "primary focus" to "exposición principal" or
# to "fármaco estudiado" depending on the domain). Internal code branches on
# these IDs, never on Spanish-specific strings.

ROLE_PRIMARY_FOCUS = "role_primary_focus"
ROLE_PROBABLE_FOCUS = "role_probable_focus"
ROLE_SECONDARY = "role_secondary_variable"
ROLE_INTRO_DISCUSSION = "role_intro_discussion_only"
ROLE_BIBLIOGRAPHIC = "role_bibliographic_only"
ROLE_REVIEW_MENTION = "role_review_mention"
ROLE_UNCLEAR = "role_unclear"

ARTICLE_KIND_REVIEW = "review_or_synthesis"
ARTICLE_KIND_HUMAN = "human_epidemiological"
ARTICLE_KIND_IN_VIVO = "experimental_in_vivo"
ARTICLE_KIND_IN_VITRO = "experimental_in_vitro"
ARTICLE_KIND_PRECLINICAL = "experimental_preclinical"
ARTICLE_KIND_UNCLEAR = "unclear"


# --------------------------------------------------------------------------- #
# Article kind                                                                #
# --------------------------------------------------------------------------- #


def detect_article_kind(article: Article, cues: CueSet) -> str:
    metadata = f"{article.title} {article.metadata_study_type}"
    haystack = f"{metadata} {article.text[:1800]}"
    if cues.any_match("review", haystack):
        return ARTICLE_KIND_REVIEW
    metadata_lower = metadata.lower()
    is_preclinical = any(
        kw in metadata_lower for kw in ("basic", "preclinical", "preclínico", "preclinico", "experimental", "in vivo", "in vitro")
    )
    if is_preclinical:
        if cues.any_match("in_vitro", haystack):
            return ARTICLE_KIND_IN_VITRO
        if cues.any_match("in_vivo", haystack):
            return ARTICLE_KIND_IN_VIVO
        return ARTICLE_KIND_PRECLINICAL
    if cues.any_match("in_vitro", haystack):
        return ARTICLE_KIND_IN_VITRO
    if cues.any_match("in_vivo", haystack):
        return ARTICLE_KIND_IN_VIVO
    epidem_markers = (
        "cohort",
        "case-control",
        "case control",
        "cross-sectional",
        "cross sectional",
        "longitudinal",
        "registry",
        "ecological",
        "cohorte",
        "caso-control",
        "caso control",
        "transversal",
        "epidemiológic",
        "epidemiologic",
        "observacional",
    )
    if cues.any_match("human", metadata) or any(marker in metadata_lower for marker in epidem_markers):
        return ARTICLE_KIND_HUMAN
    return ARTICLE_KIND_UNCLEAR


# --------------------------------------------------------------------------- #
# Mention scoring                                                             #
# --------------------------------------------------------------------------- #


def mention_score(mention: Mention, sections: SectionConfig) -> int:
    score = section_weight(mention.section, sections)
    if mention.cue_exposure:
        score += 4
    if mention.cue_dose:
        score += 5
    if mention.cue_association:
        score += 2
    if mention.cue_speculative:
        score -= 1
    if mention.cue_negation:
        score -= 2
    if mention.is_generic:
        score -= 1
    return score


def _confidence(score: int, central_count: int, direct_cues: int) -> str:
    if score >= 18 and central_count > 0 and direct_cues > 0:
        return "Alta"
    if score >= 8 and central_count > 0:
        return "Media"
    return "Baja"


def _study_context(article_kind: str, mentions: list[Mention], cues: CueSet) -> str:
    """Free-form Spanish label describing the experimental model.

    Mirrors the legacy behaviour but uses the protocol's cues for in-context
    detection instead of hardcoded patterns.
    """

    context_text = " ".join(m.context for m in mentions[:8])
    if article_kind == ARTICLE_KIND_HUMAN or cues.any_match("human", context_text):
        return "Analizado en poblacion humana o estudio epidemiologico"
    if article_kind == ARTICLE_KIND_IN_VITRO or cues.any_match("in_vitro", context_text):
        return "Usado en ensayos in vitro"
    if article_kind == ARTICLE_KIND_IN_VIVO or cues.any_match("in_vivo", context_text):
        return "Usado en ensayos in vivo"
    if article_kind == ARTICLE_KIND_REVIEW:
        return "Revision o sintesis; no estudio primario"
    return "No queda claro"


def _best_evidence(
    mentions: list[Mention],
    sections: SectionConfig,
    limit: int = 3,
) -> str:
    ordered = sorted(
        mentions,
        key=lambda item: (
            0 if item.section in CENTRAL_SECTIONS else 1,
            -int(item.cue_dose),
            -int(item.cue_exposure),
            -mention_score(item, sections),
        ),
    )
    return " || ".join(f"p.{m.page} [{m.section}] {m.context}" for m in ordered[:limit])


# --------------------------------------------------------------------------- #
# Role assignment                                                             #
# --------------------------------------------------------------------------- #


def _assign_role(
    article_kind: str,
    sections_count: Counter[str],
    n_mentions: int,
    score: int,
    central_count: int,
    informative_count: int,
    direct_cues: int,
    association_cues: int,
) -> tuple[str, str]:
    """Return ``(role_id, basis_id)`` using the same logic for A and B.

    Generic IDs let the report layer translate them once into the user's
    chosen labels per variable (e.g. "exposición principal" for A,
    "enfermedad estudiada" for B). The thresholds combine the previous
    contaminant-side strictness (score >= 16 with direct cues) and the
    disease-side flexibility (any direct/association cue is enough for a
    "probable focus") into a single ladder.
    """

    if article_kind == ARTICLE_KIND_REVIEW:
        return ROLE_REVIEW_MENTION, "extraccion_literal"
    if sections_count["references"] == n_mentions and n_mentions > 0:
        return ROLE_BIBLIOGRAPHIC, "extraccion_literal"
    if central_count > 0 and score >= 16 and direct_cues > 0:
        return ROLE_PRIMARY_FOCUS, "inferencia_contextual_con_evidencia_textual"
    if central_count > 0 and (direct_cues > 0 or association_cues > 0):
        return ROLE_PROBABLE_FOCUS, "inferencia_contextual_con_evidencia_textual"
    if central_count > 0 and score >= 8:
        return ROLE_SECONDARY, "inferencia_contextual_con_evidencia_textual"
    if informative_count > 0:
        return ROLE_INTRO_DISCUSSION, "extraccion_literal"
    return ROLE_UNCLEAR, "extraccion_literal"


def summarize_entity(
    article: Article,
    mentions: list[Mention],
    cues: CueSet,
    sections: SectionConfig,
) -> EntitySummary:
    counts = Counter(m.section for m in mentions)
    score = sum(mention_score(m, sections) for m in mentions)
    central_count = sum(counts[s] for s in CENTRAL_SECTIONS)
    informative_count = sum(counts[s] for s in INFORMATIVE_SECTIONS)
    direct_cues = sum(1 for m in mentions if m.cue_exposure or m.cue_dose)
    association_cues = sum(1 for m in mentions if m.cue_association)

    role, basis = _assign_role(
        article.article_kind,
        counts,
        n_mentions=len(mentions),
        score=score,
        central_count=central_count,
        informative_count=informative_count,
        direct_cues=direct_cues,
        association_cues=association_cues,
    )

    first = mentions[0]
    return EntitySummary(
        article_id=article.article_id,
        entity_type=first.entity_type,
        entity_id=first.entity_id,
        label_es=first.label_es,
        label_en=first.label_en,
        category=first.category,
        n_mentions=len(mentions),
        sections=dict(counts),
        role=role,
        study_context=_study_context(article.article_kind, mentions, cues),
        confidence=_confidence(score, central_count, direct_cues + association_cues),
        confidence_score=score,
        evidence_text=_best_evidence(mentions, sections),
        inference_basis=basis,
    )


# Re-export the role IDs as a public list so other modules (export, UI)
# can iterate them without re-declaring strings.
ROLE_IDS = (
    ROLE_PRIMARY_FOCUS,
    ROLE_PROBABLE_FOCUS,
    ROLE_SECONDARY,
    ROLE_INTRO_DISCUSSION,
    ROLE_BIBLIOGRAPHIC,
    ROLE_REVIEW_MENTION,
    ROLE_UNCLEAR,
)
