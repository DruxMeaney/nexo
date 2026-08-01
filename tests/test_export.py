"""The exported column set is a published interface — pin it.

`visual_analytics.py`, `scripts/generate_review_report.py` and the results
browser all read these CSVs by column name, and the audit found two consumers
broken by a silent rename. Any change to a header must therefore break this
file first, so the rename is a deliberate act with a matching update in every
consumer rather than a table that quietly loads with a missing column.

Also pinned here:
  * `relations.csv` uses the generic ``entity_a_*`` / ``entity_b_*`` slots and
    never the domain words the legacy pipeline hard-coded;
  * the Spanish headers of the systematic-review table stay grammatical for a
    plural variable name (the audit found "Contaminantes detectado" and
    "Enfermedades asociado" shipped);
  * a row whose (A, B) pair has no backing :class:`Relation` carries no
    evidence text at all — never another pair's;
  * `review_miner_results.json` carries the protocol block with both display
    names.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from review_miner.export import ARTICLE_COLUMNS, export_all, systematic_table_columns
from review_miner.protocol import Protocol, ProtocolIdentity, VariableInfo
from review_miner.schema import Article, EntitySummary, Mention, Relation


# --------------------------------------------------------------------------- #
# Pinned column sets                                                          #
# --------------------------------------------------------------------------- #

ARTICLES_COLUMNS = [
    "article_id",
    "source_path",
    "title",
    "year",
    "doi",
    "metadata_study_type",
    "article_kind",
    "pages",
    "word_count",
    "text_extractable",
]

MENTIONS_COLUMNS = [
    "article_id",
    "source_path",
    "entity_type",
    "entity_id",
    "label_es",
    "label_en",
    "category",
    "matched_text",
    "section",
    "page",
    "cue_exposure",
    "cue_dose",
    "cue_association",
    "cue_speculative",
    "cue_negation",
    "context",
    "sentence",
]

ENTITY_SUMMARIES_COLUMNS = [
    "article_id",
    "entity_type",
    "entity_id",
    "label_es",
    "label_en",
    "category",
    "n_mentions",
    "sections",
    "role",
    "role_label",
    "study_context",
    "confidence",
    "confidence_score",
    "evidence_text",
    "extraction_or_inference",
]

RELATIONS_COLUMNS = [
    "article_id",
    "title",
    "year",
    "doi",
    "entity_a_id",
    "entity_a_label",
    "entity_a_category",
    "entity_b_id",
    "entity_b_label",
    "entity_b_category",
    "association",
    "confidence",
    "confidence_score",
    "study_context",
    "section",
    "evidence_text",
    "extraction_or_inference",
]

# Columns of the systematic-review table that do not depend on the protocol's
# display names. The name-driven ones are asserted separately.
SYSTEMATIC_FIXED_COLUMNS = [
    "ID del articulo",
    "Titulo",
    "Año",
    "DOI",
    "Numero de menciones",
    "Rol de la variable A",
    "Rol de la variable B",
    "Tipo de estudio",
    "Modelo experimental",
    "Evidencia textual",
    "Nivel de confianza",
    "Seccion de evidencia",
    "Extraccion o inferencia",
]

# Domain words the generic pipeline must never reintroduce as column names.
FORBIDDEN_COLUMN_WORDS = ("contaminant", "contaminante", "disease", "enfermedad")

# A plural Spanish noun followed by a bare masculine singular participle:
# "Contaminantes detectado", "Enfermedades asociado". The audit found both.
UNGRAMMATICAL_HEADER = re.compile(
    r"(?i)\w+(?:es|s)\s+"
    r"(detectado|asociado|analizado|estudiado|identificado|encontrado|relacionado|observado|medido)"
    r"\s*$"
)


# --------------------------------------------------------------------------- #
# Fixtures                                                                    #
# --------------------------------------------------------------------------- #


def build_protocol(name_a: str = "Contaminantes", name_b: str = "Enfermedades") -> Protocol:
    return Protocol(
        identity=ProtocolIdentity(name="Protocolo de prueba", corpus_language="bilingual"),
        variable_a=VariableInfo("a", name_a, "Contaminants", "hierarchical"),
        variable_b=VariableInfo("b", name_b, "Diseases", "flat"),
    )


def build_article() -> Article:
    return Article(
        article_id="A01",
        source_path="corpus/A01.txt",
        title="Plomo y Parkinson en una cohorte ocupacional",
        year="2019",
        doi="10.1000/ejemplo.1",
        metadata_study_type="cohort",
        text="texto",
        pages=4,
        word_count=1200,
        article_kind="human_epidemiological",
    )


def build_mention(entity_id: str, slot: str) -> Mention:
    return Mention(
        article_id="A01",
        source_path="corpus/A01.txt",
        entity_type=slot,
        entity_id=entity_id,
        label_es=f"{entity_id} es",
        label_en=f"{entity_id} en",
        category=f"cat_{slot}",
        matched_text=entity_id,
        section="results",
        start=10,
        end=20,
        page=2,
        context=f"contexto de {entity_id}",
        sentence=f"Oracion de {entity_id}.",
        is_generic=False,
        cue_exposure=True,
    )


def build_summary(entity_id: str, slot: str, evidence: str) -> EntitySummary:
    return EntitySummary(
        article_id="A01",
        entity_type=slot,
        entity_id=entity_id,
        label_es=f"{entity_id} es",
        label_en=f"{entity_id} en",
        category=f"cat_{slot}",
        n_mentions=3,
        sections={"results": 3},
        role="role_probable_focus",
        study_context="Analizado en poblacion humana o estudio epidemiologico",
        confidence="Media",
        confidence_score=11,
        evidence_text=evidence,
        inference_basis="inferencia_contextual_con_evidencia_textual",
    )


def build_relation(entity_a: str, entity_b: str, evidence: str) -> Relation:
    return Relation(
        article_id="A01",
        entity_a_id=entity_a,
        entity_a_label=f"{entity_a} es",
        entity_a_category="cat_a",
        entity_b_id=entity_b,
        entity_b_label=f"{entity_b} es",
        entity_b_category="cat_b",
        association="asociacion_fuerte",
        confidence="Alta",
        confidence_score=21,
        section="results",
        evidence_text=evidence,
        extraction_or_inference="inferencia_contextual_con_evidencia_textual",
        study_context="Analizado en poblacion humana o estudio epidemiologico",
    )


def read_table(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        header = list(reader.fieldnames or [])
        return header, [dict(row) for row in reader]


@pytest.fixture()
def exported(tmp_path):
    """One article, two A entities, one B entity, and a relation for (a1, b1) only."""

    protocol = build_protocol()
    articles = [build_article()]
    mentions = [build_mention("plomo", "a"), build_mention("cadmio", "a"), build_mention("parkinson", "b")]
    summaries = [
        build_summary("plomo", "a", "EVIDENCIA RESUMEN PLOMO"),
        build_summary("cadmio", "a", "EVIDENCIA RESUMEN CADMIO"),
        build_summary("parkinson", "b", "EVIDENCIA RESUMEN PARKINSON"),
    ]
    relations = [build_relation("plomo", "parkinson", "EVIDENCIA DEL PAR PLOMO-PARKINSON")]

    paths = export_all(tmp_path, articles, mentions, summaries, relations, protocol)
    return {"paths": paths, "protocol": protocol, "dir": tmp_path}


# --------------------------------------------------------------------------- #
# Exact column sets                                                           #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "table,expected",
    [
        ("articles", ARTICLES_COLUMNS),
        ("mentions", MENTIONS_COLUMNS),
        ("entity_summaries", ENTITY_SUMMARIES_COLUMNS),
        ("relations", RELATIONS_COLUMNS),
    ],
)
def test_exported_table_has_exactly_the_pinned_columns(exported, table, expected):
    header, rows = read_table(exported["dir"] / f"{table}.csv")

    assert header == expected
    assert rows, f"{table}.csv has no data row, the column check would be vacuous"


def test_every_expected_csv_is_written(exported):
    written = {path.name for path in exported["dir"].glob("*.csv")}
    assert written == {
        "articles.csv",
        "mentions.csv",
        "entity_summaries.csv",
        "relations.csv",
        "systematic_review_table.csv",
    }


def test_relations_use_the_generic_entity_slots(exported):
    header, _ = read_table(exported["dir"] / "relations.csv")

    assert [column for column in header if column.startswith("entity_a_")] == [
        "entity_a_id",
        "entity_a_label",
        "entity_a_category",
    ]
    assert [column for column in header if column.startswith("entity_b_")] == [
        "entity_b_id",
        "entity_b_label",
        "entity_b_category",
    ]
    lowered = " ".join(header).lower()
    for word in FORBIDDEN_COLUMN_WORDS:
        assert word not in lowered, f"'{word}' leaked back into relations.csv headers"


def test_no_machine_readable_table_names_a_column_after_the_domain(exported):
    for name in ("articles", "mentions", "entity_summaries", "relations"):
        header, _ = read_table(exported["dir"] / f"{name}.csv")
        lowered = " ".join(header).lower()
        for word in FORBIDDEN_COLUMN_WORDS:
            assert word not in lowered, f"'{word}' leaked into {name}.csv headers"


def test_relation_row_carries_its_evidence_and_scores(exported):
    _, rows = read_table(exported["dir"] / "relations.csv")

    assert len(rows) == 1
    row = rows[0]
    assert row["entity_a_id"] == "plomo"
    assert row["entity_b_id"] == "parkinson"
    assert row["evidence_text"] == "EVIDENCIA DEL PAR PLOMO-PARKINSON"
    assert row["association"] == "asociacion_fuerte"
    assert row["confidence_score"] == "21"
    # Article metadata is joined in, so a reader can cite the row directly.
    assert row["doi"] == "10.1000/ejemplo.1"


# --------------------------------------------------------------------------- #
# Systematic-review table: Spanish headers                                    #
# --------------------------------------------------------------------------- #


def test_systematic_table_headers_are_grammatical_for_a_plural_variable_name(exported):
    header, _ = read_table(exported["dir"] / "systematic_review_table.csv")

    assert header == [
        "ID del articulo",
        "Titulo",
        "Año",
        "DOI",
        "Variable A: Contaminantes",
        "Categoria de contaminantes",
        "Numero de menciones",
        "Rol de la variable A",
        "Variable B: Enfermedades",
        "Rol de la variable B",
        "Tipo de estudio",
        "Modelo experimental",
        "Evidencia textual",
        "Nivel de confianza",
        "Asociacion contaminantes-enfermedades",
        "Seccion de evidencia",
        "Extraccion o inferencia",
    ]
    assert set(SYSTEMATIC_FIXED_COLUMNS).issubset(header)


@pytest.mark.parametrize(
    "name_a,name_b",
    [
        ("Contaminantes", "Enfermedades"),
        ("Farmacos", "Reacciones adversas"),
        ("Especies invasoras", "Ecosistemas"),
    ],
)
def test_no_header_ends_in_a_bare_singular_participle_after_a_plural_noun(tmp_path, name_a, name_b):
    protocol = build_protocol(name_a, name_b)
    articles = [build_article()]
    summaries = [
        build_summary("plomo", "a", "evidencia a"),
        build_summary("parkinson", "b", "evidencia b"),
    ]
    export_all(tmp_path, articles, [], summaries, [], protocol)

    header, _ = read_table(tmp_path / "systematic_review_table.csv")

    offenders = [column for column in header if UNGRAMMATICAL_HEADER.search(column)]
    assert offenders == [], f"ungrammatical headers for '{name_a}'/'{name_b}': {offenders}"
    # The variable name must still be visible in the table, otherwise a
    # reviewer cannot tell which column holds which variable.
    assert any(name_a in column for column in header)
    assert any(name_b in column for column in header)


def test_the_regex_that_guards_the_headers_really_catches_the_shipped_defect():
    """Guard the guard: the audit's exact strings must match the detector."""

    assert UNGRAMMATICAL_HEADER.search("Contaminantes detectado")
    assert UNGRAMMATICAL_HEADER.search("Enfermedades asociado")
    assert not UNGRAMMATICAL_HEADER.search("Variable A: Contaminantes")
    assert not UNGRAMMATICAL_HEADER.search("Contaminante detectado")  # singular is fine


