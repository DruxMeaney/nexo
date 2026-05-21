from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

from .protocol import Protocol, SectionConfig
from .schema import Article, EntitySummary, Mention, Relation
from .sections import section_weight
from .text import normalize_space


ASSOCIATION_WEIGHT = {
    "asociacion_fuerte": 3.0,
    "asociacion_debil": 2.0,
    "mencion_especulativa": 1.0,
    "sin_evidencia_suficiente": 0.0,
}

CONFIDENCE_WEIGHT = {
    "Alta": 3.0,
    "Media": 2.0,
    "Baja": 1.0,
}

SECTION_PROFILES = {
    "baseline_current": {
        "title": 5,
        "abstract": 4,
        "methods": 6,
        "results": 5,
        "discussion": 2,
        "conclusion": 2,
        "introduction": 1,
        "references": -3,
        "other": 1,
    },
    "conservative_evidence": {
        "title": 3,
        "abstract": 3,
        "methods": 7,
        "results": 6,
        "discussion": 1,
        "conclusion": 1,
        "introduction": 0,
        "references": -5,
        "other": 0,
    },
    "neutral_counting": {
        "title": 1,
        "abstract": 1,
        "methods": 1,
        "results": 1,
        "discussion": 1,
        "conclusion": 1,
        "introduction": 1,
        "references": 0,
        "other": 1,
    },
    "central_sections_only": {
        "title": 1,
        "abstract": 1,
        "methods": 1,
        "results": 1,
        "discussion": 0,
        "conclusion": 0,
        "introduction": 0,
        "references": -1,
        "other": 0,
    },
}

ILLEGAL_EXCEL_CHARS = {
    ord(char): None
    for char in "".join(chr(i) for i in range(32))
    if char not in "\t\n\r"
}


def _yes_no(value: bool) -> str:
    return "Si" if value else "No"


def _clip(value: object, limit: int = 32000) -> str:
    return normalize_space("" if value is None else str(value)).translate(ILLEGAL_EXCEL_CHARS)[:limit]


def _clean_dataframe(dataframe: pd.DataFrame) -> pd.DataFrame:
    def clean(value: object) -> object:
        if isinstance(value, str):
            return value.translate(ILLEGAL_EXCEL_CHARS)[:32000]
        return value

    return dataframe.apply(lambda column: column.map(clean) if column.dtype == object else column)


def _article_map(articles: list[Article]) -> dict[str, Article]:
    return {article.article_id: article for article in articles}


def _weighted_relation(relation: Relation) -> float:
    return ASSOCIATION_WEIGHT.get(relation.association, 0.0) * CONFIDENCE_WEIGHT.get(relation.confidence, 1.0)


def _sections_dict(summary: EntitySummary) -> dict[str, int]:
    if isinstance(summary.sections, dict):
        return summary.sections
    if not summary.sections:
        return {}
    try:
        data = json.loads(str(summary.sections))
    except json.JSONDecodeError:
        return {}
    return {str(key): int(value) for key, value in data.items()}


def build_kwic_concordance(
    articles: list[Article],
    mentions: list[Mention],
    radius: int = 160,
) -> pd.DataFrame:
    """Build a Keyword-in-Context table for manual audit.

    KWIC is a corpus-linguistics inspired view: it preserves the words around
    each keyword so reviewers can judge whether a mention is experimental,
    epidemiological, speculative, negative or merely bibliographic.
    """

    articles_by_id = _article_map(articles)
    rows: list[dict[str, object]] = []
    for mention in mentions:
        article = articles_by_id.get(mention.article_id)
        text = article.text if article else ""
        left = _clip(text[max(0, mention.start - radius) : mention.start], 900)
        right = _clip(text[mention.end : min(len(text), mention.end + radius)], 900)
        rows.append(
            {
                "article_id": mention.article_id,
                "title": article.title if article else "",
                "year": article.year if article else "",
                "doi": article.doi if article else "",
                "entity_type": mention.entity_type,
                "entity_id": mention.entity_id,
                "label_es": mention.label_es,
                "label_en": mention.label_en,
                "category": mention.category,
                "matched_text": mention.matched_text,
                "section": mention.section,
                "page": mention.page,
                "left_context": left,
                "keyword": mention.matched_text,
                "right_context": right,
                "sentence": _clip(mention.sentence, 1400),
                "cue_exposure": _yes_no(mention.cue_exposure),
                "cue_dose": _yes_no(mention.cue_dose),
                "cue_association": _yes_no(mention.cue_association),
                "cue_speculative": _yes_no(mention.cue_speculative),
                "cue_negation": _yes_no(mention.cue_negation),
            }
        )
    return pd.DataFrame(rows)


