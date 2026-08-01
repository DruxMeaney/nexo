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
import colorsys
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

# 12 colores explicitos: el asistente permite kmeansK hasta 12 (ANALYSIS_BOUNDS
# en src/lib/protocol/defaults.ts). Mas alla de esa cota _cluster_color genera
# tonos adicionales de forma deterministica.
PALETTE = [
    "#176B87",
    "#C2410C",
    "#4D7C0F",
    "#7C3AED",
    "#B45309",
    "#0F766E",
    "#BE123C",
    "#334155",
    "#A16207",
    "#1D4ED8",
    "#DB2777",
    "#15803D",
]

# Etiqueta usada cuando una entidad no tiene categoria ni etiqueta utilizable.
NO_CATEGORY_LABEL = "(sin categoria)"

# Cortes de color de la matriz de burbujas sobre avg_strength (escala 1-9).
BUBBLE_COLOR_THRESHOLDS = (7.0, 4.0)

# Columnas minimas que deben existir tras leer cada CSV del pipeline. Un corpus
# sin relaciones deja ficheros sin cabecera, y estas listas los reconstruyen.
ARTICLE_COLUMNS = ["article_id", "title", "year", "doi", "article_kind", "text_extractable"]
SUMMARY_COLUMNS = [
    "article_id",
    "entity_type",
    "entity_id",
    "label_es",
    "label_en",
    "category",
    "n_mentions",
    "role",
    "confidence",
]
RELATION_COLUMNS = [
    "article_id",
    "entity_a_label",
    "entity_a_category",
    "entity_b_label",
    "entity_b_category",
    "association",
    "confidence",
    "section",
]
PAIR_METRIC_COLUMNS = ["weighted_score", "n_relations", "avg_strength", "articles"]

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


def _text(value: object) -> str:
    """Celda de pandas a texto plano: NaN/NaT/None se vuelven cadena vacia.

    ``bool(float("nan"))`` es ``True``, asi que sin esta normalizacion las
    cadenas ``a or b`` sobre columnas leidas de CSV nunca caen al segundo
    termino y ``str(nan)`` produce la etiqueta literal ``"nan"``.
    """
    try:
        blank = value is None or bool(pd.isna(value))
    except (TypeError, ValueError):
        blank = False
    return "" if blank else str(value)


def _category_or_label(category: object, label: object) -> str:
    """Categoria de una entidad con respaldo en su etiqueta.

    Las taxonomias planas declaran todos sus terminos en la raiz, por lo que el
    protocolo les asigna categoria "" (NaN al pasar por CSV). En ese caso la
    propia entidad es su categoria y se usa la etiqueta para que los pivotes y
    los rasgos ``*_category::`` sigan teniendo un eje real.
    """
    return _text(category).strip() or _text(label).strip() or NO_CATEGORY_LABEL


def _cluster_color(index: object) -> str:
    """Color estable por cluster.

    Dentro de PALETTE devuelve el color declarado; mas alla genera matices
    distinguibles rotando el tono con el angulo aureo (deterministico, sin
    azar) en vez de reutilizar un color ya asignado.
    """
    position = max(0, int(index))
    if position < len(PALETTE):
        return PALETTE[position]
    hue = (137.508 * (position - len(PALETTE) + 1)) % 360.0
    red, green, blue = colorsys.hls_to_rgb(hue / 360.0, 0.40, 0.62)
    return "#{:02X}{:02X}{:02X}".format(int(red * 255), int(green * 255), int(blue * 255))


def _weight_relation(row: pd.Series) -> float:
    """Peso de evidencia de una relacion = fuerza x confianza.

    Escala declarada 0-9: ASSOCIATION_WEIGHT (3/2/1/0) x CONFIDENCE_WEIGHT
    (3/2/1). Advertencia metodologica: ``relations._relation_confidence``
    deriva la confianza de la propia asociacion, de modo que el producto no
    combina dos dimensiones independientes. La escala realizada por nivel de
    asociacion es ~9 : 3.9 : 1 (fuerte : debil : especulativa) y no el 3 : 2 : 1
    de ASSOCIATION_WEIGHT. Se conserva el producto para no alterar los
    resultados ya publicados; toda lectura del peso debe hacerse en la escala
    0-9 que se documenta aqui y en visual_analytics_summary.json.
    """
    return ASSOCIATION_WEIGHT.get(_text(row.get("association")), 0.0) * CONFIDENCE_WEIGHT.get(_text(row.get("confidence")), 1.0)