def test_two_variables_with_the_same_display_name_keep_two_columns(tmp_path):
    """Naming both variables the same must not cost a column.

    The four protocol-driven headers embed the display name in distinct
    templates, so identical names cannot collide today. What this pins is the
    property that matters downstream — the table still carries the FULL column
    set, and both slots remain separately addressable — so a future rename of
    those templates into a colliding shape fails here instead of silently
    dropping a column from every exported study.
    """

    protocol = build_protocol("Sustancias", "Sustancias")
    summaries = [
        build_summary("plomo", "a", "evidencia a"),
        build_summary("parkinson", "b", "evidencia b"),
    ]
    export_all(tmp_path, [build_article()], [], summaries, [], protocol)

    header, rows = read_table(tmp_path / "systematic_review_table.csv")

    assert header == systematic_table_columns(protocol), (
        "the exported header drifted from the schema the protocol declares"
    )
    assert len(header) == len(set(header)), "a duplicated header collapsed a column"
    # A row must still carry both slots independently: same display name, two
    # separately addressable cells. Located by prefix, never by position.
    slot_a = next(c for c in header if c.startswith("Variable A:"))
    slot_b = next(c for c in header if c.startswith("Variable B:"))
    assert slot_a != slot_b
    assert rows[0][slot_a] == "plomo es"
    assert rows[0][slot_b] == "parkinson es"


