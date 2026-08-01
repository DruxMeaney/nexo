"""Regression tests for mention scoring, the role ladder and article kind.

Three documented tables are pinned here:

  * the arithmetic of :func:`review_miner.classify.mention_score` — section
    weight plus the fixed cue bonuses and penalties;
  * the seven-step role ladder, with one minimal input per role, so an
    unreachable branch (a defect the audit hunted specifically) fails the
    suite instead of hiding in production;
  * the Alta/Media/Baja confidence thresholds and the six article kinds.

The reference-list rule gets its own tests: a bibliography hit proves the
entity is *cited*, not *studied*, so it must not feed the score or the cue
counters while still counting as a mention.
"""

from __future__ import annotations

import pytest

from review_miner.classify import (
    ARTICLE_KIND_HUMAN,
    ARTICLE_KIND_IN_VITRO,
    ARTICLE_KIND_IN_VIVO,
    ARTICLE_KIND_PRECLINICAL,
    ARTICLE_KIND_REVIEW,
    ARTICLE_KIND_UNCLEAR,
    ROLE_BIBLIOGRAPHIC,
    ROLE_IDS,
    ROLE_INTRO_DISCUSSION,
    ROLE_PRIMARY_FOCUS,
    ROLE_PROBABLE_FOCUS,
    ROLE_REVIEW_MENTION,
    ROLE_SECONDARY,
    ROLE_UNCLEAR,
    detect_article_kind,
    mention_score,
    summarize_entity,
)
from review_miner.sections import TERMINAL_SECTION


# --------------------------------------------------------------------------- #
# mention_score: the exact documented arithmetic                              #
# --------------------------------------------------------------------------- #
#
# section weight  +4 exposure  +5 dose  +2 association  -1 speculative
#                 -2 negation  -1 generic

SCORE_CASES = [
    # (label, section, flags, expected)
    ("methods sin señales", "methods", {}, 6),
    ("results sin señales", "results", {}, 5),
    ("abstract sin señales", "abstract", {}, 4),
    ("title sin señales", "title", {}, 5),
    ("discussion sin señales", "discussion", {}, 2),
    ("conclusion sin señales", "conclusion", {}, 2),
    ("introduction sin señales", "introduction", {}, 1),
    ("references sin señales", TERMINAL_SECTION, {}, -3),
    ("other sin señales", "other", {}, 1),
    ("exposure +4", "results", {"cue_exposure": True}, 9),
    ("dose +5", "results", {"cue_dose": True}, 10),
    ("association +2", "results", {"cue_association": True}, 7),
    ("speculative -1", "results", {"cue_speculative": True}, 4),
    ("negation -2", "results", {"cue_negation": True}, 3),
    ("generic -1", "results", {"is_generic": True}, 4),
    (
        "todas las señales sobre methods",
        "methods",
        {
            "cue_exposure": True,
            "cue_dose": True,
            "cue_association": True,
            "cue_speculative": True,
            "cue_negation": True,
            "is_generic": True,
        },
        6 + 4 + 5 + 2 - 1 - 2 - 1,
    ),
    (
        "todas las señales sobre references",
        TERMINAL_SECTION,
        {
            "cue_exposure": True,
            "cue_dose": True,
            "cue_association": True,
            "cue_speculative": True,
            "cue_negation": True,
            "is_generic": True,
        },
        -3 + 4 + 5 + 2 - 1 - 2 - 1,
    ),
]


@pytest.mark.parametrize(
    ("section", "flags", "expected"),
    [pytest.param(case[1], case[2], case[3], id=case[0]) for case in SCORE_CASES],
)
def test_mention_score_arithmetic(build_mention, protocol, section, flags, expected):
    assert mention_score(build_mention(section, **flags), protocol.sections) == expected


def test_mention_score_is_additive_over_the_cue_bonuses(build_mention, protocol):
    """Each cue contributes independently — no cue swallows another."""

    base = mention_score(build_mention("results"), protocol.sections)
    deltas = {
        "cue_exposure": 4,
        "cue_dose": 5,
        "cue_association": 2,
        "cue_speculative": -1,
        "cue_negation": -2,
        "is_generic": -1,
    }
    for flag, delta in deltas.items():
        assert mention_score(build_mention("results", **{flag: True}), protocol.sections) == base + delta

    every_flag = {flag: True for flag in deltas}
    assert (
        mention_score(build_mention("results", **every_flag), protocol.sections)
        == base + sum(deltas.values())
    )


