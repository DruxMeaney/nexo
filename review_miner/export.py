"""Export tables (CSV + XLSX + JSON) for a protocol-driven run.

Column naming follows the new generic convention: every Variable-A field
is prefixed ``entity_a_``, every Variable-B field is prefixed ``entity_b_``.
The systematic-review table additionally exposes human-friendly Spanish
headers driven by the protocol's display labels — for example, a protocol
with Variable A = "Contaminantes" produces a column ``"Variable A: Contaminantes"``
where the legacy pipeline used to hard-code ``"Contaminante detectado"``. The
header carries no adjective, so it stays grammatical for any display name.

Role IDs are exported twice on purpose. The machine key (`role`, e.g.
``role_intro_discussion_only``) stays untouched — other modules and the
manual-validation codebook join on it — and a parallel `role_label` column
carries the Spanish phrase from :data:`classify.ROLE_LABELS_ES`. The
systematic-review table, which is entirely human-facing (Spanish headers, one
row per article/A/B triple), prints only the phrase.
"""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

import pandas as pd

from .classify import role_label_es
from .protocol import Protocol
from .schema import Article, EntitySummary, Mention, Relation


ILLEGAL_EXCEL_CHARS = {
    ord(char): None
    for char in "".join(chr(i) for i in range(32))
    if char not in "\t\n\r"
}


def _safe(value):
    if isinstance(value, str):
        return value.translate(ILLEGAL_EXCEL_CHARS)[:32000]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return json.dumps(value, ensure_ascii=False)