# --------------------------------------------------------------------------- #
# Rows without a backing relation                                             #
# --------------------------------------------------------------------------- #


def test_a_pair_without_a_relation_carries_no_evidence_at_all(exported):
    _, rows = read_table(exported["dir"] / "systematic_review_table.csv")

    by_a = {row["Variable A: Contaminantes"]: row for row in rows}
    assert set(by_a) == {"plomo es", "cadmio es"}

    backed = by_a["plomo es"]
    unbacked = by_a["cadmio es"]

    assert backed["Evidencia textual"] == "EVIDENCIA DEL PAR PLOMO-PARKINSON"
    assert backed["Asociacion contaminantes-enfermedades"] == "asociacion_fuerte"
    assert backed["Nivel de confianza"] == "Alta"

    # The unbacked row must not borrow the other pair's evidence, and must not
    # pass off the A entity's own snippet as evidence about the pair either.
    assert unbacked["Evidencia textual"] == ""
    assert unbacked["Nivel de confianza"] == ""
    assert unbacked["Seccion de evidencia"] == ""
    assert unbacked["Asociacion contaminantes-enfermedades"] == "sin_evidencia_suficiente"
    assert unbacked["Extraccion o inferencia"] == "extraccion_literal_sin_relacion_directa"
    for row in rows:
        assert "EVIDENCIA RESUMEN" not in row["Evidencia textual"]