# --------------------------------------------------------------------------- #
# The role ladder: every one of the seven ids must be reachable               #
# --------------------------------------------------------------------------- #


def _mentions_for_role(build_mention, role: str) -> list:
    """Minimal mention set that lands an entity on ``role``."""

    if role in (ROLE_REVIEW_MENTION,):
        return [build_mention("methods")]
    if role == ROLE_BIBLIOGRAPHIC:
        return [build_mention(TERMINAL_SECTION), build_mention(TERMINAL_SECTION)]
    if role == ROLE_PRIMARY_FOCUS:
        # 2 x (6 + 4 + 5) = 30 >= 16, con señal directa y sección central.
        flags = {"cue_exposure": True, "cue_dose": True}
        return [build_mention("methods", **flags), build_mention("methods", **flags)]
    if role == ROLE_PROBABLE_FOCUS:
        # 5 + 2 = 7 < 16: sección central y señal de asociación, sin señal directa.
        return [build_mention("results", cue_association=True)]
    if role == ROLE_SECONDARY:
        # 6 + 6 = 12 >= 8, sección central, sin ninguna señal.
        return [build_mention("methods"), build_mention("methods")]
    if role == ROLE_INTRO_DISCUSSION:
        return [build_mention("introduction")]
    if role == ROLE_UNCLEAR:
        return [build_mention("other")]
    raise AssertionError(f"rol sin caso mínimo: {role}")


@pytest.mark.parametrize("role", ROLE_IDS)
def test_every_role_id_is_reachable(build_article, build_mention, protocol, role):
    """One minimal input per role id — an unreachable branch is a defect."""

    article = build_article("Texto de prueba.", detect_kind=False)
    article.article_kind = (
        ARTICLE_KIND_REVIEW if role == ROLE_REVIEW_MENTION else ARTICLE_KIND_HUMAN
    )
    mentions = _mentions_for_role(build_mention, role)

    summary = summarize_entity(article, mentions, protocol.cues, protocol.sections)

    assert summary.role == role


def test_the_role_cases_cover_the_whole_ladder(build_article, build_mention, protocol):
    """The parametrised cases above must together produce all seven roles."""

    article = build_article("Texto de prueba.", detect_kind=False)
    produced = set()
    for role in ROLE_IDS:
        article.article_kind = (
            ARTICLE_KIND_REVIEW if role == ROLE_REVIEW_MENTION else ARTICLE_KIND_HUMAN
        )
        summary = summarize_entity(
            article, _mentions_for_role(build_mention, role), protocol.cues, protocol.sections
        )
        produced.add(summary.role)

    assert produced == set(ROLE_IDS)


def test_a_review_article_forces_the_review_role_for_every_entity(
    build_article, build_mention, protocol
):
    """In a review, even a high-scoring central entity stays a review mention."""

    article = build_article("Texto de prueba.", detect_kind=False)
    article.article_kind = ARTICLE_KIND_REVIEW
    strong = [build_mention("methods", cue_exposure=True, cue_dose=True)] * 3

    summary = summarize_entity(article, strong, protocol.cues, protocol.sections)

    assert summary.role == ROLE_REVIEW_MENTION
    assert summary.inference_basis == "extraccion_literal"


# --------------------------------------------------------------------------- #
# Reference-list mentions                                                     #
# --------------------------------------------------------------------------- #


