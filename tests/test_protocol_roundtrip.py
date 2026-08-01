"""The shipped example protocol must survive a round trip through the loader.

`config/protocols/contaminantes-enfermedades-neurodegenerativas/` is the only
protocol a reviewer gets on a fresh clone, and the audit found it shipped with
double-escaped regexes: every pattern compiled, none could ever match, and the
run finished with `Menciones extraidas: 0` and exit code 0 — a silent empty
study indistinguishable from a valid negative result.

These tests pin the three things that failure needed in order to go unnoticed:
the shipped protocol really matches text, the loader is loud when a variable
compiles zero usable patterns, and the numbers a Methods section quotes
(section weights, analysis parameters) are the documented ones.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from review_miner.protocol import (
    CUE_FAMILIES,
    DEFAULT_SECTION_WEIGHTS,
    AnalysisParams,
    load_protocol,
)

EXAMPLE_PROTOCOL = REPO_ROOT / "config" / "protocols" / "contaminantes-enfermedades-neurodegenerativas"

# A pattern that decodes to a literal backslash followed by a letter — the
# shape a JSON file with doubled escapes produces ("\\\\b" -> "\\b"). It
# compiles cleanly and never matches prose.
DOUBLE_ESCAPE = "\\" * 2


@pytest.fixture(scope="module")
def example_protocol():
    return load_protocol(EXAMPLE_PROTOCOL)


def write_protocol(
    folder: Path,
    *,
    analysis: dict | None = None,
    variables: dict[str, dict] | None = None,
    sections: dict | None = None,
    cues: dict[str, list[str]] | None = None,
) -> Path:
    """Write a minimal protocol folder, defaulting to a valid one-term lexicon."""

    (folder / "variables").mkdir(parents=True, exist_ok=True)
    (folder / "cues").mkdir(parents=True, exist_ok=True)
    (folder / "protocol.json").write_text(
        json.dumps({"identity": {"name": "Protocolo de prueba"}, "analysis": analysis or {}}),
        encoding="utf-8",
    )
    defaults = {
        slot: {
            "metadata": {"displayNameEs": f"Variable {slot.upper()}", "displayNameEn": f"Variable {slot.upper()}", "mode": "hierarchical"},
            "taxonomy": [
                {
                    "id": f"cat_{slot}",
                    "kind": "category",
                    "labelEs": f"Categoria {slot.upper()}",
                    "children": [
                        {
                            "id": f"term_{slot}",
                            "kind": "term",
                            "labelEs": f"Termino {slot.upper()}",
                            "labelEn": f"Term {slot.upper()}",
                            "patterns": [rf"\bterm{slot}\b"],
                        }
                    ],
                }
            ],
        }
        for slot in ("a", "b")
    }
    for slot, payload in {**defaults, **(variables or {})}.items():
        (folder / "variables" / f"variable_{slot}.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8"
        )
    for family, patterns in (cues or {}).items():
        (folder / "cues" / f"{family}.json").write_text(
            json.dumps({"id": family, "patterns": patterns}, ensure_ascii=False), encoding="utf-8"
        )
    (folder / "sections.json").write_text(
        json.dumps(sections or {"activeProfile": "baseline_current", "weights": DEFAULT_SECTION_WEIGHTS, "headers": {}}),
        encoding="utf-8",
    )
    return folder


# --------------------------------------------------------------------------- #
# The shipped example protocol                                                #
# --------------------------------------------------------------------------- #


def test_example_protocol_folder_is_committed():
    assert EXAMPLE_PROTOCOL.is_dir()
    assert (EXAMPLE_PROTOCOL / "protocol.json").exists()


def test_both_lexicons_are_non_empty(example_protocol):
    assert example_protocol.lexicon_a, "variable A compiled zero entities"
    assert example_protocol.lexicon_b, "variable B compiled zero entities"


def test_every_term_has_at_least_one_compiled_pattern(example_protocol):
    for entity in example_protocol.all_entities():
        assert entity.patterns, f"{entity.entity_type}/{entity.entity_id} has no pattern"
        for pattern in entity.patterns:
            assert isinstance(pattern, re.Pattern)


def test_no_term_pattern_is_double_escaped(example_protocol):
    """A ``\\\\b`` in the JSON compiles fine and can never match — B5's failure."""

    offenders = [
        (entity.entity_id, pattern.pattern)
        for entity in example_protocol.all_entities()
        for pattern in entity.patterns
        if DOUBLE_ESCAPE in pattern.pattern
    ]
    assert offenders == []


