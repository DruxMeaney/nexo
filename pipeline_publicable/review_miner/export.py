"""Export tables (CSV + XLSX + JSON) for a protocol-driven run.

Column naming follows the new generic convention: every Variable-A field
is prefixed ``entity_a_``, every Variable-B field is prefixed ``entity_b_``.
The systematic-review table additionally exposes human-friendly Spanish
headers driven by the protocol's display labels — for example, a protocol
with Variable A = "Contaminantes" produces a column ``"Contaminantes detectados"``
where the legacy pipeline used to hard-code ``"Contaminante detectado"``.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

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
            "role": summary.role,
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


def systematic_table_rows(
    summaries_a: list[EntitySummary],
    summaries_b: list[EntitySummary],
    relations: list[Relation],
    articles_by_id: dict[str, Article],
    protocol: Protocol,
) -> list[dict[str, object]]:
    """Long table with one row per (article, A-entity, B-entity) combination.

    Spanish column headers are built from the protocol's display names so a
    bilingual protocol named "Fármacos / Efectos adversos" yields columns
    like ``"Farmacos detectados"`` and ``"Efectos adversos asociados"`` out
    of the box.
    """

    name_a = protocol.variable_a.display_name
    name_b = protocol.variable_b.display_name
    col_a_detected = f"{name_a} detectad{_o_a(name_a)}"
    col_a_category = f"Categoria de {name_a.lower()}"
    col_b_associated = f"{name_b} asociad{_o_a(name_b)}"
    col_relation = f"Asociacion {name_a.lower()}-{name_b.lower()}"

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
                    col_b_associated: "no detectado",
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
                    col_b_associated: summary_b.label_es or summary_b.label_en,
                    "Tipo de estudio": article.article_kind if article else "",
                    "Modelo experimental": summary_a.study_context,
                    "Evidencia textual": relation.evidence_text if relation else summary_a.evidence_text,
                    "Nivel de confianza": relation.confidence if relation else "Baja",
                    col_relation: relation.association if relation else "sin_evidencia_suficiente",
                    "Seccion de evidencia": relation.section if relation else "",
                    "Extraccion o inferencia": relation.extraction_or_inference
                    if relation
                    else "extraccion_literal_sin_relacion_directa",
                }
            )
    return rows


def _o_a(word: str) -> str:
    """Crude Spanish gender suffix: ``"o"`` unless the word ends in ``"a"``/"e"``.

    Used only for the systematic-review column headers (Contaminantes
    detectados, Enfermedades detectadas...). It's a heuristic; the protocol
    author can override columns by post-processing if exact wording matters.
    """

    word = word.strip().lower()
    if word.endswith("a") or word.endswith("e"):
        return "a"
    return "o"


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
        "articles": pd.DataFrame(_clean_rows(articles_to_rows(articles))),
        "mentions": pd.DataFrame(_clean_rows(mentions_to_rows(mentions))),
        "entity_summaries": pd.DataFrame(_clean_rows(summaries_to_rows(summaries))),
        "relations": pd.DataFrame(_clean_rows(relations_to_rows(relations, articles_by_id))),
        "systematic_review_table": pd.DataFrame(
            _clean_rows(systematic_table_rows(summaries_a, summaries_b, relations, articles_by_id, protocol))
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
    paths["excel"] = excel_path

    json_path = output / "review_miner_results.json"
    payload = {
        "protocol": {
            "name": protocol.identity.name,
            "variable_a": protocol.variable_a.display_name,
            "variable_b": protocol.variable_b.display_name,
        },
        "articles": articles_to_rows(articles),
        "entity_summaries": summaries_to_rows(summaries),
        "relations": relations_to_rows(relations, articles_by_id),
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=_safe), encoding="utf-8")
    paths["json"] = json_path
    return paths