def test_reference_mentions_do_not_inflate_the_score_or_the_cue_counts(
    build_article, build_mention, protocol
):
    """A bibliography hit is evidence of citation, never of study.

    Two plain Methods mentions (6 + 6 = 12) plus three reference-list
    mentions carrying exposure and dose cues. If the reference mentions fed
    the aggregate the score would be 12 + 3 * (-3 + 4 + 5) = 30 with three
    direct cues, which is `role_primary_focus` / `Alta` — the promotion the
    audit found. They must still be counted as mentions.
    """

    article = build_article("Texto de prueba.", detect_kind=False)
    article.article_kind = ARTICLE_KIND_HUMAN
    cited = {"cue_exposure": True, "cue_dose": True}
    mentions = [
        build_mention("methods"),
        build_mention("methods"),
        build_mention(TERMINAL_SECTION, **cited),
        build_mention(TERMINAL_SECTION, **cited),
        build_mention(TERMINAL_SECTION, **cited),
    ]

    summary = summarize_entity(article, mentions, protocol.cues, protocol.sections)

    assert summary.confidence_score == 12
    assert summary.role == ROLE_SECONDARY
    assert summary.confidence == "Media"
    # ...but the bibliography hits are still reported.
    assert summary.n_mentions == 5
    assert summary.sections[TERMINAL_SECTION] == 3


def test_a_bibliography_only_entity_keeps_the_bibliographic_role(
    build_article, build_mention, protocol
):
    """Cues inside the bibliography must not lift the entity out of the role."""

    article = build_article("Texto de prueba.", detect_kind=False)
    article.article_kind = ARTICLE_KIND_HUMAN
    mentions = [
        build_mention(TERMINAL_SECTION, cue_exposure=True, cue_dose=True, cue_association=True)
        for _ in range(4)
    ]

    summary = summarize_entity(article, mentions, protocol.cues, protocol.sections)

    assert summary.role == ROLE_BIBLIOGRAPHIC
    assert summary.confidence_score == 0
    assert summary.confidence == "Baja"
    assert summary.n_mentions == 4


# --------------------------------------------------------------------------- #
# Confidence tiers                                                            #
# --------------------------------------------------------------------------- #
#
# Alta: score >= 18 AND una sección central AND alguna señal (directa o de
#       asociación). Media: score >= 8 AND una sección central. Baja: resto.

CONFIDENCE_CASES = [
    (
        "18 con sección central y señal -> Alta",
        [("results", {"cue_association": True}), ("results", {}), ("results", {}), ("introduction", {})],
        18,
        "Alta",
    ),
    (
        "17 se queda en Media",
        [("results", {"cue_association": True}), ("results", {}), ("results", {})],
        17,
        "Media",
    ),
    (
        "18 sin ninguna señal se queda en Media",
        [("methods", {}), ("methods", {}), ("methods", {})],
        18,
        "Media",
    ),
    ("8 con sección central -> Media", [("results", {}), ("discussion", {}), ("introduction", {})], 8, "Media"),
    ("7 con sección central -> Baja", [("results", {}), ("discussion", {})], 7, "Baja"),
    ("sin sección central nunca supera Baja", [("introduction", {})] * 20, 20, "Baja"),
]


@pytest.mark.parametrize(
    ("sections", "expected_score", "expected_confidence"),
    [pytest.param(case[1], case[2], case[3], id=case[0]) for case in CONFIDENCE_CASES],
)
def test_confidence_tiers_fire_at_the_documented_thresholds(
    build_article, build_mention, protocol, sections, expected_score, expected_confidence
):
    article = build_article("Texto de prueba.", detect_kind=False)
    article.article_kind = ARTICLE_KIND_HUMAN
    mentions = [build_mention(name, **flags) for name, flags in sections]

    summary = summarize_entity(article, mentions, protocol.cues, protocol.sections)

    assert summary.confidence_score == expected_score
    assert summary.confidence == expected_confidence


# --------------------------------------------------------------------------- #
# Article kind                                                                #
# --------------------------------------------------------------------------- #