def _clean_rows(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    return [{key: _safe(value) for key, value in row.items()} for row in rows]


# Exported schema of every table. `pd.DataFrame([])` builds a ZERO-COLUMN frame
# and `to_csv` then writes a bare newline: a run that found nothing used to
# leave `mentions.csv`, `entity_summaries.csv` and `relations.csv` without even
# a header row, which is not a table any consumer can read (pandas raises
# `EmptyDataError`, and a spreadsheet shows an empty file rather than an empty
# result). The lists below are the header those files keep when they have no
# rows; they must stay in step with the row builders above.
ARTICLE_COLUMNS = [
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

MENTION_COLUMNS = [
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

ENTITY_SUMMARY_COLUMNS = [
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

RELATION_COLUMNS = [
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


def _frame(rows: list[dict[str, object]], columns: list[str]) -> pd.DataFrame:
    """Rows as a DataFrame, keeping the header when there are none.

    The populated case is built from the rows themselves, exactly as before, so
    the declared column list can never drop or reorder a column of a real run.
    """

    if rows:
        return pd.DataFrame(rows)
    return pd.DataFrame(columns=columns)


# --------------------------------------------------------------------------- #
# Row builders                                                                #
# --------------------------------------------------------------------------- #


def articles_to_rows(articles: list[Article]) -> list[dict[str, object]]:
    return [
        {
            "article_id": article.article_id,
            "source_path": article.source_path,
            "title": article.title,
            "year": article.year,
            "doi": article.doi,
            "metadata_study_type": article.metadata_study_type,
            "article_kind": article.article_kind,
            "pages": article.pages,
            "word_count": article.word_count,
            "text_extractable": "Si" if article.text_extractable else "No",
        }
        for article in articles
    ]


def mentions_to_rows(mentions: list[Mention]) -> list[dict[str, object]]:
    return [
        {
            "article_id": mention.article_id,
            "source_path": mention.source_path,
            "entity_type": mention.entity_type,
            "entity_id": mention.entity_id,
            "label_es": mention.label_es,
            "label_en": mention.label_en,
            "category": mention.category,
            "matched_text": mention.matched_text,
            "section": mention.section,
            "page": mention.page,
            "cue_exposure": "Si" if mention.cue_exposure else "No",
            "cue_dose": "Si" if mention.cue_dose else "No",
            "cue_association": "Si" if mention.cue_association else "No",
            "cue_speculative": "Si" if mention.cue_speculative else "No",
            "cue_negation": "Si" if mention.cue_negation else "No",
            "context": mention.context,
            "sentence": mention.sentence,
        }
        for mention in mentions
    ]


def summaries_to_rows(summaries: list[EntitySummary]) -> list[dict[str, object]]:
    return [
        {
            "article_id": summary.article_id,
            "entity_type": summary.entity_type,
            "entity_id": summary.entity_id,
            "label_es": summary.label_es,
            "label_en": summary.label_en,
            "category": summary.category,
            "n_mentions": summary.n_mentions,
            "sections": json.dumps(summary.sections, ensure_ascii=False),
            # `role` is the stable machine key (join key for the manual
            # validation codebook); `role_label` is the same value written for
            # a human reader. Never one without the other.
            "role": summary.role,
            "role_label": role_label_es(summary.role),
            "study_context": summary.study_context,
            "confidence": summary.confidence,
            "confidence_score": summary.confidence_score,
            "evidence_text": summary.evidence_text,
            "extraction_or_inference": summary.inference_basis,
        }
        for summary in summaries
    ]


def relations_to_rows(
    relations: list[Relation],
    articles_by_id: dict[str, Article],
) -> list[dict[str, object]]:
    rows = []
    for relation in relations:
        article = articles_by_id.get(relation.article_id)
        rows.append(
            {
                "article_id": relation.article_id,
                "title": article.title if article else "",
                "year": article.year if article else "",
                "doi": article.doi if article else "",
                "entity_a_id": relation.entity_a_id,
                "entity_a_label": relation.entity_a_label,
                "entity_a_category": relation.entity_a_category,
                "entity_b_id": relation.entity_b_id,
                "entity_b_label": relation.entity_b_label,
                "entity_b_category": relation.entity_b_category,
                "association": relation.association,
                "confidence": relation.confidence,
                "confidence_score": relation.confidence_score,
                "study_context": relation.study_context,
                "section": relation.section,
                "evidence_text": relation.evidence_text,
                "extraction_or_inference": relation.extraction_or_inference,
            }
        )
    return rows


def _protocol_columns(protocol: Protocol) -> list[str]:
    """The four systematic-table headers built from the protocol display names.

    The row dicts are literals: two identical keys would silently collapse into
    one column, so the headers are de-duplicated before use.
    """

    name_a = protocol.variable_a.display_name
    name_b = protocol.variable_b.display_name
    return _unique_columns(
        f"Variable A: {name_a}",
        f"Categoria de {name_a.lower()}",
        f"Variable B: {name_b}",
        f"Asociacion {name_a.lower()}-{name_b.lower()}",
    )


def systematic_table_columns(protocol: Protocol) -> list[str]:
    """Header of the systematic-review table, in order, for this protocol.

    Kept next to :func:`systematic_table_rows` because it is the header that
    table must show when a run produced no row at all.
    """

    col_a_detected, col_a_category, col_b_associated, col_relation = _protocol_columns(protocol)
    return [
        "ID del articulo",
        "Titulo",
        "Año",
        "DOI",
        col_a_detected,
        col_a_category,
        "Numero de menciones",
        "Rol de la variable A",
        col_b_associated,
        "Rol de la variable B",
        "Tipo de estudio",
        "Modelo experimental",
        "Evidencia textual",
        "Nivel de confianza",
        col_relation,
        "Seccion de evidencia",
        "Extraccion o inferencia",
    ]


def systematic_table_rows(
    summaries_a: list[EntitySummary],
    summaries_b: list[EntitySummary],
    relations: list[Relation],
    articles_by_id: dict[str, Article],
    protocol: Protocol,
) -> list[dict[str, object]]:
    """Long table with one row per (article, A-entity, B-entity) combination.

    Spanish column headers are built from the protocol's display names with a
    slot prefix, so a protocol named "Fármacos / Efectos adversos" yields
    ``"Variable A: Fármacos"`` and ``"Variable B: Efectos adversos"``. The
    prefix carries the grammar the display name cannot (no gender or number
    agreement is needed) and keeps both columns distinct even when a protocol
    gives its two variables the same name.

    Rows for a pair that no :class:`Relation` backs are still emitted — the
    table is a cross product by design — but they carry no evidence text and
    no confidence level, because the only evidence available there is the
    A entity's own snippet, which says nothing about the pair.

    This table is read by people, never joined on: the role columns therefore
    print the Spanish label and not the ``role_*`` ID. The IDs remain in
    `entity_summaries` (columns ``role`` and ``role_label``) for any code or
    validation step that needs the machine key.
    """

    col_a_detected, col_a_category, col_b_associated, col_relation = _protocol_columns(protocol)

    relation_lookup = {(r.article_id, r.entity_a_id, r.entity_b_id): r for r in relations}
    b_by_article: dict[str, list[EntitySummary]] = {}
    for summary in summaries_b:
        b_by_article.setdefault(summary.article_id, []).append(summary)

    rows = []
    for summary_a in summaries_a:
        article = articles_by_id.get(summary_a.article_id)
        related_b = b_by_article.get(summary_a.article_id, [])
        if not related_b:
            rows.append(
                {
                    "ID del articulo": summary_a.article_id,
                    "Titulo": article.title if article else "",
                    "Año": article.year if article else "",
                    "DOI": article.doi if article else "",
                    col_a_detected: summary_a.label_es or summary_a.label_en,
                    col_a_category: summary_a.category,
                    "Numero de menciones": summary_a.n_mentions,
                    "Rol de la variable A": role_label_es(summary_a.role),
                    col_b_associated: "no detectado",
                    "Rol de la variable B": "no detectado",
                    "Tipo de estudio": article.article_kind if article else "",
                    "Modelo experimental": summary_a.study_context,
                    "Evidencia textual": summary_a.evidence_text,
                    "Nivel de confianza": summary_a.confidence,
                    col_relation: "no detectado",
                    "Seccion de evidencia": "",
                    "Extraccion o inferencia": summary_a.inference_basis,
                }
            )
            continue
        for summary_b in related_b:
            relation = relation_lookup.get(
                (summary_a.article_id, summary_a.entity_id, summary_b.entity_id)
            )
            rows.append(
                {
                    "ID del articulo": summary_a.article_id,
                    "Titulo": article.title if article else "",
                    "Año": article.year if article else "",
                    "DOI": article.doi if article else "",
                    col_a_detected: summary_a.label_es or summary_a.label_en,
                    col_a_category: summary_a.category,
                    "Numero de menciones": summary_a.n_mentions,
                    "Rol de la variable A": role_label_es(summary_a.role),
                    col_b_associated: summary_b.label_es or summary_b.label_en,
                    "Rol de la variable B": role_label_es(summary_b.role),
                    "Tipo de estudio": article.article_kind if article else "",
                    "Modelo experimental": summary_a.study_context,
                    "Evidencia textual": relation.evidence_text if relation else "",
                    "Nivel de confianza": relation.confidence if relation else "",
                    col_relation: relation.association if relation else "sin_evidencia_suficiente",
                    "Seccion de evidencia": relation.section if relation else "",
                    "Extraccion o inferencia": relation.extraction_or_inference
                    if relation
                    else "extraccion_literal_sin_relacion_directa",
                }
            )
    return rows


def _unique_columns(*names: str) -> list[str]:
    """Return the given headers with any duplicate disambiguated.

    Column headers come from user-supplied display names, so two of them can
    coincide. Because the rows are dict literals, a repeated key would drop a
    whole column without warning; a numeric suffix keeps every column present
    and the result stays deterministic for a given protocol.
    """

    seen: dict[str, int] = {}
    unique: list[str] = []
    for name in names:
        occurrence = seen.get(name, 0) + 1
        seen[name] = occurrence
        unique.append(name if occurrence == 1 else f"{name} ({occurrence})")
    return unique


# --------------------------------------------------------------------------- #
# Reproducible workbook                                                       #
# --------------------------------------------------------------------------- #
#
# Every other artifact this module writes is a function of the corpus and the
# protocol alone, so two runs of the same study produce byte-identical files
# and a verifier can checksum them. An `.xlsx` is a zip archive, and both
# openpyxl and the zip format record WHEN the file was written: the workbook
# stamps `docProps/core.xml` with the creation instant and every member
# carries its own modification time. Left alone, the spreadsheet is the one
# output whose checksum changes between identical runs — which reads as
# non-determinism to anyone auditing the pipeline, and is the only reason a
# reviewer would need to be told to exclude a file from their comparison.
#
# Both stamps are metadata about the writing, never about the results, so both
# are pinned. The epoch below is the zip format's own floor (it cannot encode
# a year before 1980); its value carries no meaning beyond being constant.

ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)
_EPOCH_XML = "1980-01-01T00:00:00Z"

_CORE_PROPERTIES = "docProps/core.xml"
_DOC_TIMESTAMP = re.compile(
    r"(<dcterms:(?:created|modified)\b[^>]*>)[^<]*(</dcterms:(?:created|modified)>)"
)


def pin_workbook_timestamps(path: Path) -> None:
    """Rewrite ``path`` with both of its clocks fixed.

    Runs after the workbook is saved, which is the only point where both can
    be reached: openpyxl overwrites ``properties.modified`` with the wall
    clock inside its own save, so a value assigned to the in-memory workbook
    beforehand never survives to disk.

    Member order, names and compression are preserved, so the result stays a
    valid `.xlsx`; only the two timestamps in ``docProps/core.xml`` and the
    per-member modification times change.
    """

    with zipfile.ZipFile(path) as archive:
        members = [(info, archive.read(info.filename)) for info in archive.infolist()]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for info, payload in members:
            if info.filename == _CORE_PROPERTIES:
                text = payload.decode("utf-8")
                payload = _DOC_TIMESTAMP.sub(rf"\g<1>{_EPOCH_XML}\g<2>", text).encode("utf-8")
            pinned = zipfile.ZipInfo(info.filename, date_time=ZIP_EPOCH)
            pinned.compress_type = info.compress_type
            pinned.external_attr = info.external_attr
            archive.writestr(pinned, payload)


# --------------------------------------------------------------------------- #
# Main entry point                                                            #
# --------------------------------------------------------------------------- #


def export_all(
    output_dir: str | Path,
    articles: list[Article],
    mentions: list[Mention],
    summaries: list[EntitySummary],
    relations: list[Relation],
    protocol: Protocol,
) -> dict[str, Path]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    articles_by_id = {article.article_id: article for article in articles}
    summaries_a = [s for s in summaries if s.entity_type == "a"]
    summaries_b = [s for s in summaries if s.entity_type == "b"]

    tables = {
        "articles": _frame(_clean_rows(articles_to_rows(articles)), ARTICLE_COLUMNS),
        "mentions": _frame(_clean_rows(mentions_to_rows(mentions)), MENTION_COLUMNS),
        "entity_summaries": _frame(_clean_rows(summaries_to_rows(summaries)), ENTITY_SUMMARY_COLUMNS),
        "relations": _frame(_clean_rows(relations_to_rows(relations, articles_by_id)), RELATION_COLUMNS),
        "systematic_review_table": _frame(
            _clean_rows(systematic_table_rows(summaries_a, summaries_b, relations, articles_by_id, protocol)),
            systematic_table_columns(protocol),
        ),
    }

    paths: dict[str, Path] = {}
    for name, dataframe in tables.items():
        path = output / f"{name}.csv"
        dataframe.to_csv(path, index=False)
        paths[name] = path

    excel_path = output / "review_miner_results.xlsx"
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        for name, dataframe in tables.items():
            sheet_name = name[:31]
            dataframe.to_excel(writer, sheet_name=sheet_name, index=False)
    pin_workbook_timestamps(excel_path)
    paths["excel"] = excel_path

    json_path = output / "review_miner_results.json"
    payload = {
        # Provenance block. `corpus_language` and the two taxonomy modes are
        # declarations by the protocol author that no pipeline stage acts on
        # (see review_miner/protocol.py); they are recorded here so a reader of
        # the results — or a Methods section — can state what the run assumed.
        "protocol": {
            "name": protocol.identity.name,
            "variable_a": protocol.variable_a.display_name,
            "variable_b": protocol.variable_b.display_name,
            "corpus_language": protocol.identity.corpus_language,
            "variable_a_mode": protocol.variable_a.mode,
            "variable_b_mode": protocol.variable_b.mode,
        },
        "articles": articles_to_rows(articles),
        "entity_summaries": summaries_to_rows(summaries),
        "relations": relations_to_rows(relations, articles_by_id),
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=_safe), encoding="utf-8")
    paths["json"] = json_path
    return paths