def build_term_frequency_tables(
    articles: list[Article],
    mentions: list[Mention],
) -> dict[str, pd.DataFrame]:
    """Build term-count, normalized-frequency and TF-IDF tables.

    This adapts standard bag-of-words / TF-IDF text-mining logic, while keeping
    expert entity labels instead of arbitrary tokens.
    """

    extractable_articles = [article for article in articles if article.text_extractable]
    n_articles = len(extractable_articles)
    word_count_by_article = {article.article_id: max(1, article.word_count) for article in extractable_articles}
    article_ids = [article.article_id for article in extractable_articles]
    article_meta = {
        article.article_id: {
            "title": article.title,
            "year": article.year,
            "doi": article.doi,
            "article_kind": article.article_kind,
            "word_count": article.word_count,
        }
        for article in extractable_articles
    }

    counts: defaultdict[str, defaultdict[str, Counter[str]]] = defaultdict(lambda: defaultdict(Counter))
    entity_info: dict[str, dict[str, str]] = {}
    for mention in mentions:
        term_id = f"{mention.entity_type}::{mention.entity_id}"
        counts[mention.entity_type][mention.article_id][term_id] += 1
        entity_info[term_id] = {
            "entity_type": mention.entity_type,
            "entity_id": mention.entity_id,
            "label_es": mention.label_es,
            "label_en": mention.label_en,
            "category": mention.category,
        }

    all_rows: list[dict[str, object]] = []
    matrices: dict[str, pd.DataFrame] = {}
    for entity_type in ("a", "b"):
        terms = sorted(
            term_id
            for term_id, info in entity_info.items()
            if info["entity_type"] == entity_type
        )
        count_rows = []
        norm_rows = []
        tfidf_rows = []
        df_by_term = {
            term_id: sum(1 for article_id in article_ids if counts[entity_type][article_id].get(term_id, 0) > 0)
            for term_id in terms
        }
        idf_by_term = {
            term_id: math.log((1 + n_articles) / (1 + df_by_term[term_id])) + 1
            for term_id in terms
        }
        for article_id in article_ids:
            count_row = {"article_id": article_id, **article_meta[article_id]}
            norm_row = {"article_id": article_id, **article_meta[article_id]}
            tfidf_row = {"article_id": article_id, **article_meta[article_id]}
            for term_id in terms:
                label = entity_info[term_id]["label_es"]
                column = f"{entity_type}::{label}"
                value = int(counts[entity_type][article_id].get(term_id, 0))
                count_row[column] = value
                norm_row[column] = value / word_count_by_article[article_id] * 10000
                tfidf_row[column] = math.log1p(value) * idf_by_term[term_id]
            count_rows.append(count_row)
            norm_rows.append(norm_row)
            tfidf_rows.append(tfidf_row)

        matrices[f"{entity_type}_article_term_counts"] = pd.DataFrame(count_rows)
        matrices[f"{entity_type}_article_term_per_10k_words"] = pd.DataFrame(norm_rows)
        matrices[f"{entity_type}_article_term_tfidf"] = pd.DataFrame(tfidf_rows)

        for term_id in terms:
            raw_mentions = sum(counts[entity_type][article_id].get(term_id, 0) for article_id in article_ids)
            df = df_by_term[term_id]
            info = entity_info[term_id]
            all_rows.append(
                {
                    "entity_type": entity_type,
                    "entity_id": info["entity_id"],
                    "label_es": info["label_es"],
                    "label_en": info["label_en"],
                    "category": info["category"],
                    "raw_mentions": raw_mentions,
                    "articles_with_mentions": df,
                    "document_frequency": df / n_articles if n_articles else 0,
                    "idf": idf_by_term[term_id],
                    "mentions_per_10k_words_corpus": raw_mentions / sum(word_count_by_article.values()) * 10000
                    if word_count_by_article
                    else 0,
                    "mean_mentions_per_article": raw_mentions / n_articles if n_articles else 0,
                }
            )

    matrices["entity_frequency_summary"] = pd.DataFrame(all_rows).sort_values(
        ["entity_type", "raw_mentions"], ascending=[True, False]
    )
    return matrices


