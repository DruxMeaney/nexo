"""Two runs over the same corpus must produce byte-identical tables.

Reproducibility is a hard requirement for the journal: an independent verifier
runs the committed protocol over the deposited corpus and must obtain the very
files the manuscript reports. Anything that leaks run-to-run variation —
dictionary iteration order, an unseeded sample, a timestamp written into a
table — shows up here as a byte difference.

The manual-validation templates matter most: they are drawn with
``DataFrame.sample``, so the run is only reproducible while the documented seed
is applied. The fixture forces a sample size below the population so the draw
is real and not a pass-through of every row.

Both runs use the committed fixture protocol and fixture corpus (see
``tests/conftest.py``): the author's 79-PDF corpus is gitignored and will not
exist on a fresh clone.
"""

from __future__ import annotations

import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path

import pytest
from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from review_miner.export import ZIP_EPOCH
from review_miner.protocol import load_protocol
from review_miner.publication_pipeline import run_publication_pipeline

# Small enough to force a real stratified draw over the fixture population.
SAMPLE_SIZE = 3

# Compared as bytes. Nothing is excluded: every text artifact the pipeline
# writes must be reproducible, and the workbooks are compared too — by their
# own test below, since a zip needs `zipfile` rather than a byte sweep.
COMPARED_SUFFIXES = (".csv", ".svg", ".json")


@pytest.fixture(scope="module")
def two_runs(protocol_dir: Path, corpus_dir: Path, tmp_path_factory) -> tuple[Path, Path, dict]:
    """The full publication pipeline, run twice into two separate folders."""

    loaded = load_protocol(protocol_dir)
    outputs = []
    results = None
    for label in ("corrida_1", "corrida_2"):
        output_dir = tmp_path_factory.mktemp(label)
        results = run_publication_pipeline(
            protocol=loaded,
            input_dir=corpus_dir,
            output_dir=output_dir,
            sample_size=SAMPLE_SIZE,
        )
        outputs.append(output_dir)
    return outputs[0], outputs[1], results


def compared_files(root: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.suffix in COMPARED_SUFFIXES
    }


def test_the_fixture_corpus_actually_produces_data(two_runs):
    """A vacuous comparison of two empty runs would prove nothing."""

    _, _, results = two_runs
    assert len(results["articles"]) >= 2
    assert results["mentions"], "the fixture corpus produced no mention"
    assert results["relations"], "the fixture corpus produced no A-B relation"


def test_both_runs_write_the_same_file_inventory(two_runs):
    first, second, _ = two_runs

    assert sorted(compared_files(first)) == sorted(compared_files(second))


def test_every_exported_csv_is_byte_identical(two_runs):
    first, second, _ = two_runs
    left = compared_files(first)
    right = compared_files(second)

    csv_names = [name for name in left if name.endswith(".csv")]
    differing = [name for name in csv_names if left[name] != right[name]]
    assert differing == [], f"non-reproducible tables: {differing}"
    # The main exports, the publication extensions and the visual-analytics
    # tables must all be in the comparison, not just the first folder.
    assert len(csv_names) >= 20
    assert any(name.startswith("publication_pipeline/") for name in csv_names)
    assert any(name.startswith("visual_analytics/") for name in csv_names)


def test_every_generated_figure_is_byte_identical(two_runs):
    first, second, _ = two_runs
    left = compared_files(first)
    right = compared_files(second)

    differing = [name for name in left if name.endswith(".svg") and left[name] != right[name]]
    assert differing == [], f"non-reproducible figures: {differing}"


