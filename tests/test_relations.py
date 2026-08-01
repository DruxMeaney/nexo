"""Regression tests for the Variable-A x Variable-B relation table.

The headline guarantee is the first test in this file: **every** exported
relation quotes a fragment that literally names both entities. The audit
measured 485 of 936 published rows (51.8%) failing that promise — including
37 of the 149 flagship `asociacion_fuerte`/`Alta` rows — because the
evidence used to be one mention's own context window, which provably cannot
reach the other entity once they are further apart than the context radius.

The rest of the file pins the window (`relation_distance`, honoured above
the old hardcoded 699 cap), the one-row-per-entity-pair rule, the four
association labels and the symmetry of the A/B slots.
"""

from __future__ import annotations

import pytest

from review_miner.relations import _overlap_context, build_relations
from review_miner.text import normalize_space


# Same-sentence pairs quote the sentence; every other pair quotes the article
# text spanning both mentions. Either way both matched forms must be inside.
def _matched_forms(mentions, entity_id: str) -> set[str]:
    return {normalize_space(m.matched_text) for m in mentions if m.entity_id == entity_id}


# --------------------------------------------------------------------------- #
# The headline guarantee                                                      #
# --------------------------------------------------------------------------- #


def test_every_relation_quotes_both_entities(corpus, mentions_of, relations_of):
    """No exported relation may rest on evidence missing one of its entities.

    Asserted over the whole fixture corpus, which contains same-sentence
    pairs, a cross-sentence pair inside one section, and a pair separated by
    more than the context radius — the exact shape that used to produce
    unverifiable rows.
    """

    checked = 0
    for article in corpus.values():
        mentions = mentions_of(article)
        mentions_a = [m for m in mentions if m.entity_type == "a"]
        mentions_b = [m for m in mentions if m.entity_type == "b"]
        for relation in relations_of(article):
            evidence = relation.evidence_text
            assert evidence, f"{article.article_id}: relación sin evidencia"
            forms_a = _matched_forms(mentions_a, relation.entity_a_id)
            forms_b = _matched_forms(mentions_b, relation.entity_b_id)
            assert any(form in evidence for form in forms_a), (
                f"{article.article_id} {relation.entity_a_id}: la evidencia no nombra la entidad A\n"
                f"  formas: {sorted(forms_a)}\n  evidencia: {evidence!r}"
            )
            assert any(form in evidence for form in forms_b), (
                f"{article.article_id} {relation.entity_b_id}: la evidencia no nombra la entidad B\n"
                f"  formas: {sorted(forms_b)}\n  evidencia: {evidence!r}"
            )
            checked += 1

    # A suite that silently stopped producing relations would pass the loop
    # above without checking anything.
    assert checked >= 4, f"el corpus de prueba solo produjo {checked} relaciones"


def test_a_fragment_missing_an_entity_is_dropped_instead_of_exported(article, mentions_of):
    """The guarantee above is enforced, not merely observed.

    Through the public pipeline the joint span always holds both entities by
    construction — it runs from the first mention's start to the last one's
    end in the very text the offsets index — so no corpus can exercise the
    final guard, and deleting it leaves the rest of this file green. That
    makes the headline guarantee incidental: it would hold because of how the
    span happens to be computed, not because the code refuses to publish a
    fragment that fails it.

    So the contract is asserted where it lives. Handing `_overlap_context`
    text the offsets no longer describe is the one way to produce a span that
    misses an entity, and the required answer is to drop the pair.
    """

    fixture = article("A6_misma_seccion_en")
    mentions = mentions_of(fixture)
    mention_a = next(m for m in mentions if m.entity_type == "a")
    mention_b = next(m for m in mentions if m.entity_type == "b")

    intact = _overlap_context(fixture.text, mention_a, mention_b, max_span=10_000)
    assert normalize_space(mention_a.matched_text) in intact
    assert normalize_space(mention_b.matched_text) in intact

    # Same offsets, text that no longer contains either term at them.
    desynchronized = "." * len(fixture.text)
    assert _overlap_context(desynchronized, mention_a, mention_b, max_span=10_000) == ""


def test_cross_sentence_evidence_is_the_joint_span(article, mentions_of, relations_of):
    """The fragment IS the passage a reviewer must read to see both entities.

    In this fixture the two entities appear once each, in different
    sentences of the Results section, ~400 characters apart — further than
    the 260-character context radius, so neither mention's own window could
    ever contain the other.
    """

    fixture = article("A6_misma_seccion_en")
    mentions = mentions_of(fixture)
    mention_a = next(m for m in mentions if m.entity_id == "lead")
    mention_b = next(m for m in mentions if m.entity_id == "alzheimers_disease")
    assert mention_a.sentence != mention_b.sentence
    separation = mention_b.start - mention_a.start
    assert separation > 260  # beyond the protocol's context_radius

    relations = relations_of(fixture)

    assert len(relations) == 1
    assert relations[0].evidence_text == normalize_space(
        fixture.text[mention_a.start : mention_b.end]
    )