def build_cooccurrence_comparison(
    articles: list[Article],
    mentions: list[Mention],
    relations: list[Relation],
) -> pd.DataFrame:
    """Compare article-level co-occurrence with evidence-window relations.

    This table makes the false-positive control visible: a Variable-A entity
    and a Variable-B entity can co-occur in an article without forming an
    evidence-backed pair.
    """

    articles_by_id = _article_map(articles)
    a_by_article: dict[str, dict[str, Mention]] = defaultdict(dict)
    b_by_article: dict[str, dict[str, Mention]] = defaultdict(dict)
    for mention in mentions:
        if mention.entity_type == "a":
            a_by_article[mention.article_id].setdefault(mention.entity_id, mention)
        elif mention.entity_type == "b":
            b_by_article[mention.article_id].setdefault(mention.entity_id, mention)

    article_pairs: dict[tuple[str, str], set[str]] = defaultdict(set)
    pair_labels: dict[tuple[str, str], dict[str, str]] = {}
    for article_id in set(a_by_article) | set(b_by_article):
        for ent_a in a_by_article.get(article_id, {}).values():
            for ent_b in b_by_article.get(article_id, {}).values():
                key = (ent_a.entity_id, ent_b.entity_id)
                article_pairs[key].add(article_id)
                pair_labels[key] = {
                    "entity_a_label": ent_a.label_es or ent_a.label_en,
                    "entity_a_category": ent_a.category,
                    "entity_b_label": ent_b.label_es or ent_b.label_en,
                    "entity_b_category": ent_b.category,
                }

    evidence_relations: dict[tuple[str, str], list[Relation]] = defaultdict(list)
    evidence_articles: dict[tuple[str, str], set[str]] = defaultdict(set)
    for relation in relations:
        if relation.association == "sin_evidencia_suficiente":
            continue
        key = (relation.entity_a_id, relation.entity_b_id)
        evidence_relations[key].append(relation)
        evidence_articles[key].add(relation.article_id)
        pair_labels.setdefault(
            key,
            {
                "entity_a_label": relation.entity_a_label,
                "entity_a_category": relation.entity_a_category,
                "entity_b_label": relation.entity_b_label,
                "entity_b_category": relation.entity_b_category,
            },
        )

    rows = []
    for key in sorted(set(article_pairs) | set(evidence_relations)):
        article_ids = article_pairs.get(key, set())
        evidence_ids = evidence_articles.get(key, set())
        rels = evidence_relations.get(key, [])
        labels = pair_labels[key]
        rows.append(
            {
                **labels,
                "article_level_n_articles": len(article_ids),
                "evidence_level_n_articles": len(evidence_ids),
                "evidence_level_n_relations": len(rels),
                "weighted_evidence_score": sum(_weighted_relation(relation) for relation in rels),
                "possible_article_level_false_positives": max(0, len(article_ids) - len(evidence_ids)),
                "article_ids_article_level": "; ".join(sorted(article_ids)[:20]),
                "article_ids_evidence_level": "; ".join(sorted(evidence_ids)[:20]),
                "interpretation": (
                    "evidence_backed_pair"
                    if evidence_ids
                    else "article_level_cooccurrence_only_manual_check_required"
                ),
                "example_title": articles_by_id[sorted(article_ids)[0]].title if article_ids and sorted(article_ids)[0] in articles_by_id else "",
            }
        )
    return pd.DataFrame(rows).sort_values(
        ["weighted_evidence_score", "evidence_level_n_articles", "article_level_n_articles"],
        ascending=[False, False, False],
    )