KIND_CASES = [
    (
        ARTICLE_KIND_REVIEW,
        "Systematic review of arsenic exposure and Parkinson disease",
        "We screened 214 records published between 2000 and 2022 and summarised the evidence.",
        "",
    ),
    (
        ARTICLE_KIND_HUMAN,
        "Lead exposure in a cohort of older adults followed for eight years",
        "Blood samples were drawn at baseline and cognition was assessed every year.",
        "",
    ),
    (
        ARTICLE_KIND_IN_VIVO,
        "Neurotoxicity of cadmium in the developing brain",
        "Pregnant mice received the metal in the drinking water throughout gestation.",
        "",
    ),
    (
        ARTICLE_KIND_IN_VITRO,
        "Cadmium toxicity in neuronal cell lines",
        "Differentiated cells were treated for twenty four hours before the viability assay.",
        "",
    ),
    (
        ARTICLE_KIND_PRECLINICAL,
        "Experimental assessment of lead neurotoxicity in banked brain tissue",
        "Frozen samples obtained from the national brain bank were homogenised and analysed.",
        "",
    ),
    (
        ARTICLE_KIND_UNCLEAR,
        "Trace metal monitoring in rural drinking water supplies",
        "Water was sampled twice per year and the results were archived by the authority.",
        "",
    ),
    (
        ARTICLE_KIND_HUMAN,
        "Arsenic in groundwater of the northern basin",
        "Wells were sampled in every village of the district during two dry seasons.",
        "Cohort study",
    ),
    # Un artículo mixto dispara las dos familias; el orden documentado da
    # prioridad a in vitro sobre in vivo, por la vía general...
    (
        ARTICLE_KIND_IN_VITRO,
        "Cadmium neurotoxicity in primary neurons",
        "Primary neurons isolated from mice were cultured for seven days before exposure.",
        "",
    ),
    # ...y también por la vía preclínica (el título trae "experimental").
    (
        ARTICLE_KIND_IN_VITRO,
        "Experimental neurotoxicity of cadmium in primary neurons",
        "Primary neurons isolated from mice were cultured for seven days before exposure.",
        "",
    ),
]


@pytest.mark.parametrize(
    ("expected_kind", "title", "body", "study_type"),
    [pytest.param(*case, id=f"{index}-{case[0]}") for index, case in enumerate(KIND_CASES)],
)
def test_detect_article_kind_returns_each_documented_kind(
    build_article, protocol, expected_kind, title, body, study_type
):
    article = build_article(
        f"{title}\n\n{body}\n",
        title=title,
        metadata_study_type=study_type,
        detect_kind=False,
    )

    assert detect_article_kind(article, protocol.cues) == expected_kind


def test_the_kind_cases_cover_every_documented_kind():
    assert {case[0] for case in KIND_CASES} == {
        ARTICLE_KIND_REVIEW,
        ARTICLE_KIND_HUMAN,
        ARTICLE_KIND_IN_VIVO,
        ARTICLE_KIND_IN_VITRO,
        ARTICLE_KIND_PRECLINICAL,
        ARTICLE_KIND_UNCLEAR,
    }


MIXED_MODEL_BODY = "Primary neurons isolated from mice were cultured for seven days before exposure."


@pytest.mark.parametrize(
    "title",
    ["Cadmium neurotoxicity in primary neurons", "Experimental neurotoxicity of cadmium"],
)
def test_in_vitro_wins_over_in_vivo_when_both_families_match(build_article, protocol, title):
    """An article citing both models is labelled by the documented order.

    Most experimental papers mention the animal the cells came from, so the
    two families match at once and only the order in `detect_article_kind`
    decides the label. The second title also carries "experimental", which
    routes the same decision through the preclinical branch.
    """

    assert protocol.cues.any_match("in_vitro", MIXED_MODEL_BODY)
    assert protocol.cues.any_match("in_vivo", MIXED_MODEL_BODY)
    article = build_article(f"{title}\n\n{MIXED_MODEL_BODY}\n", title=title, detect_kind=False)

    assert detect_article_kind(article, protocol.cues) == ARTICLE_KIND_IN_VITRO


def test_article_kind_of_every_fixture_article_is_stable(corpus):
    """Pins the kind the corpus resolves to, so a cue edit cannot drift it."""

    assert {article_id: art.article_kind for article_id, art in corpus.items()} == {
        "A1_imrad_completo_es": ARTICLE_KIND_HUMAN,
        "A2_encabezado_corrido_en": ARTICLE_KIND_HUMAN,
        "A3_falsos_encabezados_en": ARTICLE_KIND_UNCLEAR,
        "A4_referencias_en_tabla_es": ARTICLE_KIND_HUMAN,
        "A5_entidades_lejanas_en": ARTICLE_KIND_UNCLEAR,
        "A6_misma_seccion_en": ARTICLE_KIND_IN_VITRO,
    }