def test_no_cue_pattern_is_double_escaped(example_protocol):
    offenders = [
        (family, pattern.pattern)
        for family in CUE_FAMILIES
        for pattern in getattr(example_protocol.cues, family)
        if DOUBLE_ESCAPE in pattern.pattern
    ]
    assert offenders == []


def test_shipped_patterns_actually_match_representative_text(example_protocol):
    """The end-to-end guard: a compiling protocol that matches nothing is the bug."""

    sample_a = "Blood lead levels and exposicion a plomo were measured."
    sample_b = "Patients with Parkinson's disease and enfermedad de Alzheimer."

    matched_a = {
        entity.entity_id
        for entity in example_protocol.lexicon_a
        for pattern in entity.patterns
        if pattern.search(sample_a)
    }
    matched_b = {
        entity.entity_id
        for entity in example_protocol.lexicon_b
        for pattern in entity.patterns
        if pattern.search(sample_b)
    }
    assert matched_a, "no Variable-A term matches a plain sentence naming lead"
    assert matched_b, "no Variable-B term matches a plain sentence naming Parkinson/Alzheimer"


def test_all_ten_cue_families_are_present_and_populated(example_protocol):
    assert len(CUE_FAMILIES) == 10
    empty = [family for family in CUE_FAMILIES if not getattr(example_protocol.cues, family)]
    assert empty == [], f"cue families with zero usable patterns: {empty}"


def test_all_nine_sections_have_numeric_weights(example_protocol):
    weights = example_protocol.sections.weights
    assert len(DEFAULT_SECTION_WEIGHTS) == 9
    assert set(weights) == set(DEFAULT_SECTION_WEIGHTS)
    for name, value in weights.items():
        assert isinstance(value, int) and not isinstance(value, bool), f"{name} weight is not an int"
    # The example ships the documented baseline profile: these are the numbers
    # a Methods section quotes, so a silent edit must fail the suite.
    assert weights == DEFAULT_SECTION_WEIGHTS
    assert example_protocol.sections.active_profile == "baseline_current"


def test_section_headers_compile_for_every_imrad_section(example_protocol):
    headers = example_protocol.sections.headers
    assert set(headers) == set(DEFAULT_SECTION_WEIGHTS)
    # `title` is the span before the first header and `other` is the catch-all;
    # neither is detected by a regex. Every remaining section must be.
    for name, patterns in headers.items():
        if name in {"title", "other"}:
            continue
        assert patterns, f"section '{name}' has no usable header pattern"


def test_analysis_parameters_are_the_documented_defaults(example_protocol):
    assert example_protocol.analysis == AnalysisParams(
        context_radius=260,
        kwic_radius=160,
        relation_distance=900,
        kmeans_k=4,
        validation_sample_size=200,
    )


def test_display_names_round_trip(example_protocol):
    assert example_protocol.variable_a.display_name == "Contaminantes"
    assert example_protocol.variable_b.display_name == "Enfermedades neurodegenerativas"
    assert example_protocol.identity.name


def test_hierarchical_terms_inherit_their_category_path(example_protocol):
    categories = {entity.category for entity in example_protocol.lexicon_a}
    assert "" not in categories
    assert "Metales pesados" in categories


# --------------------------------------------------------------------------- #
# The loader must be loud when a variable loses its patterns                  #
# --------------------------------------------------------------------------- #


def test_loader_warns_when_a_variable_compiles_zero_patterns(tmp_path, capsys):
    """The guard against the silent empty study the audit reproduced."""

    broken = {
        "a": {
            "metadata": {"displayNameEs": "Contaminantes", "displayNameEn": "Contaminants", "mode": "flat"},
            "taxonomy": [
                {
                    "id": "roto",
                    "kind": "term",
                    "labelEs": "Roto",
                    "labelEn": "Broken",
                    "patterns": ["(sin cerrar"],  # unbalanced parenthesis: never compiles
                }
            ],
        }
    }
    folder = write_protocol(tmp_path / "roto", variables=broken)

    protocol = load_protocol(folder)
    stderr = capsys.readouterr().err

    assert protocol.lexicon_a == []
    assert "CERO" in stderr, f"no zero-pattern warning on stderr, got: {stderr!r}"
    assert "(sin cerrar" in stderr, "the offending pattern is not named in the warning"
    # The healthy variable is untouched by its neighbour's failure.
    assert len(protocol.lexicon_b) == 1


