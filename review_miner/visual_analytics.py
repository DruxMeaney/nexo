"""Advanced visualizations for the protocol-driven pipeline.

Column conventions:
  * ``entity_a_label`` / ``entity_b_label`` — display label for each entity in a pair
  * ``entity_a_category`` / ``entity_b_category`` — category strings from the protocol

Display labels for chart titles and axes are read from a
:class:`~review_miner.protocol.Protocol`. When called standalone via the
CLI, the protocol is loaded with ``--protocol <folder>`` and the same
display names flow into every figure.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from .protocol import Protocol, load_protocol


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

# Mention-role weights now use the generic role IDs minted by classify.py.
ROLE_WEIGHT = {
    "role_primary_focus": 3.0,
    "role_probable_focus": 2.5,
    "role_secondary_variable": 2.0,
    "role_intro_discussion_only": 0.5,
    "role_review_mention": 0.3,
    "role_bibliographic_only": 0.2,
    "role_unclear": 0.5,
}

PALETTE = ["#176B87", "#C2410C", "#4D7C0F", "#7C3AED", "#B45309", "#0F766E", "#BE123C", "#334155", "#A16207"]

# K-Means only uses these compact prefixes. Specific entity labels and pair
# strings live in the full matrix for inspection but stay out of clustering
# to avoid singleton-feature traps.
KMEANS_FEATURE_PREFIXES = (
    "a_category::",
    "b_category::",
    "a_confidence::",
    "b_confidence::",
    "article_kind::",
    "relation_association::",
    "relation_confidence::",
    "relation_section::",
)


# --------------------------------------------------------------------------- #
# Tiny SVG helpers                                                            #
# --------------------------------------------------------------------------- #


def _safe(text: object, limit: int | None = None) -> str:
    value = "" if text is None or (isinstance(text, float) and math.isnan(text)) else str(text)
    value = value if limit is None else value[:limit]
    return html.escape(value)


def _wrap_text(text: object, max_chars: int = 28, max_lines: int = 3) -> list[str]:
    words = str("" if text is None else text).split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join(current + [word])
        if current and len(candidate) > max_chars:
            lines.append(" ".join(current))
            current = [word]
            if len(lines) >= max_lines:
                break
        else:
            current.append(word)
    if current and len(lines) < max_lines:
        lines.append(" ".join(current))
    if not lines:
        lines = [str(text or "")]
    if len(lines) == max_lines and len(" ".join(words)) > len(" ".join(lines)):
        lines[-1] = lines[-1].rstrip(".") + "..."
    return lines


def _svg_multiline(
    text: object,
    x: float,
    y: float,
    max_chars: int,
    font_size: int = 14,
    line_height: int = 16,
    anchor: str = "start",
    fill: str = "#111827",
    weight: str = "400",
    max_lines: int = 3,
    transform: str | None = None,
) -> list[str]:
    transform_attr = f" transform='{transform}'" if transform else ""
    lines = _wrap_text(text, max_chars=max_chars, max_lines=max_lines)
    parts = [
        f"<text x='{x:.1f}' y='{y:.1f}' text-anchor='{anchor}' font-family='Arial, sans-serif' "
        f"font-size='{font_size}' font-weight='{weight}' fill='{fill}'{transform_attr}>"
    ]
    for idx, line in enumerate(lines):
        dy = 0 if idx == 0 else line_height
        parts.append(f"<tspan x='{x:.1f}' dy='{dy}'>{_safe(line)}</tspan>")
    parts.append("</text>")
    return parts


def _weight_relation(row: pd.Series) -> float:
    return ASSOCIATION_WEIGHT.get(str(row.get("association")), 0.0) * CONFIDENCE_WEIGHT.get(str(row.get("confidence")), 1.0)


# --------------------------------------------------------------------------- #
# Feature matrix                                                              #
# --------------------------------------------------------------------------- #


def build_feature_matrix(
    articles: pd.DataFrame,
    summaries: pd.DataFrame,
    relations: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build an article × feature matrix for K-Means.

    Features are intentionally interpretable: per-entity categories, study
    type, association levels, evidence sections, and protocol-driven pair
    strings. The entity_type values are ``"a"`` and ``"b"`` (the slot IDs).
    """

    article_ids = list(articles["article_id"])
    rows: dict[str, Counter[str]] = {article_id: Counter() for article_id in article_ids}

    for _, row in summaries.iterrows():
        article_id = str(row["article_id"])
        if article_id not in rows:
            continue
        role_weight = ROLE_WEIGHT.get(str(row.get("role")), 1.0)
        mention_weight = math.log1p(float(row.get("n_mentions", 0) or 0))
        value = role_weight * mention_weight
        entity_type = str(row["entity_type"])  # "a" or "b"
        category = str(row["category"])
        label = str(row.get("label_es") or row.get("label_en") or "")
        rows[article_id][f"{entity_type}_category::{category}"] += value
        rows[article_id][f"{entity_type}_label::{label}"] += value * 0.65
        rows[article_id][f"{entity_type}_confidence::{row.get('confidence')}"] += 1.0

    for _, row in relations.iterrows():
        article_id = str(row["article_id"])
        if article_id not in rows:
            continue
        weight = _weight_relation(row)
        if weight <= 0:
            continue
        rows[article_id][f"relation_association::{row['association']}"] += weight
        rows[article_id][f"relation_confidence::{row['confidence']}"] += weight
        rows[article_id][f"relation_section::{row['section']}"] += weight
        rows[article_id][f"relation_pair::{row['entity_a_label']} → {row['entity_b_label']}"] += weight * 0.5
        rows[article_id][f"relation_category_pair::{row['entity_a_category']} → {row['entity_b_category']}"] += weight

    for _, row in articles.iterrows():
        article_id = str(row["article_id"])
        rows[article_id][f"article_kind::{row['article_kind']}"] += 2.0

    feature_names = sorted({feature for counter in rows.values() for feature in counter})
    matrix = pd.DataFrame(
        [[rows[article_id].get(feature, 0.0) for feature in feature_names] for article_id in article_ids],
        index=article_ids,
        columns=feature_names,
    )
    metadata = articles.set_index("article_id")[["title", "year", "doi", "article_kind", "text_extractable"]].copy()
    return matrix, metadata


