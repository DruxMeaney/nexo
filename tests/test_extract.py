"""Mention extraction invariants: one occurrence, one mention.

``n_mentions`` is a reported scientific metric — it appears in
``entity_summaries.csv``, in the systematic-review table and in every
frequency figure — so the rules that decide how a textual occurrence becomes
a :class:`Mention` are pinned here:

  * two patterns of the SAME entity firing on one occurrence yield one
    mention (double counting would inflate every published frequency);
  * two DIFFERENT entities firing on the same span keep their own mention;
  * the cue flags describe the mention's own context window, not the article;
  * ``context_radius`` is honoured verbatim;
  * the reported page is the page the mention physically sits on.

The tests build their lexicon and cues in memory, so they exercise
``extract_mentions`` alone and never touch the corpus or a protocol folder.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from review_miner.extract import extract_mentions
from review_miner.io import PAGE_SEPARATOR
from review_miner.protocol import CueSet, SectionConfig
from review_miner.schema import Article, LexiconEntity
from review_miner.text import normalize_space


def make_entity(
    entity_id: str,
    patterns: list[str],
    slot: str = "a",
    generic: bool = False,
) -> LexiconEntity:
    """A lexicon entity with its patterns already compiled, as the loader leaves them."""

    return LexiconEntity(
        entity_id=entity_id,
        label_es=f"{entity_id} es",
        label_en=f"{entity_id} en",
        category="categoria",
        entity_type=slot,
        generic=generic,
        patterns=tuple(re.compile(pattern, flags=re.IGNORECASE) for pattern in patterns),
    )


def make_article(text: str, pages: int = 1) -> Article:
    return Article(
        article_id="A01",
        source_path="A01.txt",
        title="Articulo de prueba",
        text=text,
        pages=pages,
        word_count=len(text.split()),
    )


def run_extract(
    text: str,
    entities: list[LexiconEntity],
    cues: CueSet | None = None,
    context_radius: int = 260,
    pages: int = 1,
):
    return extract_mentions(
        article=make_article(text, pages=pages),
        entities=entities,
        cues=cues or CueSet(),
        sections=SectionConfig(),
        context_radius=context_radius,
    )


# --------------------------------------------------------------------------- #
# One occurrence, one mention                                                 #
# --------------------------------------------------------------------------- #


def test_two_patterns_of_one_entity_on_one_occurrence_yield_one_mention():
    """``\\bdementia\\b`` and ``\\bvascular dementia\\b`` describe one occurrence."""

    text = "Methods\nWe followed 300 patients with vascular dementia for ten years.\n"
    entity = make_entity("dementia", [r"\bdementia\b", r"\bvascular dementia\b"])

    mentions = run_extract(text, [entity])

    assert len(mentions) == 1
    # The longest span wins, so the exported ``matched_text`` is the specific
    # form and not the substring shared with the generic pattern.
    assert mentions[0].matched_text == "vascular dementia"
    assert mentions[0].entity_id == "dementia"


def test_three_overlapping_patterns_still_yield_one_mention_per_occurrence():
    text = "Results\nEarly-onset vascular dementia was reported twice: vascular dementia again.\n"
    entity = make_entity(
        "dementia",
        [r"\bdementia\b", r"\bvascular dementia\b", r"\bonset vascular dementia\b"],
    )

    mentions = run_extract(text, [entity])

    assert len(mentions) == 2
    assert [m.matched_text for m in mentions] == ["onset vascular dementia", "vascular dementia"]


def test_two_different_entities_matching_the_same_span_each_keep_their_mention():
    """De-duplication is per entity: a shared span is two independent findings."""

    text = "Results\nBlood lead concentrations were measured in every participant.\n"
    specific = make_entity("lead", [r"\blead\b"])
    grouping = make_entity("heavy_metals", [r"\bblood lead\b"])

    mentions = run_extract(text, [specific, grouping])

    assert len(mentions) == 2
    assert {m.entity_id for m in mentions} == {"lead", "heavy_metals"}
    # Both really do sit on the same occurrence.
    assert len({m.start for m in mentions}) <= 2
    for mention in mentions:
        assert "lead" in mention.matched_text.lower()


def test_repeated_occurrences_are_counted_separately():
    text = "Results\nLead was measured. Later, lead was measured again in the same cohort.\n"
    entity = make_entity("lead", [r"\blead\b"])

    mentions = run_extract(text, [entity])

    assert len(mentions) == 2
    assert mentions[0].start < mentions[1].start


# --------------------------------------------------------------------------- #
# Cue flags follow the mention's own context window                           #
# --------------------------------------------------------------------------- #


def test_cue_flags_reflect_only_the_cues_inside_the_context_window():
    filler = "palabra " * 40  # ~320 characters, wider than the radius used below
    text = (
        "Results\n"
        "Occupational exposure to manganese was recorded. "
        f"{filler}"
        "Manganese was also present in the control samples.\n"
    )
    cues = CueSet(
        exposure=[re.compile(r"\bexposure\b", flags=re.IGNORECASE)],
        dose=[re.compile(r"\bmg/kg\b", flags=re.IGNORECASE)],
    )
    entity = make_entity("manganese", [r"\bmanganese\b"])

    near, far = run_extract(text, [entity], cues=cues, context_radius=60)

    assert near.cue_exposure is True
    assert far.cue_exposure is False
    # A family with no match anywhere stays False for every mention, and a
    # family with no patterns at all contributes nothing.
    assert (near.cue_dose, far.cue_dose) == (False, False)
    assert (near.cue_association, far.cue_association) == (False, False)


def test_a_cue_just_outside_the_radius_does_not_fire():
    """The window is the unit of evidence: one character decides the flag."""

    entity = make_entity("plomo", [r"\bplomo\b"])
    cues = CueSet(negation=[re.compile(r"\bno se asocio\b", flags=re.IGNORECASE)])
    gap = "x" * 30
    text = f"Resultados\nEl plomo {gap} no se asocio con el desenlace.\n"
    distance = text.index("no se asocio") - (text.index("plomo") + len("plomo"))

    inside = run_extract(text, [entity], cues=cues, context_radius=distance + 12)
    outside = run_extract(text, [entity], cues=cues, context_radius=distance - 1)

    assert inside[0].cue_negation is True
    assert outside[0].cue_negation is False


# --------------------------------------------------------------------------- #
# context_radius                                                              #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("radius", [10, 45, 260])
def test_context_is_exactly_the_requested_radius_on_each_side(radius):
    text = "Results\n" + ("a" * 200) + " cadmium " + ("b" * 200) + "\n"
    entity = make_entity("cadmium", [r"\bcadmium\b"])

    mention = run_extract(text, [entity], context_radius=radius)[0]

    expected = normalize_space(
        text[max(0, mention.start - radius) : min(len(text), mention.end + radius)]
    )
    assert mention.context == expected


def test_a_distant_token_enters_the_context_only_at_the_larger_radius():
    text = "Results\nIZQUIERDA " + ("z " * 40) + "cadmio " + ("y " * 40) + "DERECHA\n"
    entity = make_entity("cadmio", [r"\bcadmio\b"])

    narrow = run_extract(text, [entity], context_radius=20)[0]
    wide = run_extract(text, [entity], context_radius=400)[0]

    assert "IZQUIERDA" not in narrow.context
    assert "DERECHA" not in narrow.context
    assert "IZQUIERDA" in wide.context
    assert "DERECHA" in wide.context


# --------------------------------------------------------------------------- #
# Page numbers                                                                #
# --------------------------------------------------------------------------- #


def build_paged_text(pages: list[str]) -> str:
    """Join page bodies with the same marker ``io.extract_pdf`` writes."""

    return PAGE_SEPARATOR.join(pages)


def test_reported_page_is_the_page_the_mention_sits_on():
    pages = [
        "Abstract\nEste estudio evalua la exposicion ambiental.",
        "Methods\nSe midieron concentraciones de cadmio en sangre.",
        "Results\nEl plomo se asocio con el desenlace estudiado.",
        "References\nAutor A. Cadmio y salud. Revista, 2019.",
    ]
    text = build_paged_text(pages)
    entities = [make_entity("plomo", [r"\bplomo\b"]), make_entity("cadmio", [r"\bcadmio\b"])]

    mentions = run_extract(text, entities, pages=len(pages))
    by_page = {}
    for mention in mentions:
        by_page.setdefault(mention.matched_text.lower(), []).append(mention.page)

    # "cadmio" appears on page 2 (methods) and page 4 (references); "plomo"
    # only on page 3. Any off-by-one in the form-feed count moves all three.
    assert by_page["cadmio"] == [2, 4]
    assert by_page["plomo"] == [3]


def test_page_never_exceeds_the_declared_page_count():
    text = build_paged_text(["uno plomo", "dos", "tres plomo"])
    entity = make_entity("plomo", [r"\bplomo\b"])

    mentions = run_extract(text, [entity], pages=3)

    assert [m.page for m in mentions] == [1, 3]
    assert all(1 <= m.page <= 3 for m in mentions)


def test_single_page_source_without_markers_reports_page_one():
    text = "Abstract\nEl plomo fue medido en el agua potable de la region.\n"
    entity = make_entity("plomo", [r"\bplomo\b"])

    mentions = run_extract(text, [entity], pages=1)

    assert [m.page for m in mentions] == [1]