def test_loader_warns_about_a_double_escaped_pattern(tmp_path, capsys):
    doubled = {
        "a": {
            "metadata": {"displayNameEs": "Contaminantes", "displayNameEn": "Contaminants", "mode": "flat"},
            "taxonomy": [
                {
                    "id": "plomo",
                    "kind": "term",
                    "labelEs": "plomo",
                    "labelEn": "lead",
                    # What json.dumps writes here is "\\\\bplomo\\\\b", which
                    # decodes to the regex \\bplomo\\b — a literal backslash.
                    "patterns": [DOUBLE_ESCAPE + "bplomo" + DOUBLE_ESCAPE + "b"],
                }
            ],
        }
    }
    folder = write_protocol(tmp_path / "doble", variables=doubled)

    protocol = load_protocol(folder)
    stderr = capsys.readouterr().err

    assert "doble escape" in stderr
    # And the reason it matters: the pattern is live but inert.
    pattern = protocol.lexicon_a[0].patterns[0]
    assert pattern.search("exposicion a plomo en sangre") is None


def test_loader_warns_when_sections_define_no_usable_header(tmp_path, capsys):
    folder = write_protocol(
        tmp_path / "sin_headers",
        sections={"activeProfile": "baseline_current", "weights": DEFAULT_SECTION_WEIGHTS, "headers": {}},
    )

    protocol = load_protocol(folder)
    stderr = capsys.readouterr().err

    assert "encabezado" in stderr
    # Falling back to the documented IMRaD patterns, never to "everything is
    # the title" (which weights the whole article, bibliography included, at 5).
    assert protocol.sections.headers["methods"]


# --------------------------------------------------------------------------- #
# Analysis parameters                                                         #
# --------------------------------------------------------------------------- #


def test_an_explicit_zero_analysis_parameter_survives_loading(tmp_path):
    """``relationDistance: 0`` is a deliberate choice, not a missing value."""

    folder = write_protocol(
        tmp_path / "ceros",
        analysis={"relationDistance": 0, "contextRadius": 0, "kmeansK": 0, "validationSampleSize": 0},
    )

    analysis = load_protocol(folder).analysis

    assert analysis.relation_distance == 0
    assert analysis.context_radius == 0
    assert analysis.kmeans_k == 0
    assert analysis.validation_sample_size == 0
    # Untouched keys still fall back to the documented default.
    assert analysis.kwic_radius == AnalysisParams().kwic_radius


def test_snake_case_analysis_keys_are_accepted(tmp_path):
    folder = write_protocol(tmp_path / "snake", analysis={"relation_distance": 120, "kwic_radius": 33})

    analysis = load_protocol(folder).analysis

    assert (analysis.relation_distance, analysis.kwic_radius) == (120, 33)


def test_a_non_numeric_analysis_parameter_falls_back_and_warns(tmp_path, capsys):
    folder = write_protocol(tmp_path / "texto", analysis={"relationDistance": "novecientos"})

    analysis = load_protocol(folder).analysis
    stderr = capsys.readouterr().err

    assert analysis.relation_distance == AnalysisParams().relation_distance
    assert "relationDistance" in stderr


# --------------------------------------------------------------------------- #
# Flat taxonomies                                                             #
# --------------------------------------------------------------------------- #


def test_a_root_level_term_gets_a_non_empty_category(tmp_path):
    """A flat variable has no parent node: the category falls back to its name.

    An empty category round-trips through CSV as NaN and silently empties the
    category heatmap (audit B11), so "no category" must never reach the export.
    """

    flat = {
        "a": {
            "metadata": {"displayNameEs": "Farmacos", "displayNameEn": "Drugs", "mode": "flat"},
            "taxonomy": [
                {
                    "id": "ibuprofeno",
                    "kind": "term",
                    "labelEs": "ibuprofeno",
                    "labelEn": "ibuprofen",
                    "patterns": [r"\bibuprofeno\b"],
                }
            ],
        }
    }
    folder = write_protocol(tmp_path / "plano", variables=flat)

    protocol = load_protocol(folder)

    assert len(protocol.lexicon_a) == 1
    assert protocol.lexicon_a[0].category == "Farmacos"
    assert protocol.lexicon_a[0].category.strip() != ""


def test_missing_protocol_folder_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_protocol(tmp_path / "no-existe")