# --------------------------------------------------------------------------- #
# Distance                                                                    #
# --------------------------------------------------------------------------- #


def test_entities_far_apart_in_different_sentences_produce_no_relation(
    article, mentions_of, relations_of
):
    fixture = article("A5_entidades_lejanas_en")
    mentions = mentions_of(fixture)
    mention_a = next(m for m in mentions if m.entity_id == "cadmium")
    mention_b = next(m for m in mentions if m.entity_id == "parkinsons_disease")
    assert mention_a.sentence != mention_b.sentence
    span = mention_b.end - mention_a.start
    assert span > 900  # beyond the protocol's relation_distance

    assert relations_of(fixture) == []
    # The pair is excluded by the window and by nothing else: widening the
    # window brings it back.
    widened = relations_of(fixture, relation_distance=span)
    assert [(r.entity_a_id, r.entity_b_id) for r in widened] == [("cadmium", "parkinsons_disease")]


def test_a_pair_within_the_window_yields_exactly_one_row(article, mentions_of, relations_of):
    """Dedup: one row per entity pair, whatever the number of co-occurrences."""

    fixture = article("A1_imrad_completo_es")
    mentions = mentions_of(fixture)
    assert sum(1 for m in mentions if m.entity_id == "lead") > 1
    assert sum(1 for m in mentions if m.entity_id == "alzheimers_disease") > 1

    relations = relations_of(fixture)

    assert [(r.entity_a_id, r.entity_b_id) for r in relations] == [("lead", "alzheimers_disease")]


def test_relations_are_unique_per_entity_pair_across_the_corpus(corpus, relations_of):
    for article_object in corpus.values():
        pairs = [(r.entity_a_id, r.entity_b_id) for r in relations_of(article_object)]
        assert len(pairs) == len(set(pairs)), f"{article_object.article_id}: pares duplicados"


# --- relation_distance sweep ------------------------------------------------ #

_HEADLINE = "Estudio sintetico de separacion controlada.\n\n"
_FIRST = "El plomo se midio en las muestras de agua. "
_FILLER = "El laboratorio repitio el analisis de control. "
_LAST = "La enfermedad de Alzheimer se diagnostico despues."


def _spaced_text(repeats: int) -> str:
    """Two entities in different sentences, separated by ``repeats`` fillers."""

    return _HEADLINE + _FIRST + _FILLER * repeats + _LAST


# Chosen so the joint spans straddle every threshold under test, including
# the region between 700 and 1500 that the old hardcoded cap made
# unreachable no matter what the protocol asked for.
SEPARATIONS = (0, 7, 8, 13, 14, 18, 19, 30, 32)


@pytest.mark.parametrize("relation_distance", [400, 700, 900, 1500])
def test_relation_distance_is_honoured_above_the_old_700_cap(
    build_article, mentions_of, relations_of, relation_distance
):
    """The kept range must track the configured parameter, not a literal.

    Before the fix `_overlap_context` applied its own `abs(a.start - b.start)
    < 700`, so 700, 900, 1500 and 3000 all kept exactly [0, 699] and the
    Methods section documented a window the code never used.
    """

    kept_spans: list[int] = []
    dropped_spans: list[int] = []
    for repeats in SEPARATIONS:
        text = _spaced_text(repeats)
        article_object = build_article(text, article_id=f"SEP{repeats}")
        mentions = mentions_of(article_object)
        mention_a = next(m for m in mentions if m.entity_id == "lead")
        mention_b = next(m for m in mentions if m.entity_id == "alzheimers_disease")
        assert mention_a.sentence != mention_b.sentence
        span = mention_b.end - mention_a.start

        relations = relations_of(article_object, relation_distance=relation_distance)

        assert len(relations) == (1 if span <= relation_distance else 0), (
            f"separación {span} con relation_distance={relation_distance}"
        )
        (kept_spans if relations else dropped_spans).append(span)

    # Both sides of the threshold are exercised for every parameter value.
    assert kept_spans and dropped_spans
    assert max(kept_spans) <= relation_distance < min(dropped_spans)


def test_a_window_above_700_keeps_pairs_the_old_cap_dropped(
    build_article, mentions_of, relations_of
):
    """A span between 700 and 1500 is kept at 1500 and dropped at 700."""

    article_object = build_article(_spaced_text(30), article_id="SEP30")
    mentions = mentions_of(article_object)
    span = (
        next(m for m in mentions if m.entity_id == "alzheimers_disease").end
        - next(m for m in mentions if m.entity_id == "lead").start
    )
    assert 700 < span <= 1500

    assert relations_of(article_object, relation_distance=1500)
    assert relations_of(article_object, relation_distance=700) == []