def test_every_exported_workbook_is_byte_identical(two_runs):
    """No spreadsheet may be the one artifact a verifier has to excuse.

    An `.xlsx` embeds two clocks — the workbook's own created/modified
    properties and each zip member's modification time — so an unpinned
    workbook checksums differently on every run even when every cell is the
    same. `export.pin_workbook_timestamps` fixes both.

    Discovered by walking the tree rather than named one by one: the pipeline
    writes workbooks from two different modules, and the second one went
    unpinned precisely because a test that named only the first still passed.
    """

    first, second, _ = two_runs
    workbooks = sorted(path.relative_to(first) for path in first.rglob("*.xlsx"))
    assert len(workbooks) >= 2, f"se esperaban al menos dos workbooks, hay {workbooks}"

    # Every clock is anchored to the constant, never merely compared between
    # the two runs: both stamps have one-second resolution, so two runs a
    # fraction of a second apart agree by accident and an equality-only check
    # would pass whenever the suite happens to be fast.
    epoch = datetime(*ZIP_EPOCH)
    for name in workbooks:
        left, right = first / name, second / name
        assert right.exists(), f"{name}: falta en la segunda corrida"

        for path in (left, right):
            properties = load_workbook(path).properties
            assert properties.created == epoch, f"{name}: created sin fijar ({properties.created})"
            assert properties.modified == epoch, f"{name}: modified sin fijar ({properties.modified})"

        with zipfile.ZipFile(left) as a, zipfile.ZipFile(right) as b:
            assert a.namelist() == b.namelist(), f"{name}: inventario distinto"
            drifting = [member for member in a.namelist() if a.read(member) != b.read(member)]
            assert drifting == [], f"{name}: miembros no reproducibles {drifting}"
            stamps = {i.date_time for i in a.infolist()} | {i.date_time for i in b.infolist()}
            assert stamps == {ZIP_EPOCH}, f"{name}: fechas de miembro sin fijar {sorted(stamps)}"

        assert left.read_bytes() == right.read_bytes(), f"{name}: bytes distintos"


def test_every_exported_json_is_byte_identical(two_runs):
    """Including the ones that describe where the run put its own files.

    `visual_analytics_summary.json` used to record each figure's ABSOLUTE
    path, which named the machine that produced the run: it leaked the
    author's directory layout into a published artifact and made this the one
    file two runs of the same study could never match. The paths are relative
    to the run folder now, so it belongs in the sweep like everything else.
    """

    first, second, _ = two_runs
    left = compared_files(first)
    right = compared_files(second)

    json_names = [name for name in left if name.endswith(".json")]
    differing = [name for name in json_names if left[name] != right[name]]
    assert differing == [], f"non-reproducible json: {differing}"
    assert "review_miner_results.json" in json_names
    assert any(name.endswith("visual_analytics_summary.json") for name in json_names)


def test_the_run_summary_names_no_absolute_path(two_runs):
    """A published artifact must not carry the producing machine's layout."""

    first, _, _ = two_runs
    summaries = list(first.rglob("visual_analytics_summary.json"))
    assert summaries, "no se escribio visual_analytics_summary.json"

    summary = summaries[0]
    report = json.loads(summary.read_text(encoding="utf-8"))
    outputs = report["outputs"]
    assert outputs, "el resumen no registro ninguna figura"
    absolute = {key: value for key, value in outputs.items() if value.startswith("/")}
    assert absolute == {}, f"rutas absolutas en el resumen: {absolute}"
    # Relative to the summary's own folder, and each one must still resolve.
    missing = {key: value for key, value in outputs.items() if not (summary.parent / value).exists()}
    assert missing == {}, f"rutas que no resuelven: {missing}"


def test_the_publication_summary_is_byte_identical(two_runs):
    """It records the seed and the realized sample size — both must be stable."""

    first, second, _ = two_runs
    left = (first / "publication_pipeline" / "publication_pipeline_summary.json").read_bytes()
    right = (second / "publication_pipeline" / "publication_pipeline_summary.json").read_bytes()

    assert left == right


@pytest.mark.parametrize(
    "template", ["manual_validation_entity_roles", "manual_validation_relations"]
)
def test_the_seeded_manual_validation_sample_is_a_real_draw_and_is_stable(two_runs, template):
    first, second, results = two_runs
    population = {
        "manual_validation_entity_roles": len(results["summaries"]),
        "manual_validation_relations": len(results["relations"]),
    }[template]

    left = (first / "publication_pipeline" / f"{template}.csv").read_text(encoding="utf-8")
    right = (second / "publication_pipeline" / f"{template}.csv").read_text(encoding="utf-8")
    drawn = left.splitlines()

    # A template that simply copied every row would be identical between runs
    # whatever the seed did, so check the draw really subsampled first.
    assert population > SAMPLE_SIZE, f"{template}: fixture population too small to sample"
    assert 1 < len(drawn) <= SAMPLE_SIZE + 1  # header + at most SAMPLE_SIZE rows
    assert left == right