def test_an_article_with_no_variable_b_entity_still_produces_a_row(tmp_path):
    protocol = build_protocol()
    summaries = [build_summary("plomo", "a", "evidencia solo A")]
    export_all(tmp_path, [build_article()], [], summaries, [], protocol)

    _, rows = read_table(tmp_path / "systematic_review_table.csv")

    assert len(rows) == 1
    assert rows[0]["Variable B: Enfermedades"] == "no detectado"
    assert rows[0]["Asociacion contaminantes-enfermedades"] == "no detectado"


# --------------------------------------------------------------------------- #
# JSON export                                                                 #
# --------------------------------------------------------------------------- #


def test_results_json_carries_the_protocol_block_with_both_display_names(exported):
    payload = json.loads((exported["dir"] / "review_miner_results.json").read_text(encoding="utf-8"))

    assert set(payload) >= {"protocol", "articles", "entity_summaries", "relations"}
    protocol_block = payload["protocol"]
    assert protocol_block["name"] == "Protocolo de prueba"
    assert protocol_block["variable_a"] == "Contaminantes"
    assert protocol_block["variable_b"] == "Enfermedades"


def test_results_json_rows_use_the_same_keys_as_the_csvs(exported):
    payload = json.loads((exported["dir"] / "review_miner_results.json").read_text(encoding="utf-8"))

    assert list(payload["articles"][0]) == ARTICLES_COLUMNS
    assert list(payload["entity_summaries"][0]) == ENTITY_SUMMARIES_COLUMNS
    assert list(payload["relations"][0]) == RELATIONS_COLUMNS


def test_excel_workbook_carries_every_table(exported):
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.load_workbook(exported["dir"] / "review_miner_results.xlsx", read_only=True)

    assert set(workbook.sheetnames) == {
        "articles",
        "mentions",
        "entity_summaries",
        "relations",
        "systematic_review_table",
    }


# --------------------------------------------------------------------------- #
# Zero-article export                                                         #
# --------------------------------------------------------------------------- #


def test_articles_header_is_pinned_even_when_no_article_was_read(tmp_path):
    """A run over an empty input folder must still declare the full schema.

    Every other table is pinned indirectly, because a populated run and an
    empty run are compared against each other. ``articles.csv`` is not: every
    other test feeds at least one article, so ``ARTICLE_COLUMNS`` is only ever
    exercised on a zero-article run. Without this test, dropping a field from
    the constant leaves the whole suite green and an empty run silently emits
    a header its consumers cannot read.
    """

    export_all(tmp_path, [], [], [], [], build_protocol())

    header, rows = read_table(tmp_path / "articles.csv")

    assert rows == []
    assert header == ARTICLES_COLUMNS
    # The constant the empty path writes from must equal the schema the
    # populated path produces — one source of truth, asserted from both ends.
    assert list(ARTICLE_COLUMNS) == ARTICLES_COLUMNS
