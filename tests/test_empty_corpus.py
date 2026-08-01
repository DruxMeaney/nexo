"""A run that finds nothing must still be a valid run — and must say so.

Two degenerate cases the audit reproduced as crashes:

  * a protocol whose patterns match nothing died with an opaque
    ``KeyError('entity_type')`` inside pandas, after having already written
    the main tables — the user lost all fourteen publication tables because
    one variable happened not to match, which is exactly the situation during
    a pilot run;
  * a corpus with Variable-A mentions but no A-B co-occurrence died with
    ``KeyError('weighted_evidence_score')``.

Both must now complete, write well-formed empty tables carrying the same
headers a populated run writes, and warn loudly. The warning is the point: a
silent empty study is indistinguishable from a valid negative result, and the
audit found a verifier following the manuscript got exactly that, with exit
code 0.

Every run here uses the same two display names, so the header of an empty
table can be compared directly against the header of a populated one.
"""

from __future__ import annotations

import contextlib
import csv
import io
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from review_miner.protocol import DEFAULT_SECTION_WEIGHTS, load_protocol
from review_miner.publication_pipeline import run_publication_pipeline

MAIN_TABLES = ("articles", "mentions", "entity_summaries", "relations", "systematic_review_table")

# Matches nothing in any natural-language corpus.
NEVER_MATCHES = r"\bzzqqxx\b"

CORPUS_TEXT = """Exposicion a plomo y enfermedad de Parkinson en trabajadores

Abstract
Se evaluo la exposicion ocupacional a plomo y su relacion con la enfermedad de Parkinson
en una cohorte de trabajadores industriales seguida durante diez anos.

Materiales y metodos
Las concentraciones de plomo en sangre se midieron en mg/kg. Los casos de enfermedad de
Parkinson se identificaron a partir de registros clinicos estandarizados.

Resultados
La exposicion a plomo se asocio con un mayor riesgo de enfermedad de Parkinson en la
poblacion estudiada.

Referencias
Autor A. Plomo y neurodegeneracion. Revista de Toxicologia. 2020.
"""


