"""Protocol-driven pipeline orchestrator.

Replaces the old ``run_pipeline(contaminants_lexicon, diseases_lexicon, ...)``
entry point with a single :func:`run_pipeline` that accepts a fully-loaded
:class:`~review_miner.protocol.Protocol`. Every downstream module reads the
protocol for cues, section headers, weights and display labels — there are
no domain-specific defaults left in the orchestrator.
"""

from __future__ import annotations

from pathlib import Path

from .classify import detect_article_kind, summarize_entity
from .export import export_all
from .extract import extract_mentions, group_mentions_by_article_entity
from .io import load_articles
from .protocol import Protocol
from .relations import build_relations
from .schema import Article, EntitySummary, Mention, Relation
from .visualize import build_visualizations


def run_pipeline(
    protocol: Protocol,
    input_dir: str | Path,
    output_dir: str | Path,
    metadata_paths: str | None = None,
) -> dict[str, object]:
    """End-to-end run over ``input_dir`` driven by ``protocol``."""

    entities = protocol.all_entities()
    articles = load_articles(input_dir, metadata_paths)

    all_mentions: list[Mention] = []
    all_summaries: list[EntitySummary] = []
    all_relations: list[Relation] = []

    for article in articles:
        article.article_kind = detect_article_kind(article, protocol.cues)
        if not article.text_extractable:
            continue
        mentions = extract_mentions(
            article=article,
            entities=entities,
            cues=protocol.cues,
            sections=protocol.sections,
            context_radius=protocol.analysis.context_radius,
        )
        all_mentions.extend(mentions)
        grouped = group_mentions_by_article_entity(mentions)
        article_summaries: dict[tuple[str, str], EntitySummary] = {}
        for (_, entity_type, entity_id), group in grouped.items():
            summary = summarize_entity(article, group, protocol.cues, protocol.sections)
            article_summaries[(entity_type, entity_id)] = summary
            all_summaries.append(summary)

        mentions_a = [m for m in mentions if m.entity_type == "a"]
        mentions_b = [m for m in mentions if m.entity_type == "b"]
        all_relations.extend(
            build_relations(
                article=article,
                mentions_a=mentions_a,
                mentions_b=mentions_b,
                summaries=article_summaries,
                cues=protocol.cues,
                sections=protocol.sections,
                relation_distance=protocol.analysis.relation_distance,
            )
        )

    table_paths = export_all(output_dir, articles, all_mentions, all_summaries, all_relations, protocol)
    chart_paths = build_visualizations(output_dir, articles, all_summaries, all_relations, protocol)
    return {
        "articles": articles,
        "mentions": all_mentions,
        "summaries": all_summaries,
        "relations": all_relations,
        "table_paths": table_paths,
        "chart_paths": chart_paths,
    }