def _with_weight_column(relations: pd.DataFrame) -> pd.DataFrame:
    """Copia de ``relations`` con ``weighted_score``; tolera cero relaciones."""
    frame = relations.copy()
    if frame.empty:
        frame["weighted_score"] = pd.Series(dtype=float)
        return frame
    frame["weighted_score"] = frame.apply(_weight_relation, axis=1)
    return frame


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

    Article ids are normalised to text in the three tables, so an all-numeric
    naming convention (1.pdf, 2.pdf ...) keeps matching across them.
    """

    articles = articles.copy()
    articles["article_id"] = [_text(value) for value in articles["article_id"]]
    article_ids = list(articles["article_id"])
    rows: dict[str, Counter[str]] = {article_id: Counter() for article_id in article_ids}

    for _, row in summaries.iterrows():
        article_id = _text(row["article_id"])
        if article_id not in rows:
            continue
        role_weight = ROLE_WEIGHT.get(_text(row.get("role")), 1.0)
        mention_weight = math.log1p(float(row.get("n_mentions", 0) or 0))
        value = role_weight * mention_weight
        entity_type = _text(row["entity_type"])  # "a" or "b"
        label = _text(row.get("label_es")).strip() or _text(row.get("label_en")).strip() or _text(row.get("entity_id")).strip()
        category = _category_or_label(row.get("category"), label)
        rows[article_id][f"{entity_type}_category::{category}"] += value
        rows[article_id][f"{entity_type}_label::{label}"] += value * 0.65
        rows[article_id][f"{entity_type}_confidence::{_text(row.get('confidence'))}"] += 1.0

    for _, row in relations.iterrows():
        article_id = _text(row["article_id"])
        if article_id not in rows:
            continue
        weight = _weight_relation(row)
        if weight <= 0:
            continue
        category_a = _category_or_label(row.get("entity_a_category"), row.get("entity_a_label"))
        category_b = _category_or_label(row.get("entity_b_category"), row.get("entity_b_label"))
        rows[article_id][f"relation_association::{_text(row['association'])}"] += weight
        rows[article_id][f"relation_confidence::{_text(row['confidence'])}"] += weight
        rows[article_id][f"relation_section::{_text(row['section'])}"] += weight
        rows[article_id][f"relation_pair::{_text(row['entity_a_label'])} → {_text(row['entity_b_label'])}"] += weight * 0.5
        rows[article_id][f"relation_category_pair::{category_a} → {category_b}"] += weight

    for _, row in articles.iterrows():
        article_id = _text(row["article_id"])
        rows[article_id][f"article_kind::{_text(row['article_kind'])}"] += 2.0

    feature_names = sorted({feature for counter in rows.values() for feature in counter})
    matrix = pd.DataFrame(
        [[rows[article_id].get(feature, 0.0) for feature in feature_names] for article_id in article_ids],
        index=article_ids,
        columns=feature_names,
    )
    metadata = articles.set_index("article_id")[["title", "year", "doi", "article_kind", "text_extractable"]].copy()
    return matrix, metadata


def standardize_matrix(matrix: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    if matrix.empty:
        return np.zeros((len(matrix), 1)), []
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


def _write_placeholder_svg(output_path: Path, title: str, message: str) -> None:
    """Figura vacia pero valida: titulo y motivo declarados.

    Se usa cuando no hay datos que dibujar, para que el conjunto de figuras
    quede completo y el lector vea por que el panel esta vacio.
    """

    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 1200, 260
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        f"<text x='32' y='58' font-family='Arial, sans-serif' font-size='28' font-weight='700' fill='#111827'>{_safe(title)}</text>",
        f"<text x='32' y='104' font-family='Arial, sans-serif' font-size='17' fill='#374151'>{_safe(message)}</text>",
        "</svg>",
    ]
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_kmeans_cluster_map(cluster_df: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 1900, 1120
    if cluster_df.empty:
        _write_placeholder_svg(
            output_path,
            "K-Means de articulos (sin PCA)",
            "Sin articulos que agrupar: el corpus no produjo filas para la matriz articulo × rasgo.",
        )
        return
    left, right, top, bottom = 120, 260, 125, 120
    clusters = sorted(cluster_df["cluster"].unique())
    cluster_x = {
        cluster: left + idx * ((width - left - right) / max(1, len(clusters) - 1))
        for idx, cluster in enumerate(clusters)
    }
    ys = _scale(cluster_df["distance_to_centroid"].to_numpy(float), height - bottom, top + 20)
    max_rel = max(1, int(cluster_df["n_relations_weighted"].fillna(0).max()))
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
        color = _cluster_color(row["cluster"])
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
        color = _cluster_color(cluster)
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
        _write_placeholder_svg(output_path, title, "Sin pares con evidencia suficiente en este corpus.")
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
    strong_cut, weak_cut = BUBBLE_COLOR_THRESHOLDS
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        f"<rect x='0' y='0' width='{width}' height='{height}' fill='white'/>",
        f"<text x='32' y='44' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='#111827'>{_safe(title)}</text>",
        "<text x='32' y='76' font-family='Arial, sans-serif' font-size='16' fill='#374151'>Tamaño = evidencia ponderada acumulada (suma de fuerza × confianza); color = peso promedio por relación (escala 1-9).</text>",
        f"<text x='32' y='102' font-family='Arial, sans-serif' font-size='14' fill='#64748B'>Color: azul ≥ {strong_cut:.0f}, ámbar ≥ {weak_cut:.0f}, gris &lt; {weak_cut:.0f} sobre ese peso promedio; no es la escala 1-3 de fuerza de asociación.</text>",
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
            color = "#176B87" if avg >= strong_cut else "#D97706" if avg >= weak_cut else "#64748B"
            tooltip = _safe(
                f"{label_a} → {label_b}: peso={value:.1f}, n={int(row['n_relations'])}, "
                f"peso promedio (asociación × confianza, escala 1-9)={avg:.1f}",
                220,
            )
            parts.append(f"<circle cx='{x+cell/2:.1f}' cy='{y+cell/2:.1f}' r='{radius:.1f}' fill='{color}' fill-opacity='0.75'><title>{tooltip}</title></circle>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_heatmap(title: str, matrix: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if matrix.empty:
        _write_placeholder_svg(output_path, title, "Sin relaciones con evidencia suficiente para construir la tabla cruzada.")
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
        _write_placeholder_svg(
            output_path,
            "Red bipartita de asociaciones",
            "Sin aristas: ninguna relacion alcanzo evidencia textual suficiente.",
        )
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
        "<text x='32' y='76' font-family='Arial, sans-serif' font-size='16' fill='#374151'>Solo relaciones con evidencia textual cercana; grosor = peso (fuerza × confianza, escala 0-9).</text>",
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
    """Tablas de pares por tipo de asociacion y colapsadas.

    ``avg_strength`` es el peso promedio por relacion (asociacion x confianza,
    escala 1-9), no la fuerza de asociacion en la escala 1-3.
    """

    if "association" not in relations.columns:
        valid = relations.iloc[0:0].copy()
    else:
        valid = relations[relations["association"] != "sin_evidencia_suficiente"].copy()
    if valid.empty:
        # Marcos vacios pero con cabecera: un corpus sin relaciones debe exportar
        # CSVs legibles por la siguiente etapa, no ficheros sin columnas.
        by_type = pd.DataFrame(columns=["entity_a_label", "entity_b_label", "association", *PAIR_METRIC_COLUMNS])
        collapsed = pd.DataFrame(columns=["entity_a_label", "entity_b_label", *PAIR_METRIC_COLUMNS])
        return by_type, collapsed
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
    # Con cabecera aunque no haya clusters: el CSV debe seguir siendo legible.
    return pd.DataFrame(rows, columns=["cluster", "n_articles", "article_ids", "top_features"])


def cluster_centroids_table(
    centers: np.ndarray,
    kept_columns: list[str],
    k: int,
    member_counts: dict[int, int] | None = None,
) -> pd.DataFrame:
    """Centroides por cluster en unidades z.

    kmeans_numpy solo recalcula un centroide cuando el cluster conserva
    miembros, asi que un cluster vacio mantiene la semilla inicial y no
    representa a ningun articulo. Cuando se pasa ``member_counts`` esos
    clusters se descartan y se anota ``n_articles``.
    """

    # Cabecera minima para que el CSV siga siendo legible sin clusters reales.
    header = ["cluster"] if member_counts is None else ["cluster", "n_articles"]
    if centers.size == 0 or not kept_columns:
        return pd.DataFrame(columns=header)
    rows = []
    for cluster in range(min(k, len(centers))):
        n_articles = None if member_counts is None else int(member_counts.get(cluster, 0))
        if n_articles == 0:
            continue
        values = pd.Series(centers[cluster], index=kept_columns).sort_values(ascending=False)
        row: dict[str, object] = {"cluster": cluster}
        if n_articles is not None:
            row["n_articles"] = n_articles
        for rank, (feature, value) in enumerate(values.head(20).items(), start=1):
            row[f"feature_{rank}"] = feature
            row[f"zscore_{rank}"] = float(value)
        rows.append(row)
    return pd.DataFrame(rows) if rows else pd.DataFrame(columns=header)


# --------------------------------------------------------------------------- #
# Public entry point                                                          #
# --------------------------------------------------------------------------- #


def _slug(value: str) -> str:
    cleaned = unicodedata.normalize("NFD", value)
    cleaned = "".join(ch for ch in cleaned if unicodedata.category(ch) != "Mn")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", cleaned).strip("_").lower()
    return cleaned or "variable"


def _read_table(path: Path, columns: list[str]) -> pd.DataFrame:
    """Lee un CSV del pipeline tolerando el caso vacio.

    Un corpus sin relaciones (o sin menciones) deja un CSV de un solo salto de
    linea, sin cabecera, que ``read_csv`` rechaza con EmptyDataError. Aqui se
    devuelve un marco vacio con las columnas esperadas para que la etapa
    completa degrade a figuras y tablas vacias pero validas.
    """

    if not path.exists():
        # Un archivo ausente no es un corpus vacio: es una carpeta equivocada.
        # Fallar aqui evita producir figuras "exitosas" sin datos detras.
        raise FileNotFoundError(
            f"No se encontro {path.name} en {path.parent}. "
            "Indica la carpeta de salida de una corrida del pipeline."
        )
    try:
        frame = pd.read_csv(path, dtype={"article_id": str})
    except pd.errors.EmptyDataError:
        # Un CSV sin cabecera si es el caso legitimo de "cero filas": el
        # pipeline lo escribe cuando no hubo menciones o relaciones.
        frame = pd.DataFrame(columns=columns)
    else:
        # El archivo tenia cabecera: entonces su esquema debe ser el vigente.
        # Rellenar columnas ausentes convertiria un CSV de una version anterior
        # en resultados silenciosamente vacios o inventados.
        missing = [column for column in columns if column not in frame.columns]
        if missing:
            raise KeyError(
                f"{path.name} no tiene las columnas {missing}. "
                f"Columnas presentes: {list(frame.columns)}. "
                "Vuelve a ejecutar el pipeline para regenerar esta carpeta."
            )
    for column in columns:
        if column not in frame.columns:
            frame[column] = pd.Series(dtype="object")
    if "article_id" in frame.columns:
        frame["article_id"] = [_text(value) for value in frame["article_id"]]
    return frame


def _normalize_pivot_keys(relations: pd.DataFrame) -> pd.DataFrame:
    """Deja sin huecos las columnas que sirven de eje en los pivotes.

    En una taxonomia plana todos los terminos viven en la raiz y el protocolo
    les asigna categoria "" (NaN tras el CSV); sin este relleno ``pivot_table``
    descarta esas filas y la figura sale en blanco. La seccion recibe el mismo
    trato para que ninguna relacion desaparezca del mapa de calor.
    """

    frame = relations.copy()
    for slot in ("a", "b"):
        frame[f"entity_{slot}_category"] = [
            _category_or_label(category, label)
            for category, label in zip(frame[f"entity_{slot}_category"], frame[f"entity_{slot}_label"])
        ]
    frame["section"] = [_text(section).strip() or "(sin seccion)" for section in frame["section"]]
    return frame


def _relative_to_run(path: Path | str, output_dir: Path) -> str:
    """Render ``path`` relative to the run folder, with ``/`` separators.

    Falls back to the plain string when the figure somehow lives outside the
    run folder: a summary that names an unexpected location is more useful to
    whoever debugs it than one that hides the surprise behind an exception.
    The separator is forced so a run produced on Windows and one produced on
    Linux describe the same figure with the same string.
    """

    try:
        return Path(path).resolve().relative_to(Path(output_dir).resolve()).as_posix()
    except ValueError:
        return str(path)


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

    articles = _read_table(input_dir / "articles.csv", ARTICLE_COLUMNS)
    summaries = _read_table(input_dir / "entity_summaries.csv", SUMMARY_COLUMNS)
    relations = _normalize_pivot_keys(_read_table(input_dir / "relations.csv", RELATION_COLUMNS))

    raw_matrix, metadata = build_feature_matrix(articles, summaries, relations)
    matrix = np.log1p(raw_matrix)
    kmeans_matrix = select_kmeans_features(matrix)
    kmeans_values, kept_columns = standardize_matrix(kmeans_matrix)
    labels, centers, distances, inertia = kmeans_numpy(kmeans_values, k=kmeans_k)
    cluster_sizes = Counter(int(label) for label in labels)
    weighted_relations = _with_weight_column(relations)
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
    centroid_df = cluster_centroids_table(centers, kept_columns, k=kmeans_k, member_counts=cluster_sizes)
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

    # Las figuras se generan siempre: cuando no hay datos escriben una version
    # vacia pero valida con el motivo, en lugar de faltar del conjunto.
    outputs["bubble"] = figures / f"bubble_{slug_a}_{slug_b}.svg"
    svg_bubble_matrix(
        pair_collapsed,
        outputs["bubble"],
        title=f"Matriz de burbujas: {name_a.lower()} × {name_b.lower()}",
    )
    outputs["network"] = figures / "association_network.svg"
    edge_for_network = pair_by_assoc.copy()
    svg_bipartite_network(edge_for_network, outputs["network"], name_a=name_a, name_b=name_b)

    evidenced = weighted_relations[weighted_relations["association"] != "sin_evidencia_suficiente"]
    section_matrix = pd.pivot_table(
        evidenced,
        values="weighted_score",
        index="association",
        columns="section",
        aggfunc="sum",
        fill_value=0,
    )
    outputs["section_heatmap"] = figures / "association_by_section.svg"
    svg_heatmap("Asociaciones por seccion", section_matrix, outputs["section_heatmap"])

    category_matrix = pd.pivot_table(
        evidenced,
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
        "k_requested": int(kmeans_k),
        "k_effective": int(len([cluster for cluster, size in cluster_sizes.items() if size > 0])),
        "clustering_algorithm": "K-Means on standardized log1p article-feature matrix; PCA is not used.",
        "n_articles": int(len(articles)),
        "n_relations": int(len(relations)),
        "n_features": int(matrix.shape[1]),
        "n_features_used_for_kmeans": int(len(kept_columns)),
        "kmeans_feature_policy": (
            "Compact interpretable features only: per-entity categories, study type, "
            "association/confidence levels and evidence sections. Specific entity labels "
            "and exact relation pairs are excluded from clustering but retained in "
            "exported matrices."
        ),
        "kmeans_inertia": inertia,
        "relation_weight": {
            "formula": "ASSOCIATION_WEIGHT[association] * CONFIDENCE_WEIGHT[confidence]",
            "declared_scale": "0-9",
            "association_weight": ASSOCIATION_WEIGHT,
            "confidence_weight": CONFIDENCE_WEIGHT,
            "note": (
                "Confidence is derived from association in relations._relation_confidence, "
                "so the two factors are not independent: the realized mean weight ratio is "
                "about 9 : 3.9 : 1 for asociacion_fuerte : asociacion_debil : "
                "mencion_especulativa, not the 3 : 2 : 1 of ASSOCIATION_WEIGHT alone. "
                "Read every weight (bubble size, edge width, heatmap cell, bar length) on "
                "the 0-9 product scale."
            ),
        },
        "empty_category_fallback": (
            f"Relations with an empty category (flat taxonomies place every term at the root) "
            f"use the entity label as its own category; '{NO_CATEGORY_LABEL}' is used only when "
            "neither category nor label is available."
        ),
        "bubble_color_thresholds": {
            "metric": "avg_strength = mean weighted_score per relation (association x confidence, scale 1-9)",
            "blue_min": BUBBLE_COLOR_THRESHOLDS[0],
            "amber_min": BUBBLE_COLOR_THRESHOLDS[1],
        },
        "protocol": {
            "name": protocol.identity.name,
            "variable_a": name_a,
            "variable_b": name_b,
        },
        # Recorded RELATIVE to the run folder. An absolute path names the
        # machine that produced the run, so it both leaks the author's
        # directory layout into a published artifact and makes this the one
        # file that cannot be byte-compared between two runs of the same
        # study. A relative path still resolves for any consumer, since every
        # figure lives under this same folder.
        "outputs": {key: _relative_to_run(value, output_dir) for key, value in outputs.items()},
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