def build_section_weight_tables(
    summaries: list[EntitySummary],
    sections_config: SectionConfig,
) -> dict[str, pd.DataFrame]:
    rows = []
    rationales = {
        "title": "High signal for article focus, but not sufficient evidence alone.",
        "abstract": "Concise summary of study focus and findings.",
        "methods": "Strong signal for actual exposure, dose, population or experimental model.",
        "results": "Strong signal for reported findings and measured outcomes.",
        "discussion": "Interpretive section; useful but may include speculation.",
        "conclusion": "Summary section; useful but often less detailed than results.",
        "introduction": "Background section; higher risk of bibliographic or conceptual mentions.",
        "references": "Bibliographic section; mentions are not treated as direct study evidence.",
        "other": "Unclassified text; low positive weight by default.",
    }
    for section in sorted(SECTION_PROFILES["baseline_current"]):
        rows.append(
            {
                "section": section,
                "current_pipeline_weight": section_weight(section, sections_config),
                "rationale": rationales.get(section, ""),
                "methodological_status": "Heuristic informed by IMRaD/rhetorical-zone literature; not a validated scale.",
            }
        )

    sensitivity_rows = []
    for summary in summaries:
        sections = _sections_dict(summary)
        row = {
            "article_id": summary.article_id,
            "entity_type": summary.entity_type,
            "entity_id": summary.entity_id,
            "label_es": summary.label_es,
            "category": summary.category,
            "role": summary.role,
            "confidence": summary.confidence,
            "n_mentions": summary.n_mentions,
            "sections": json.dumps(sections, ensure_ascii=False),
        }
        for profile_name, weights in SECTION_PROFILES.items():
            row[f"{profile_name}_section_score"] = sum(
                int(count) * weights.get(section, weights.get("other", 0))
                for section, count in sections.items()
            )
        sensitivity_rows.append(row)

    return {
        "section_weight_rationale": pd.DataFrame(rows),
        "section_weight_sensitivity": pd.DataFrame(sensitivity_rows),
    }