# --------------------------------------------------------------------------- #
# The association-label ladder                                                #
# --------------------------------------------------------------------------- #

STRONG_SENTENCE = "El plomo se asoció significativamente con la enfermedad de Alzheimer."
WEAK_SENTENCE = "El plomo se asoció con la enfermedad de Alzheimer."
SPECULATIVE_SENTENCE = "El plomo podría afectar a la enfermedad de Alzheimer."
NEUTRAL_SENTENCE = "El plomo y la enfermedad de Alzheimer se estudiaron en el mismo laboratorio."
NEGATED_SENTENCE = (
    "El plomo no se asoció con la enfermedad de Alzheimer pese al aumento "
    "significativamente mayor observado en el subgrupo."
)

LADDER_CASES = [
    ("asociacion_fuerte", f"Estudio sintetico.\n\n{STRONG_SENTENCE}\n"),
    ("asociacion_debil", f"Estudio sintetico.\n\n{WEAK_SENTENCE}\n"),
    # Señal fuerte fuera de una sección central: baja a débil.
    ("asociacion_debil", f"Estudio sintetico.\n\nDiscusión\n{STRONG_SENTENCE}\n"),
    ("mencion_especulativa", f"Estudio sintetico.\n\n{SPECULATIVE_SENTENCE}\n"),
    ("sin_evidencia_suficiente", f"Estudio sintetico.\n\n{NEUTRAL_SENTENCE}\n"),
    # La negación manda aunque la señal fuerte esté presente.
    ("sin_evidencia_suficiente", f"Estudio sintetico.\n\n{NEGATED_SENTENCE}\n"),
]


@pytest.mark.parametrize(
    ("expected_label", "text"),
    [pytest.param(case[0], case[1], id=f"{case[0]}-{index}") for index, case in enumerate(LADDER_CASES)],
)
def test_association_label_ladder(build_article, relations_of, expected_label, text):
    relations = relations_of(build_article(text, article_id="LADDER"))

    assert len(relations) == 1
    assert relations[0].association == expected_label
    assert relations[0].evidence_text


def test_the_ladder_cases_cover_every_documented_label(build_article, relations_of):
    produced = {
        relations_of(build_article(text, article_id="LADDER"))[0].association
        for _, text in LADDER_CASES
    }

    assert produced == {
        "asociacion_fuerte",
        "asociacion_debil",
        "mencion_especulativa",
        "sin_evidencia_suficiente",
    }


def test_a_negation_cue_overrides_a_strong_association_cue(build_article, protocol, relations_of):
    """The negated sentence really does carry a strong cue; it is still dropped."""

    assert protocol.cues.any_match("strong_association", NEGATED_SENTENCE)
    assert protocol.cues.any_match("negation", NEGATED_SENTENCE)

    relations = relations_of(build_article(f"Estudio sintetico.\n\n{NEGATED_SENTENCE}\n"))

    assert relations[0].association == "sin_evidencia_suficiente"
    assert relations[0].confidence == "Baja"


# --------------------------------------------------------------------------- #
# Symmetry of the A/B slots                                                   #
# --------------------------------------------------------------------------- #


def test_swapping_the_a_and_b_slots_changes_no_label_and_no_confidence(
    corpus, protocol, mentions_of, summaries_of, relations_of
):
    """Which variable the protocol author called "A" must not move a score.

    The evidence section is taken from whichever mention comes first in the
    article, so the label, the confidence and the score are properties of
    the quoted passage, not of the slot assignment.
    """

    compared = 0
    for article_object in corpus.values():
        mentions = mentions_of(article_object)
        mentions_a = [m for m in mentions if m.entity_type == "a"]
        mentions_b = [m for m in mentions if m.entity_type == "b"]
        summaries = summaries_of(article_object, mentions)
        straight = relations_of(article_object)
        swapped = build_relations(
            article=article_object,
            mentions_a=mentions_b,
            mentions_b=mentions_a,
            summaries=summaries,
            cues=protocol.cues,
            sections=protocol.sections,
            relation_distance=protocol.analysis.relation_distance,
        )

        assert len(straight) == len(swapped)
        by_pair = {(r.entity_b_id, r.entity_a_id): r for r in swapped}
        for relation in straight:
            mirrored = by_pair[(relation.entity_a_id, relation.entity_b_id)]
            assert mirrored.association == relation.association
            assert mirrored.confidence == relation.confidence
            assert mirrored.confidence_score == relation.confidence_score
            assert mirrored.section == relation.section
            assert mirrored.evidence_text == relation.evidence_text
            compared += 1

    assert compared >= 4