def write_protocol(folder: Path, pattern_a: str, pattern_b: str) -> Path:
    """Minimal two-term protocol; the display names are the same in every case."""

    (folder / "variables").mkdir(parents=True, exist_ok=True)
    (folder / "cues").mkdir(parents=True, exist_ok=True)
    (folder / "protocol.json").write_text(
        json.dumps({"identity": {"name": "Protocolo minimo"}, "analysis": {}}), encoding="utf-8"
    )
    terms = {
        "a": ("Contaminantes", "Contaminants", "plomo", "lead", pattern_a),
        "b": ("Enfermedades", "Diseases", "Parkinson", "Parkinson's disease", pattern_b),
    }
    for slot, (name_es, name_en, label_es, label_en, pattern) in terms.items():
        (folder / "variables" / f"variable_{slot}.json").write_text(
            json.dumps(
                {
                    "metadata": {"displayNameEs": name_es, "displayNameEn": name_en, "mode": "flat"},
                    "taxonomy": [
                        {
                            "id": f"term_{slot}",
                            "kind": "term",
                            "labelEs": label_es,
                            "labelEn": label_en,
                            "patterns": [pattern],
                        }
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    (folder / "cues" / "exposure.json").write_text(
        json.dumps({"id": "exposure", "patterns": [r"\bexposici[oó]n\b", r"\bexposure\b"]}, ensure_ascii=False),
        encoding="utf-8",
    )
    (folder / "cues" / "association.json").write_text(
        json.dumps({"id": "association", "patterns": [r"\bse asoci[oó]\b", r"\bassociated with\b"]}, ensure_ascii=False),
        encoding="utf-8",
    )
    (folder / "sections.json").write_text(
        json.dumps(
            {
                "activeProfile": "baseline_current",
                "weights": DEFAULT_SECTION_WEIGHTS,
                "headers": {
                    "abstract": [r"(?im)^\s*(abstract|resumen)\b"],
                    "methods": [r"(?im)^\s*(materiales\s+y\s+metodos|methods?)\b"],
                    "results": [r"(?im)^\s*(resultados|results?)\b"],
                    "references": [r"(?im)^\s*(referencias|references)\b"],
                },
            }
        ),
        encoding="utf-8",
    )
    return folder


def run_case(tmp_path_factory, name: str, pattern_a: str, pattern_b: str) -> dict:
    """Run the full publication pipeline over one fixture corpus, capturing stderr."""

    root = tmp_path_factory.mktemp(name)
    protocol_dir = write_protocol(root / "protocolo", pattern_a, pattern_b)
    corpus = root / "corpus"
    corpus.mkdir()
    (corpus / "A01.txt").write_text(CORPUS_TEXT, encoding="utf-8")
    output = root / "salida"

    stderr = io.StringIO()
    with contextlib.redirect_stderr(stderr):
        protocol = load_protocol(protocol_dir)
        results = run_publication_pipeline(
            protocol=protocol,
            input_dir=corpus,
            output_dir=output,
            sample_size=5,
        )
    return {"output": output, "results": results, "stderr": stderr.getvalue()}


@pytest.fixture(scope="module")
def populated_run(tmp_path_factory):
    """Reference run: both variables match, so every table has rows."""

    return run_case(tmp_path_factory, "poblado", r"\bplomo\b", r"\bparkinson\b")


@pytest.fixture(scope="module")
def empty_run(tmp_path_factory):
    """Neither variable matches anything in the corpus."""

    return run_case(tmp_path_factory, "vacio", NEVER_MATCHES, NEVER_MATCHES)


@pytest.fixture(scope="module")
def a_only_run(tmp_path_factory):
    """Variable A matches; Variable B never does, so there is no co-occurrence."""

    return run_case(tmp_path_factory, "solo_a", r"\bplomo\b", NEVER_MATCHES)


def read_table(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), [dict(row) for row in reader]


# --------------------------------------------------------------------------- #
# The reference run                                                           #
# --------------------------------------------------------------------------- #


def test_the_reference_run_is_not_itself_empty(populated_run):
    results = populated_run["results"]

    assert results["mentions"], "the reference corpus produced no mention"
    assert results["relations"], "the reference corpus produced no relation"


# --------------------------------------------------------------------------- #
# Case 1: nothing matches                                                     #
# --------------------------------------------------------------------------- #


def test_a_protocol_that_matches_nothing_completes_without_exception(empty_run):
    results = empty_run["results"]

    assert results["mentions"] == []
    assert results["summaries"] == []
    assert results["relations"] == []
    # The article itself was still read and reported.
    assert len(results["articles"]) == 1


def test_the_empty_run_warns_that_it_found_nothing(empty_run):
    stderr = empty_run["stderr"]

    assert "AVISO" in stderr, f"an empty run produced no warning at all: {stderr!r}"
    assert "0 menciones" in stderr, f"the warning does not state the zero count: {stderr!r}"


def test_a_populated_run_does_not_emit_the_empty_warning(populated_run):
    assert "0 menciones" not in populated_run["stderr"]


@pytest.mark.parametrize("table", MAIN_TABLES)
def test_empty_tables_carry_the_same_header_as_a_populated_run(empty_run, populated_run, table):
    empty_header, empty_rows = read_table(empty_run["output"] / f"{table}.csv")
    full_header, full_rows = read_table(populated_run["output"] / f"{table}.csv")

    assert full_header, f"{table}.csv has no header even when populated"
    assert full_rows, f"{table}.csv has no row in the reference run"
    assert empty_header == full_header, f"{table}.csv loses its header when empty"
    if table == "articles":
        # The corpus was read; only the mining found nothing.
        assert len(empty_rows) == 1
    else:
        assert empty_rows == []


def test_the_empty_run_writes_every_publication_table(empty_run, populated_run):
    empty_dir = empty_run["output"] / "publication_pipeline"
    full_dir = populated_run["output"] / "publication_pipeline"

    assert {path.name for path in empty_dir.glob("*.csv")} == {
        path.name for path in full_dir.glob("*.csv")
    }
    # A single empty builder used to abort the whole extension export.
    assert (empty_dir / "publication_pipeline_summary.json").exists()


def test_the_empty_run_summary_reports_zero_and_keeps_the_protocol_block(empty_run):
    summary = json.loads(
        (empty_run["output"] / "publication_pipeline" / "publication_pipeline_summary.json").read_text(
            encoding="utf-8"
        )
    )

    assert summary["n_mentions"] == 0
    assert summary["n_relations"] == 0
    assert summary["n_articles"] == 1
    assert summary["protocol"]["variable_a"] == "Contaminantes"
    assert summary["protocol"]["variable_b"] == "Enfermedades"


def test_the_empty_run_still_produces_the_visual_analytics_stage(empty_run):
    visual_dir = empty_run["output"] / "visual_analytics"

    assert visual_dir.is_dir()
    assert (visual_dir / "visual_analytics_summary.json").exists()


# --------------------------------------------------------------------------- #
# Case 2: mentions but no co-occurrence                                       #
# --------------------------------------------------------------------------- #


def test_a_corpus_without_co_occurrence_completes(a_only_run):
    results = a_only_run["results"]

    assert results["mentions"], "Variable A should still have matched"
    assert {m.entity_type for m in results["mentions"]} == {"a"}
    assert results["summaries"], "the A entity should still be summarised"
    assert results["relations"] == []
    # Mentions without a single co-occurrence is also a result worth stating.
    assert "0 relaciones" in a_only_run["stderr"], f"no warning: {a_only_run['stderr']!r}"


def test_relations_stay_well_formed_when_no_pair_co_occurs(a_only_run, populated_run):
    header, rows = read_table(a_only_run["output"] / "relations.csv")
    reference_header, _ = read_table(populated_run["output"] / "relations.csv")

    assert header == reference_header
    assert rows == []


def test_the_systematic_table_still_lists_the_detected_variable_a(a_only_run):
    header, rows = read_table(a_only_run["output"] / "systematic_review_table.csv")

    assert rows, "an article with a Variable-A entity must still produce a row"
    assert "Variable A: Contaminantes" in header
    for row in rows:
        assert row["Variable B: Enfermedades"] == "no detectado"
        assert row["Asociacion contaminantes-enfermedades"] == "no detectado"


def test_the_co_occurrence_free_run_writes_every_publication_table(a_only_run, populated_run):
    partial = {path.name for path in (a_only_run["output"] / "publication_pipeline").glob("*.csv")}
    full = {path.name for path in (populated_run["output"] / "publication_pipeline").glob("*.csv")}

    assert partial == full