def standardize_matrix(matrix: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    values = matrix.to_numpy(dtype=float)
    std = values.std(axis=0)
    keep = std > 1e-12
    kept_columns = list(matrix.columns[keep])
    if not kept_columns:
        return np.zeros((len(matrix), 1)), []
    values = values[:, keep]
    values = (values - values.mean(axis=0)) / values.std(axis=0)
    return values, kept_columns


def select_kmeans_features(matrix: pd.DataFrame) -> pd.DataFrame:
    columns = [column for column in matrix.columns if column.startswith(KMEANS_FEATURE_PREFIXES)]
    return matrix[columns] if columns else matrix


def kmeans_numpy(values: np.ndarray, k: int = 4, max_iter: int = 100, seed: int = 13) -> tuple[np.ndarray, np.ndarray, np.ndarray, float]:
    if len(values) == 0:
        return np.array([]), np.zeros((0, 0)), np.array([]), 0.0
    k = max(1, min(k, len(values)))
    rng = np.random.default_rng(seed)
    centers = [values[int(rng.integers(0, len(values)))]]
    while len(centers) < k:
        distances = np.min([np.sum((values - center) ** 2, axis=1) for center in centers], axis=0)
        next_idx = int(np.argmax(distances))
        centers.append(values[next_idx])
    centers = np.array(centers, dtype=float)

    labels = np.full(len(values), -1, dtype=int)
    for _ in range(max_iter):
        distances = np.stack([np.sum((values - center) ** 2, axis=1) for center in centers], axis=1)
        new_labels = np.argmin(distances, axis=1)
        if np.array_equal(labels, new_labels):
            break
        labels = new_labels
        for cluster in range(k):
            members = values[labels == cluster]
            if len(members):
                centers[cluster] = members.mean(axis=0)
    final_squared = np.stack([np.sum((values - center) ** 2, axis=1) for center in centers], axis=1)
    assigned_squared = final_squared[np.arange(len(values)), labels]
    distances = np.sqrt(assigned_squared)
    inertia = float(assigned_squared.sum())
    return labels, centers, distances, inertia


def _scale(values: np.ndarray, low: float, high: float) -> np.ndarray:
    if len(values) == 0:
        return values
    min_v = float(np.min(values))
    max_v = float(np.max(values))
    if abs(max_v - min_v) < 1e-12:
        return np.full_like(values, (low + high) / 2, dtype=float)
    return low + (values - min_v) * (high - low) / (max_v - min_v)


# --------------------------------------------------------------------------- #
# SVG figures                                                                 #
# --------------------------------------------------------------------------- #


def svg_kmeans_cluster_map(cluster_df: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 1900, 1120
    left, right, top, bottom = 120, 260, 125, 120
    clusters = sorted(cluster_df["cluster"].unique())
    cluster_x = {
        cluster: left + idx * ((width - left - right) / max(1, len(clusters) - 1))
        for idx, cluster in enumerate(clusters)
    }
    ys = _scale(cluster_df["distance_to_centroid"].to_numpy(float), height - bottom, top + 20)
    max_rel = max(1, int(cluster_df["n_relations_weighted"].max()))
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        "<text x='32' y='42' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='#111827'>K-Means de articulos (sin PCA)</text>",
        "<text x='32' y='72' font-family='Arial, sans-serif' font-size='16' fill='#374151'>K-Means agrupa articulos directamente en la matriz articulo × rasgo estandarizada; no hay reduccion PCA.</text>",
        "<text x='32' y='96' font-family='Arial, sans-serif' font-size='14' fill='#64748B'>Eje Y = distancia al centroide del cluster; tamaño = peso de relaciones. Puntos lejanos son candidatos a auditoria como outliers.</text>",
        f"<line x1='{left}' y1='{height-bottom}' x2='{width-right}' y2='{height-bottom}' stroke='#9ca3af'/>",
        f"<line x1='{left}' y1='{top}' x2='{left}' y2='{height-bottom}' stroke='#9ca3af'/>",
        f"<text x='42' y='{(top + height - bottom) / 2:.1f}' text-anchor='middle' transform='rotate(-90 42 {(top + height - bottom) / 2:.1f})' font-family='Arial, sans-serif' font-size='14' fill='#374151'>Distancia al centroide</text>",
        f"<text x='{(left + width - right)/2:.1f}' y='{height-38}' text-anchor='middle' font-family='Arial, sans-serif' font-size='14' fill='#374151'>Cluster K-Means</text>",
    ]
    for cluster in clusters:
        x = cluster_x[cluster]
        count = int((cluster_df["cluster"] == cluster).sum())
        parts.append(f"<line x1='{x:.1f}' y1='{top}' x2='{x:.1f}' y2='{height-bottom}' stroke='#e5e7eb'/>")
        parts.append(f"<text x='{x:.1f}' y='{height-bottom+36}' text-anchor='middle' font-family='Arial, sans-serif' font-size='16' font-weight='700' fill='#111827'>Cluster {int(cluster)}</text>")
        parts.append(f"<text x='{x:.1f}' y='{height-bottom+58}' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' fill='#64748B'>n={count}</text>")

    label_pieces = [
        cluster_df.sort_values("n_relations_weighted", ascending=False).head(12),
        cluster_df.sort_values("distance_to_centroid", ascending=False).head(8),
    ]
    for cluster in clusters:
        members = cluster_df[cluster_df["cluster"] == cluster]
        label_pieces.append(members.sort_values("n_relations_weighted", ascending=False).head(1))
        label_pieces.append(members.sort_values("distance_to_centroid", ascending=False).head(1))
    label_ids = set(pd.concat(label_pieces)["article_id"])
    for idx, (_, row) in enumerate(cluster_df.iterrows()):
        color = PALETTE[int(row["cluster"]) % len(PALETTE)]
        radius = 6 + 13 * math.sqrt(max(0, float(row["n_relations_weighted"])) / max_rel)
        jitter_seed = sum(ord(char) for char in str(row["article_id"]))
        jitter = ((jitter_seed % 31) - 15) * 1.9
        x = cluster_x[row["cluster"]] + jitter
        y = ys[idx]
        tooltip = _safe(
            f"{row['article_id']} | cluster {int(row['cluster'])} | distancia={row['distance_to_centroid']:.2f} | {row['article_kind']} | {row['title']}",
            320,
        )
        parts.append(f"<circle cx='{x:.1f}' cy='{y:.1f}' r='{radius:.1f}' fill='{color}' fill-opacity='0.82' stroke='#111827' stroke-width='0.6'><title>{tooltip}</title></circle>")
        if row["article_id"] in label_ids:
            label_y = y - radius - 8 if idx % 2 == 0 else y + radius + 16
            parts.append(f"<text x='{x:.1f}' y='{label_y:.1f}' text-anchor='middle' font-family='Arial, sans-serif' font-size='13' font-weight='700' fill='#111827'>{_safe(row['article_id'])}</text>")

    legend_x = width - right + 32
    parts.append(f"<text x='{legend_x}' y='130' font-family='Arial, sans-serif' font-size='18' font-weight='700' fill='#111827'>Clusters</text>")
    for cluster in clusters:
        y = 160 + int(cluster) * 34
        color = PALETTE[int(cluster) % len(PALETTE)]
        count = int((cluster_df["cluster"] == cluster).sum())
        parts.append(f"<rect x='{legend_x}' y='{y-13}' width='18' height='18' fill='{color}'/>")
        parts.append(f"<text x='{legend_x+28}' y='{y+2}' font-family='Arial, sans-serif' font-size='15' fill='#374151'>Cluster {int(cluster)} ({count})</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_bar(title: str, items: list[tuple[str, float]], output_path: Path, width: int = 2050) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    items = [(label, value) for label, value in items if value > 0][:35]
    height = 105 + max(1, len(items)) * 50
    left, right = 760, 120
    max_value = max([value for _, value in items] or [1])
    chart_width = width - left - right
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        f"<text x='32' y='44' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='#111827'>{_safe(title)}</text>",
    ]
    for idx, (label, value) in enumerate(items):
        y = 82 + idx * 50
        bar_width = chart_width * value / max_value
        color = PALETTE[idx % len(PALETTE)]
        parts.extend(_svg_multiline(label, 32, y + 16, max_chars=74, font_size=15, line_height=17, max_lines=2))
        parts.append(f"<rect x='{left}' y='{y + 8}' width='{bar_width:.1f}' height='24' fill='{color}' rx='3'/>")
        parts.append(f"<text x='{left + bar_width + 12:.1f}' y='{y + 27}' font-family='Arial, sans-serif' font-size='15' fill='#374151'>{value:.1f}</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_bubble_matrix(
    pair_df: pd.DataFrame,
    output_path: Path,
    title: str,
    max_entities_a: int = 18,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if pair_df.empty:
        output_path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return
    top_a = (
        pair_df.groupby("entity_a_label")["weighted_score"].sum().sort_values(ascending=False).head(max_entities_a).index.tolist()
    )
    data = pair_df[pair_df["entity_a_label"].isin(top_a)].copy()
    cols_b = data.groupby("entity_b_label")["weighted_score"].sum().sort_values(ascending=False).index.tolist()
    cell = 86
    left, top = 370, 245
    width = left + len(cols_b) * cell + 360
    height = top + len(top_a) * cell + 90
    max_value = max(1.0, float(data["weighted_score"].max()))
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        f"<text x='32' y='44' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='#111827'>{_safe(title)}</text>",
        "<text x='32' y='76' font-family='Arial, sans-serif' font-size='16' fill='#374151'>Tamaño = evidencia ponderada por fuerza/confianza; color = asociación promedio.</text>",
    ]
    for j, label_b in enumerate(cols_b):
        x = left + j * cell + cell / 2
        label_y = top - 16
        parts.append(
            f"<text x='{x:.1f}' y='{label_y:.1f}' transform='rotate(-45 {x:.1f} {label_y:.1f})' "
            f"text-anchor='start' font-family='Arial, sans-serif' font-size='14' fill='#111827'>{_safe(label_b, 38)}</text>"
        )
    lookup = {(row["entity_a_label"], row["entity_b_label"]): row for _, row in data.iterrows()}
    for i, label_a in enumerate(top_a):
        y = top + i * cell
        parts.append(f"<text x='32' y='{y + 51:.1f}' font-family='Arial, sans-serif' font-size='15' fill='#111827'>{_safe(label_a, 42)}</text>")
        for j, label_b in enumerate(cols_b):
            x = left + j * cell
            parts.append(f"<rect x='{x}' y='{y}' width='{cell-3}' height='{cell-3}' fill='#f8fafc' stroke='#e5e7eb'/>")
            row = lookup.get((label_a, label_b))
            if row is None:
                continue
            value = float(row["weighted_score"])
            radius = 7 + 29 * math.sqrt(value / max_value)
            avg = float(row["avg_strength"])
            color = "#176B87" if avg >= 7 else "#D97706" if avg >= 4 else "#64748B"
            tooltip = _safe(f"{label_a} → {label_b}: peso={value:.1f}, n={int(row['n_relations'])}, fuerza promedio={avg:.1f}", 220)
            parts.append(f"<circle cx='{x+cell/2:.1f}' cy='{y+cell/2:.1f}' r='{radius:.1f}' fill='{color}' fill-opacity='0.75'><title>{tooltip}</title></circle>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_heatmap(title: str, matrix: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if matrix.empty:
        output_path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return
    rows = list(matrix.index)
    cols = list(matrix.columns)
    cell = 88
    left, top = 410, 250
    width = left + len(cols) * cell + 380
    height = top + len(rows) * cell + 90
    max_value = float(matrix.to_numpy().max()) or 1.0
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        f"<text x='32' y='44' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='#111827'>{_safe(title)}</text>",
    ]
    for j, col in enumerate(cols):
        x = left + j * cell + cell / 2
        label_y = top - 16
        parts.append(
            f"<text x='{x:.1f}' y='{label_y:.1f}' transform='rotate(-45 {x:.1f} {label_y:.1f})' "
            f"text-anchor='start' font-family='Arial, sans-serif' font-size='14' fill='#111827'>{_safe(col, 40)}</text>"
        )
    for i, row in enumerate(rows):
        y = top + i * cell
        parts.append(f"<text x='32' y='{y + 53:.1f}' font-family='Arial, sans-serif' font-size='15' fill='#111827'>{_safe(row, 42)}</text>")
        for j, col in enumerate(cols):
            value = float(matrix.loc[row, col])
            intensity = value / max_value
            r = int(245 - 110 * intensity)
            g = int(247 - 130 * intensity)
            b = int(250 - 70 * intensity)
            x = left + j * cell
            parts.append(f"<rect x='{x}' y='{y}' width='{cell-3}' height='{cell-3}' fill='rgb({r},{g},{b})' stroke='#e5e7eb'/>")
            if value:
                parts.append(f"<text x='{x+cell/2-1}' y='{y+56}' text-anchor='middle' font-family='Arial, sans-serif' font-size='17' font-weight='700'>{value:.0f}</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_bipartite_network(
    edges: pd.DataFrame,
    output_path: Path,
    name_a: str,
    name_b: str,
    max_edges: int = 55,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    edges = edges.sort_values("weighted_score", ascending=False).head(max_edges).copy()
    if edges.empty:
        output_path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return
    labels_a = edges.groupby("entity_a_label")["weighted_score"].sum().sort_values(ascending=False).index.tolist()
    labels_b = edges.groupby("entity_b_label")["weighted_score"].sum().sort_values(ascending=False).index.tolist()
    width = 2300
    height = max(1150, 190 + 72 * max(len(labels_a), len(labels_b)))
    left_x, right_x = 760, 1600
    top = 150
    a_y = {name: top + idx * ((height - 250) / max(1, len(labels_a) - 1)) for idx, name in enumerate(labels_a)}
    b_y = {name: top + idx * ((height - 250) / max(1, len(labels_b) - 1)) for idx, name in enumerate(labels_b)}
    max_w = float(edges["weighted_score"].max()) or 1.0
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        "<text x='32' y='44' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='#111827'>Red bipartita de asociaciones</text>",
        "<text x='32' y='76' font-family='Arial, sans-serif' font-size='16' fill='#374151'>Solo relaciones con evidencia textual cercana; grosor = peso por fuerza/confianza.</text>",
        f"<text x='230' y='118' font-family='Arial, sans-serif' font-size='20' font-weight='700'>{_safe(name_a)}</text>",
        f"<text x='1680' y='118' font-family='Arial, sans-serif' font-size='20' font-weight='700'>{_safe(name_b)}</text>",
    ]
    for _, row in edges.iterrows():
        y1, y2 = a_y[row["entity_a_label"]], b_y[row["entity_b_label"]]
        stroke_width = 0.8 + 6.5 * float(row["weighted_score"]) / max_w
        color = "#176B87" if row["association"] == "asociacion_fuerte" else "#D97706" if row["association"] == "asociacion_debil" else "#64748B"
        path = f"M {left_x} {y1:.1f} C {left_x+310} {y1:.1f}, {right_x-310} {y2:.1f}, {right_x} {y2:.1f}"
        tooltip = _safe(f"{row['entity_a_label']} → {row['entity_b_label']} | {row['association']} | peso {row['weighted_score']:.1f}", 240)
        parts.append(f"<path d='{path}' fill='none' stroke='{color}' stroke-width='{stroke_width:.1f}' stroke-opacity='0.32'><title>{tooltip}</title></path>")
    for name, y in a_y.items():
        parts.append(f"<circle cx='{left_x}' cy='{y:.1f}' r='7' fill='#176B87'/>")
        parts.extend(_svg_multiline(name, left_x - 18, y - 8, max_chars=46, font_size=15, line_height=17, anchor="end", max_lines=2))
    for name, y in b_y.items():
        parts.append(f"<circle cx='{right_x}' cy='{y:.1f}' r='7' fill='#7C3AED'/>")
        parts.extend(_svg_multiline(name, right_x + 18, y - 8, max_chars=46, font_size=15, line_height=17, max_lines=2))
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Pair tables                                                                 #
# --------------------------------------------------------------------------- #


def build_pair_tables(relations: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    valid = relations[relations["association"] != "sin_evidencia_suficiente"].copy()
    if valid.empty:
        empty = pd.DataFrame()
        return empty, empty
    valid["weighted_score"] = valid.apply(_weight_relation, axis=1)
    pair = (
        valid.groupby(["entity_a_label", "entity_b_label", "association"], as_index=False)
        .agg(
            weighted_score=("weighted_score", "sum"),
            n_relations=("article_id", "count"),
            avg_strength=("weighted_score", "mean"),
            articles=("article_id", lambda values: "; ".join(sorted(set(map(str, values)))[:12])),
        )
    )
    collapsed = (
        valid.groupby(["entity_a_label", "entity_b_label"], as_index=False)
        .agg(
            weighted_score=("weighted_score", "sum"),
            n_relations=("article_id", "count"),
            avg_strength=("weighted_score", "mean"),
            articles=("article_id", lambda values: "; ".join(sorted(set(map(str, values)))[:12])),
        )
    )
    return pair, collapsed


def cluster_profiles(matrix: pd.DataFrame, cluster_df: pd.DataFrame, top_n: int = 8) -> pd.DataFrame:
    rows = []
    for cluster in sorted(cluster_df["cluster"].unique()):
        article_ids = cluster_df.loc[cluster_df["cluster"] == cluster, "article_id"].tolist()
        if not article_ids:
            continue
        means = matrix.loc[article_ids].mean(axis=0).sort_values(ascending=False)
        top_features = [f"{feature}={value:.2f}" for feature, value in means.head(top_n).items() if value > 0]
        rows.append(
            {
                "cluster": int(cluster),
                "n_articles": len(article_ids),
                "article_ids": "; ".join(article_ids),
                "top_features": " | ".join(top_features),
            }
        )
    return pd.DataFrame(rows)


def cluster_centroids_table(centers: np.ndarray, kept_columns: list[str], k: int) -> pd.DataFrame:
    if centers.size == 0 or not kept_columns:
        return pd.DataFrame()
    rows = []
    for cluster in range(min(k, len(centers))):
        values = pd.Series(centers[cluster], index=kept_columns).sort_values(ascending=False)
        row = {"cluster": cluster}
        for rank, (feature, value) in enumerate(values.head(20).items(), start=1):
            row[f"feature_{rank}"] = feature
            row[f"zscore_{rank}"] = float(value)
        rows.append(row)
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------- #
# Public entry point                                                          #
# --------------------------------------------------------------------------- #


def _slug(value: str) -> str:
    cleaned = unicodedata.normalize("NFD", value)
    cleaned = "".join(ch for ch in cleaned if unicodedata.category(ch) != "Mn")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", cleaned).strip("_").lower()
    return cleaned or "variable"


def run_visual_analytics(
    protocol: Protocol,
    input_dir: str | Path,
    output_dir: str | Path,
    k: int | None = None,
) -> dict[str, Path]:
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    figures = output_dir / "advanced_figures"
    figures.mkdir(parents=True, exist_ok=True)

    kmeans_k = k if k is not None else protocol.analysis.kmeans_k
    name_a = protocol.variable_a.display_name
    name_b = protocol.variable_b.display_name
    slug_a = _slug(name_a)
    slug_b = _slug(name_b)

    articles = pd.read_csv(input_dir / "articles.csv")
    summaries = pd.read_csv(input_dir / "entity_summaries.csv")
    relations = pd.read_csv(input_dir / "relations.csv")

    raw_matrix, metadata = build_feature_matrix(articles, summaries, relations)
    matrix = np.log1p(raw_matrix)
    kmeans_matrix = select_kmeans_features(matrix)
    kmeans_values, kept_columns = standardize_matrix(kmeans_matrix)
    labels, centers, distances, inertia = kmeans_numpy(kmeans_values, k=kmeans_k)
    weighted_relations = relations.copy()
    weighted_relations["weighted_score"] = weighted_relations.apply(_weight_relation, axis=1)
    relation_weight_by_article = weighted_relations.groupby("article_id")["weighted_score"].sum()

    cluster_df = metadata.reset_index().rename(columns={"index": "article_id"})
    cluster_df["cluster"] = labels
    cluster_df["distance_to_centroid"] = distances
    cluster_df["n_relations_weighted"] = cluster_df["article_id"].map(relation_weight_by_article).fillna(0)
    cluster_df.to_csv(output_dir / "kmeans_articles.csv", index=False)
    for stale in [output_dir / "pca_kmeans_articles.csv", figures / "pca_kmeans_scatter.svg"]:
        if stale.exists():
            stale.unlink()

    profile_df = cluster_profiles(kmeans_matrix, cluster_df)
    profile_df.to_csv(output_dir / "cluster_profiles.csv", index=False)
    centroid_df = cluster_centroids_table(centers, kept_columns, k=kmeans_k)
    centroid_df.to_csv(output_dir / "kmeans_centroids.csv", index=False)
    raw_matrix.to_csv(output_dir / "article_feature_matrix_raw.csv")
    matrix.to_csv(output_dir / "article_feature_matrix_log1p.csv")
    kmeans_matrix.to_csv(output_dir / "kmeans_feature_matrix_log1p.csv")

    pair_by_assoc, pair_collapsed = build_pair_tables(relations)
    pair_by_assoc.to_csv(output_dir / "association_pairs_by_type.csv", index=False)
    pair_collapsed.to_csv(output_dir / "association_pairs_collapsed.csv", index=False)

    outputs: dict[str, Path] = {}
    outputs["kmeans_map"] = figures / "kmeans_cluster_map.svg"
    svg_kmeans_cluster_map(cluster_df, outputs["kmeans_map"])

    if not pair_collapsed.empty:
        outputs["bubble"] = figures / f"bubble_{slug_a}_{slug_b}.svg"
        svg_bubble_matrix(
            pair_collapsed,
            outputs["bubble"],
            title=f"Matriz de burbujas: {name_a.lower()} × {name_b.lower()}",
        )
        outputs["network"] = figures / "association_network.svg"
        edge_for_network = pair_by_assoc.copy()
        svg_bipartite_network(edge_for_network, outputs["network"], name_a=name_a, name_b=name_b)

    section_matrix = pd.pivot_table(
        weighted_relations[weighted_relations["association"] != "sin_evidencia_suficiente"],
        values="weighted_score",
        index="association",
        columns="section",
        aggfunc="sum",
        fill_value=0,
    )
    outputs["section_heatmap"] = figures / "association_by_section.svg"
    svg_heatmap("Asociaciones por seccion", section_matrix, outputs["section_heatmap"])

    category_matrix = pd.pivot_table(
        weighted_relations[weighted_relations["association"] != "sin_evidencia_suficiente"],
        values="weighted_score",
        index="entity_a_category",
        columns="entity_b_category",
        aggfunc="sum",
        fill_value=0,
    )
    outputs["category_heatmap"] = figures / "category_association_heatmap.svg"
    svg_heatmap(f"Categorias de {name_a.lower()} × {name_b.lower()}", category_matrix, outputs["category_heatmap"])

    top_pairs = pair_collapsed.sort_values("weighted_score", ascending=False).head(30) if not pair_collapsed.empty else pd.DataFrame()
    outputs["top_pairs"] = figures / "top_association_pairs.svg"
    if not top_pairs.empty:
        svg_bar(
            f"Pares {name_a.lower()}-{name_b.lower()} con mayor peso",
            [(f"{row.entity_a_label} → {row.entity_b_label}", float(row.weighted_score)) for _, row in top_pairs.iterrows()],
            outputs["top_pairs"],
        )

    profile_items = []
    for _, row in profile_df.iterrows():
        profile_items.append((f"Cluster {int(row.cluster)} ({int(row.n_articles)} articulos)", float(row.n_articles)))
    outputs["cluster_sizes"] = figures / "cluster_sizes.svg"
    svg_bar("Tamaño de clusters K-Means", profile_items, outputs["cluster_sizes"])

    report = {
        "k": kmeans_k,
        "clustering_algorithm": "K-Means on standardized log1p article-feature matrix; PCA is not used.",
        "n_articles": int(len(articles)),
        "n_features": int(matrix.shape[1]),
        "n_features_used_for_kmeans": int(len(kept_columns)),
        "kmeans_feature_policy": (
            "Compact interpretable features only: per-entity categories, study type, "
            "association/confidence levels and evidence sections. Specific entity labels "
            "and exact relation pairs are excluded from clustering but retained in "
            "exported matrices."
        ),
        "kmeans_inertia": inertia,
        "protocol": {
            "name": protocol.identity.name,
            "variable_a": name_a,
            "variable_b": name_b,
        },
        "outputs": {key: str(value) for key, value in outputs.items()},
        "interpretation_warning": "K-Means es exploratorio; no prueba causalidad ni sustituye revision manual de evidence_text.",
    }
    (output_dir / "visual_analytics_summary.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description="Visualizaciones avanzadas y K-Means para Review Miner.")
    parser.add_argument("--protocol", required=True, help="Carpeta del protocolo.")
    parser.add_argument("--input-dir", default="outputs/review_miner", help="Carpeta con CSVs generados por el pipeline.")
    parser.add_argument("--output-dir", default="outputs/review_miner/visual_analytics", help="Carpeta de salida.")
    parser.add_argument("--k", type=int, default=None, help="Override del K-Means (por defecto usa el del protocolo).")
    args = parser.parse_args()
    protocol = load_protocol(args.protocol)
    outputs = run_visual_analytics(protocol, args.input_dir, args.output_dir, args.k)
    print(f"Graficos avanzados generados: {len(outputs)}")
    print(f"Salida: {Path(args.output_dir).resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