def build_validation_templates(
    summaries: list[EntitySummary],
    relations: list[Relation],
    articles: list[Article],
    sample_size: int = 200,
) -> dict[str, pd.DataFrame]:
    articles_by_id = _article_map(articles)

    def stratified_sample(dataframe: pd.DataFrame, columns: list[str], n: int) -> pd.DataFrame:
        if dataframe.empty or len(dataframe) <= n:
            return dataframe
        groups = list(dataframe.groupby(columns, dropna=False, sort=True))
        per_group = max(1, n // max(1, len(groups)))
        pieces = []
        sampled_indices = []
        for _, group in groups:
            piece = group.head(per_group)
            pieces.append(piece)
            sampled_indices.extend(piece.index.tolist())
        sampled = pd.concat(pieces) if pieces else dataframe.head(0)
        if len(sampled) < n:
            remaining = dataframe.drop(sampled_indices, errors="ignore").head(n - len(sampled))
            sampled = pd.concat([sampled, remaining])
        return sampled.head(n).reset_index(drop=True)

    summary_rows = []
    for summary in summaries:
        article = articles_by_id.get(summary.article_id)
        summary_rows.append(
            {
                "article_id": summary.article_id,
                "title": article.title if article else "",
                "entity_type": summary.entity_type,
                "label_es": summary.label_es,
                "category": summary.category,
                "algorithm_role": summary.role,
                "algorithm_confidence": summary.confidence,
                "n_mentions": summary.n_mentions,
                "sections": json.dumps(_sections_dict(summary), ensure_ascii=False),
                "evidence_text": summary.evidence_text,
                "human_role": "",
                "human_confidence": "",
                "correct_evidence": "",
                "reviewer_notes": "",
            }
        )
    summary_df = pd.DataFrame(summary_rows)
    if not summary_df.empty:
        summary_df = summary_df.sort_values(["algorithm_confidence", "n_mentions"], ascending=[True, False])
        summary_df = stratified_sample(summary_df, ["entity_type", "algorithm_role", "algorithm_confidence"], sample_size)

    relation_rows = []
    for relation in relations:
        article = articles_by_id.get(relation.article_id)
        relation_rows.append(
            {
                "article_id": relation.article_id,
                "title": article.title if article else "",
                "entity_a_label": relation.entity_a_label,
                "entity_a_category": relation.entity_a_category,
                "entity_b_label": relation.entity_b_label,
                "entity_b_category": relation.entity_b_category,
                "algorithm_association": relation.association,
                "algorithm_confidence": relation.confidence,
                "confidence_score": relation.confidence_score,
                "section": relation.section,
                "evidence_text": relation.evidence_text,
                "human_association": "",
                "human_confidence": "",
                "correct_evidence": "",
                "reviewer_notes": "",
            }
        )
    relation_df = pd.DataFrame(relation_rows)
    if not relation_df.empty:
        relation_df = relation_df.sort_values(["algorithm_association", "confidence_score"], ascending=[True, False])
        relation_df = stratified_sample(relation_df, ["algorithm_association", "algorithm_confidence"], sample_size)

    codebook = pd.DataFrame(
        [
            {
                "field": "human_role",
                "allowed_values": "exposure_main; secondary_variable; bibliographic_mention; unclear; not_detected",
                "description": "Manual judgment of whether the entity was truly used/studied.",
            },
            {
                "field": "human_association",
                "allowed_values": "strong; weak; speculative; insufficient; false_positive",
                "description": "Manual judgment of the A↔B entity relationship.",
            },
            {
                "field": "correct_evidence",
                "allowed_values": "yes; no; partially",
                "description": "Whether the extracted text supports the algorithmic label.",
            },
        ]
    )
    return {
        "manual_validation_entity_roles": summary_df,
        "manual_validation_relations": relation_df,
        "manual_validation_codebook": codebook,
    }


def export_publication_extensions(
    output_dir: str | Path,
    articles: list[Article],
    mentions: list[Mention],
    summaries: list[EntitySummary],
    relations: list[Relation],
    protocol: Protocol,
    sample_size: int = 200,
    kwic_radius: int = 160,
) -> dict[str, Path]:
    output = Path(output_dir)
    publication_dir = output / "publication_pipeline"
    publication_dir.mkdir(parents=True, exist_ok=True)

    tables: dict[str, pd.DataFrame] = {}
    tables["kwic_concordance"] = build_kwic_concordance(articles, mentions, radius=kwic_radius)
    tables.update(build_term_frequency_tables(articles, mentions))
    tables["cooccurrence_article_vs_evidence"] = build_cooccurrence_comparison(articles, mentions, relations)
    tables.update(build_section_weight_tables(summaries, protocol.sections))
    tables.update(build_validation_templates(summaries, relations, articles, sample_size=sample_size))

    paths: dict[str, Path] = {}
    for name, dataframe in tables.items():
        path = publication_dir / f"{name}.csv"
        dataframe = _clean_dataframe(dataframe)
        tables[name] = dataframe
        dataframe.to_csv(path, index=False)
        paths[name] = path

    excel_path = publication_dir / "publication_pipeline_tables.xlsx"
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        for name, dataframe in tables.items():
            dataframe.to_excel(writer, sheet_name=name[:31], index=False)
    paths["excel"] = excel_path

    summary = {
        "n_articles": len(articles),
        "n_extractable_articles": sum(1 for article in articles if article.text_extractable),
        "n_mentions": len(mentions),
        "n_entity_summaries": len(summaries),
        "n_relations": len(relations),
        "kwic_radius_characters": kwic_radius,
        "manual_validation_sample_size": sample_size,
        "protocol": {
            "name": protocol.identity.name,
            "variable_a": protocol.variable_a.display_name,
            "variable_b": protocol.variable_b.display_name,
        },
        "methodological_note": (
            "The extended outputs adapt published text-mining components "
            "(KWIC, bag-of-words/TF-IDF, co-occurrence networks, relation extraction "
            "and IMRaD-aware context) while retaining protocol-driven heuristic "
            "weights for A↔B evidence triage."
        ),
    }
    summary_path = publication_dir / "publication_pipeline_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    paths["summary"] = summary_path
    return paths
