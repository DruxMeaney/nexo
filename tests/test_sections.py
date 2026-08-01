"""Regression tests for section detection and section weights.

Section boundaries decide the weight every mention carries, so they decide
every exported score. The audit (finding B1) measured ~14.9% of the corpus
characters landing in the wrong section because wrapped body lines and
cited journal names opened spans. These tests pin the three rules that
close that hole — line-length, run-in punctuation and a terminal
bibliography — plus the documented weight table and the tie-breaking that
keeps the detector deterministic.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from review_miner.protocol import (
    DEFAULT_SECTION_WEIGHTS,
    SectionConfig,
    _compile_patterns,
    load_protocol,
)
from review_miner.sections import (
    MAX_HEADER_LINE_CHARS,
    TERMINAL_SECTION,
    detect_sections,
    section_for_position,
    section_weight,
)


# Section ids `detect_sections` can open. ``other`` is excluded on purpose:
# it is the catch-all `section_for_position` returns when no span covers the
# offset, never a span the detector emits (see `test_other_is_the_catch_all`).
DETECTABLE_SECTIONS = frozenset(DEFAULT_SECTION_WEIGHTS) - {"other"}

# The weight table documented in the manuscript's Methods section and in
# `src/lib/protocol/defaults.ts`. Written out literally so a silent edit to
# `DEFAULT_SECTION_WEIGHTS` fails here instead of shifting every score.
DOCUMENTED_WEIGHTS = {
    "title": 5,
    "abstract": 4,
    "methods": 6,
    "results": 5,
    "discussion": 2,
    "conclusion": 2,
    "introduction": 1,
    "references": -3,
    "other": 1,
}


def _span_names(spans) -> list[str]:
    return [span.name for span in spans]


# --------------------------------------------------------------------------- #
# Coverage of the section vocabulary                                          #
# --------------------------------------------------------------------------- #


def test_every_detectable_section_id_is_produced_by_the_corpus(corpus, protocol):
    """The fixture corpus must exercise every span the detector can open."""

    produced: set[str] = set()
    for article in corpus.values():
        produced.update(_span_names(detect_sections(article.text, protocol.sections)))

    assert produced == set(DETECTABLE_SECTIONS)


def test_other_is_the_catch_all_and_never_a_detected_span(corpus, protocol):
    """``other`` is only ever returned when no span covers the position."""

    assert section_for_position([], 0) == "other"
    for article in corpus.values():
        spans = detect_sections(article.text, protocol.sections)
        assert "other" not in _span_names(spans)


def test_full_imrad_article_has_the_expected_span_sequence(article, protocol):
    spans = detect_sections(article("A1_imrad_completo_es").text, protocol.sections)

    assert _span_names(spans) == [
        "title",
        "abstract",
        "introduction",
        "methods",
        "results",
        "discussion",
        "conclusion",
        "references",
    ]
    # Spans tile the article: no gap and no overlap between consecutive ones.
    for previous, following in zip(spans, spans[1:]):
        assert previous.end == following.start
    assert spans[0].start == 0
    assert spans[-1].end == len(article("A1_imrad_completo_es").text)


# --------------------------------------------------------------------------- #
# False headers                                                               #
# --------------------------------------------------------------------------- #


FALSE_HEADER_LINES = (
    "results from the soil monitoring programme",
    "method yields crucial data for public health",
)


@pytest.mark.parametrize("line_start", FALSE_HEADER_LINES)
def test_wrapped_body_line_does_not_open_a_section(article, protocol, line_start):
    """A wrapped body line beginning with a header word stays body text.

    Both lines below start their own line (PDF extraction wraps prose that
    way constantly) and both begin with a word the shipped ``methods`` /
    ``results`` patterns match. They must not relabel the rest of the
    Introduction.
    """

    fixture = article("A3_falsos_encabezados_en")
    position = fixture.text.index(line_start)
    # Precondition: the fixture really is a line start of a long line, which
    # is the case the length rule exists for.
    assert fixture.text[position - 1] == "\n"
    line_end = fixture.text.index("\n", position)
    assert line_end - position > MAX_HEADER_LINE_CHARS

    spans = detect_sections(fixture.text, protocol.sections)
    assert section_for_position(spans, position) == "introduction"
    assert all(span.start != position for span in spans)


# The length rule alone cannot reject these: every line is comfortably under
# MAX_HEADER_LINE_CHARS. They are prose because of how they are SET, not how
# long they are — which is what `_is_typographically_marked` judges.
SHORT_FALSE_HEADERS = (
    # A wrapped clause whose continuation happens to start on a section word.
    ("results showed that inflammation was severe", "results"),
    ("method used here follows Larsen et al.", "method"),
    # A sentence that wraps so its final word lands alone on a line. The
    # trailing period is what separates it from a bare lowercase header.
    ("result.", "result"),
)


@pytest.mark.parametrize("line, word", SHORT_FALSE_HEADERS)
def test_a_short_lowercase_line_does_not_open_a_section(protocol, line, word):
    """Prose in lowercase stays prose, however short the line is.

    This is the hole the length rule left open: at 43 characters,
    ``"results showed that inflammation was severe"`` passes every
    line-length test, so before this rule it opened a ``results`` section that
    relabelled everything after it and lifted the section weight from 2 to 5 —
    inflating the score of every mention in the rest of the article.
    """

    text = f"Discussion\n\nThe exposure model is described elsewhere. Our\n{line}\nCadmium rose.\n"
    assert len(line) <= MAX_HEADER_LINE_CHARS  # the length rule cannot help here
    assert line.startswith(word)

    spans = detect_sections(text, protocol.sections)
    assert [span.name for span in spans] == ["discussion"]
    assert section_for_position(spans, text.index("Cadmium")) == "discussion"


def test_a_bare_lowercase_header_still_opens_its_section(protocol):
    """Rejecting lowercase prose must not reject a lowercase HEADER.

    Some journals print ``abstract`` in lowercase. Alone on its line, with no
    trailing punctuation, it is unambiguous — and it is exactly the case the
    rule above must not swallow.
    """

    text = "abstract\n\nCadmium was measured in every sample of the cohort.\n"

    spans = detect_sections(text, protocol.sections)
    assert [span.name for span in spans] == ["abstract"]
    assert section_for_position(spans, text.index("Cadmium")) == "abstract"


def test_capitalised_headers_are_unaffected(protocol):
    """The common case — and the run-in form — must keep working."""

    plain = "Introduction\n\nSome framing text.\n\nResults\n\nCadmium levels rose sharply.\n"
    spans = detect_sections(plain, protocol.sections)
    assert [span.name for span in spans] == ["introduction", "results"]
    assert section_for_position(spans, plain.index("Cadmium")) == "results"

    run_in = "Methods\n\nWe measured samples.\n\nDiscussion. This study reveals that lead exposure correlates with decline.\n"
    spans = detect_sections(run_in, protocol.sections)
    assert [span.name for span in spans] == ["methods", "discussion"]
    assert section_for_position(spans, run_in.index("lead")) == "discussion"


def test_false_headers_do_not_change_the_span_sequence(article, protocol):
    """The article with two false headers still reads as a plain IMRaD paper."""

    fixture = article("A3_falsos_encabezados_en")
    spans = detect_sections(fixture.text, protocol.sections)

    assert _span_names(spans) == [
        "title",
        "abstract",
        "introduction",
        "methods",
        "results",
        "references",
    ]


def test_cited_journal_name_inside_the_bibliography_opens_nothing(article, protocol):
    """``Methods Psychiatr Res 1993;3:1-28.`` is a citation, not a header.

    The line is short enough to pass the length rule — what rejects it is
    the bibliography being terminal. This is the audit's A13 case, worth a
    9-point swing per mention (+6 instead of -3).
    """

    fixture = article("A3_falsos_encabezados_en")
    position = fixture.text.index("Methods Psychiatr Res")
    assert fixture.text[position - 1] == "\n"
    line_end = fixture.text.index("\n", position)
    assert line_end - position <= MAX_HEADER_LINE_CHARS

    spans = detect_sections(fixture.text, protocol.sections)
    assert section_for_position(spans, position) == TERMINAL_SECTION
    assert _span_names(spans).count("methods") == 1
    references_start = next(s.start for s in spans if s.name == TERMINAL_SECTION)
    assert all(span.start <= references_start for span in spans)


# --------------------------------------------------------------------------- #
# Run-in headers                                                              #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("marker", "expected_section"),
    [
        ("Abstract: We examined", "abstract"),
        ("Discussion. This study reveals", "discussion"),
    ],
)
def test_run_in_header_opens_a_section(article, protocol, marker, expected_section):
    """``Discussion. This study reveals...`` is a header even on a long line.

    Journals run the first paragraph onto the header line, so the length
    rule alone would reject it. The separator (``.`` or ``:``) is what tells
    a real run-in header from a body line that merely starts with the word.
    """

    fixture = article("A2_encabezado_corrido_en")
    position = fixture.text.index(marker)
    line_end = fixture.text.index("\n", position)
    assert line_end - position > MAX_HEADER_LINE_CHARS  # the length rule alone would reject it

    spans = detect_sections(fixture.text, protocol.sections)
    opened = [span for span in spans if span.start == position]
    assert [span.name for span in opened] == [expected_section]


# --------------------------------------------------------------------------- #
# Terminal bibliography                                                       #
# --------------------------------------------------------------------------- #


def test_only_the_last_references_header_is_terminal(article, protocol):
    """A table column headed "Referencias" must not truncate the article.

    Truncating at the *first* match would drop the genuine Discussion and
    Conclusions that follow the table; anchoring on the last match keeps
    them and still ends the article at the real bibliography.
    """

    fixture = article("A4_referencias_en_tabla_es")
    spurious = fixture.text.index("Referencias")
    real = fixture.text.rindex("Referencias")
    assert spurious < real  # the fixture really carries two candidates

    spans = detect_sections(fixture.text, protocol.sections)
    references = [span for span in spans if span.name == TERMINAL_SECTION]

    assert len(references) == 1
    assert references[0].start == real
    assert references[0].end == len(fixture.text)
    # The spurious hit neither opens a span nor swallows what follows it.
    assert all(span.start != spurious for span in spans)
    assert section_for_position(spans, spurious) == "results"
    assert {"discussion", "conclusion"} <= set(_span_names(spans))
    for name in ("discussion", "conclusion"):
        assert next(s.start for s in spans if s.name == name) > spurious


# --------------------------------------------------------------------------- #
# Weights                                                                     #
# --------------------------------------------------------------------------- #


def test_shipped_defaults_carry_the_documented_weight_table():
    assert DEFAULT_SECTION_WEIGHTS == DOCUMENTED_WEIGHTS
    assert SectionConfig().weights == DOCUMENTED_WEIGHTS


def test_fixture_protocol_weights_are_the_documented_defaults(protocol):
    assert protocol.sections.weights == DOCUMENTED_WEIGHTS


@pytest.mark.parametrize(("section", "expected"), sorted(DOCUMENTED_WEIGHTS.items()))
def test_section_weight_returns_the_documented_default(protocol, section, expected):
    assert section_weight(section, protocol.sections) == expected


def test_unknown_section_falls_back_to_the_other_weight(protocol):
    assert section_weight("seccion_inexistente", protocol.sections) == DOCUMENTED_WEIGHTS["other"]


def test_section_weight_reads_the_weight_configured_in_the_protocol(tmp_path, protocol_dir):
    """A protocol that overrides a weight must be honoured, not the default.

    Copies the fixture protocol, rewrites ``sections.json`` with weights
    that differ from every default, and reloads it through the real loader.
    """

    custom_dir = tmp_path / "protocolo-personalizado"
    shutil.copytree(protocol_dir, custom_dir)
    sections_file = custom_dir / "sections.json"
    payload = json.loads(sections_file.read_text(encoding="utf-8"))
    overrides = {"methods": 11, "results": -7, "references": 3, "other": 9}
    payload["weights"].update(overrides)
    sections_file.write_text(json.dumps(payload), encoding="utf-8")

    custom = load_protocol(custom_dir)

    for section, expected in overrides.items():
        assert section_weight(section, custom.sections) == expected
        assert expected != DOCUMENTED_WEIGHTS[section]
    # Sections the protocol did not touch keep their documented weight.
    assert section_weight("abstract", custom.sections) == DOCUMENTED_WEIGHTS["abstract"]


# --------------------------------------------------------------------------- #
# Determinism                                                                 #
# --------------------------------------------------------------------------- #


def test_detect_sections_is_deterministic_over_the_corpus(corpus, protocol):
    for article_object in corpus.values():
        first = detect_sections(article_object.text, protocol.sections)
        for _ in range(3):
            again = detect_sections(article_object.text, protocol.sections)
            assert again == first


def test_title_sentinel_loses_a_tie_against_a_real_header(build_article, protocol):
    """An article whose very first line is a header must not become "title".

    Both markers land on offset 0. The ``title`` sentinel is ranked first so
    its span is zero-length and dropped; without that precedence the whole
    article would be labelled ``title`` and weighted +5, bibliography
    included.
    """

    text = "Abstract\nWe measured lead in blood samples.\n\nResults\nLead was high.\n"
    spans = detect_sections(text, protocol.sections)

    assert _span_names(spans) == ["abstract", "results"]
    assert spans[0].start == 0


def test_two_markers_tying_on_one_offset_resolve_by_name(protocol):
    """Two section names matching the same line resolve by name, not by luck.

    Without the name in the sort key the winner would depend on the
    iteration order of a ``set`` of tuples — reproducible within a run, but
    not something a published result may rest on. The name that sorts last
    keeps the span, because the other one is left zero-length.
    """

    pattern = _compile_patterns([r"(?im)^\s*(synthesis|sintesis)\b"])
    weights = {"alpha_section": 1, "omega_section": 1, "other": 1}
    text = "Encabezado del articulo\n\nSynthesis\nTexto del cuerpo del articulo.\n"

    forward = SectionConfig(
        headers={"alpha_section": list(pattern), "omega_section": list(pattern)},
        weights=weights,
    )
    reversed_order = SectionConfig(
        headers={"omega_section": list(pattern), "alpha_section": list(pattern)},
        weights=weights,
    )

    spans = detect_sections(text, forward)
    assert _span_names(spans) == ["title", "omega_section"]
    assert detect_sections(text, reversed_order) == spans


# Same tie as above, run in a fresh interpreter so PYTHONHASHSEED can be set.
# Without the name in the sort key the winner is decided by the iteration
# order of a `set` of tuples, which depends on the seed: the script below
# prints a different section name from run to run.
_TIE_SCRIPT = """
import json, sys
sys.path.insert(0, sys.argv[1])
from review_miner.protocol import SectionConfig, _compile_patterns
from review_miner.sections import detect_sections

pattern = _compile_patterns([r"(?im)^\\s*(synthesis|sintesis)\\b"])
config = SectionConfig(
    headers={"alpha_section": list(pattern), "omega_section": list(pattern)},
    weights={"alpha_section": 1, "omega_section": 1, "other": 1},
)
text = "Encabezado del articulo\\n\\nSynthesis\\nTexto del cuerpo del articulo.\\n"
print(json.dumps([[s.name, s.start, s.end] for s in detect_sections(text, config)]))
"""


def test_section_detection_does_not_depend_on_the_interpreter_hash_seed():
    """A published span map may not change between two runs of the same code.

    Python randomises string hashing per process, so anything that leaks
    `set` or `dict` iteration order into the result is reproducible on the
    author's machine and different on the reviewer's.
    """

    repo_root = Path(__file__).resolve().parents[1]
    outputs = set()
    for seed in ("0", "1", "2", "3", "17"):
        environment = dict(os.environ, PYTHONHASHSEED=seed)
        completed = subprocess.run(
            [sys.executable, "-c", _TIE_SCRIPT, str(repo_root)],
            capture_output=True,
            text=True,
            env=environment,
            cwd=repo_root,
            check=True,
        )
        outputs.add(completed.stdout.strip())

    assert len(outputs) == 1, f"la detección varió con la semilla de hash: {outputs}"
    assert json.loads(outputs.pop()) == [
        ["title", 0, 25],
        ["omega_section", 25, 66],
    ]
