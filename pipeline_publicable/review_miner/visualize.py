"""Baseline SVG charts for a protocol-driven run.

Chart titles read the protocol's display labels so a run on a "Fármacos /
Efectos adversos" protocol produces, for example, ``"Frecuencia de
fármacos detectados"`` instead of the legacy ``"Frecuencia de contaminantes
detectados"``.
"""

from __future__ import annotations

import html
from collections import Counter, defaultdict
from pathlib import Path

from .classify import (
    ROLE_INTRO_DISCUSSION,
    ROLE_PRIMARY_FOCUS,
    ROLE_PROBABLE_FOCUS,
    ROLE_SECONDARY,
    ROLE_UNCLEAR,
)
from .protocol import Protocol
from .schema import Article, EntitySummary, Relation


PALETTE = ["#176B87", "#C2410C", "#4D7C0F", "#7C3AED", "#B45309", "#0F766E", "#BE123C", "#334155"]

# Roles that contribute to the "frequency of detected X" charts. The unclear
# bucket is excluded so summaries with no central-section evidence don't
# pollute the bars; primary/secondary/probable focus + an intro mention are
# all worth seeing, because users often want to compare them.
FREQUENCY_ROLES = {
    ROLE_PRIMARY_FOCUS,
    ROLE_PROBABLE_FOCUS,
    ROLE_SECONDARY,
    ROLE_INTRO_DISCUSSION,
}


def _svg_bar(title: str, items: list[tuple[str, int]], output_path: Path, width: int = 1120) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    items = [(label, value) for label, value in items if value > 0][:35]
    height = 82 + max(1, len(items)) * 30
    left = 330
    right = 70
    chart_width = width - left - right
    max_value = max([value for _, value in items] or [1])
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        "<rect width='100%' height='100%' fill='white'/>",
        f"<text x='24' y='38' font-family='Arial, sans-serif' font-size='22' font-weight='700' fill='#111827'>{html.escape(title)}</text>",
    ]
    for idx, (label, value) in enumerate(items):
        y = 66 + idx * 30
        bar_width = max(2, chart_width * value / max_value)
        color = PALETTE[idx % len(PALETTE)]
        parts.append(f"<text x='24' y='{y + 18}' font-family='Arial, sans-serif' font-size='13' fill='#111827'>{html.escape(label[:52])}</text>")
        parts.append(f"<rect x='{left}' y='{y + 5}' width='{bar_width:.1f}' height='18' fill='{color}' rx='2'/>")
        parts.append(f"<text x='{left + bar_width + 8:.1f}' y='{y + 19}' font-family='Arial, sans-serif' font-size='12' fill='#374151'>{value}</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def _svg_heatmap(title: str, matrix: dict[tuple[str, str], int], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted({key[0] for key in matrix})
    cols = sorted({key[1] for key in matrix})
    if not rows or not cols:
        output_path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return
    cell = 38
    left = 260
    top = 160
    width = left + len(cols) * cell + 90
    height = top + len(rows) * cell + 60
    max_value = max(matrix.values()) or 1
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        "<rect width='100%' height='100%' fill='white'/>",
        f"<text x='24' y='38' font-family='Arial, sans-serif' font-size='22' font-weight='700' fill='#111827'>{html.escape(title)}</text>",
    ]
    for j, col in enumerate(cols):
        x = left + j * cell + cell / 2
        parts.append(
            f"<text x='{x}' y='{top - 12}' transform='rotate(-55 {x} {top - 12})' "
            f"text-anchor='start' font-family='Arial, sans-serif' font-size='12' fill='#111827'>{html.escape(col[:24])}</text>"
        )
    for i, row in enumerate(rows):
        y = top + i * cell
        parts.append(f"<text x='24' y='{y + 24}' font-family='Arial, sans-serif' font-size='12' fill='#111827'>{html.escape(row[:36])}</text>")
        for j, col in enumerate(cols):
            value = matrix.get((row, col), 0)
            intensity = value / max_value
            red = int(245 - 120 * intensity)
            green = int(247 - 120 * intensity)
            blue = int(250 - 40 * intensity)
            x = left + j * cell
            parts.append(f"<rect x='{x}' y='{y}' width='{cell - 2}' height='{cell - 2}' fill='rgb({red},{green},{blue})' stroke='#e5e7eb'/>")
            if value:
                parts.append(f"<text x='{x + cell / 2 - 1}' y='{y + 24}' text-anchor='middle' font-family='Arial, sans-serif' font-size='12' fill='#111827'>{value}</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def build_visualizations(
    output_dir: str | Path,
    articles: list[Article],
    summaries: list[EntitySummary],
    relations: list[Relation],
    protocol: Protocol,
) -> dict[str, Path]:
    charts = Path(output_dir) / "figures"
    charts.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}

    name_a = protocol.variable_a.display_name
    name_b = protocol.variable_b.display_name
    slug_a = _slug(name_a)
    slug_b = _slug(name_b)

    # --- Frequency of Variable A detections ---
    counter_a = Counter(
        summary.label_es or summary.label_en
        for summary in summaries
        if summary.entity_type == "a" and summary.role in FREQUENCY_ROLES
    )
    path = charts / f"frecuencia_{slug_a}.svg"
    _svg_bar(f"Frecuencia de {name_a.lower()} detectados", counter_a.most_common(), path)
    paths[f"frecuencia_{slug_a}"] = path

    # --- Frequency of Variable B detections ---
    counter_b = Counter(
        summary.label_es or summary.label_en
        for summary in summaries
        if summary.entity_type == "b" and summary.role != ROLE_UNCLEAR
    )
    path = charts / f"frecuencia_{slug_b}.svg"
    _svg_bar(f"Frecuencia de {name_b.lower()} detectadas", counter_b.most_common(), path)
    paths[f"frecuencia_{slug_b}"] = path

    # --- Category × category heatmap ---
    matrix: Counter[tuple[str, str]] = Counter()
    for relation in relations:
        if relation.association in {"asociacion_fuerte", "asociacion_debil", "mencion_especulativa"}:
            matrix[(relation.entity_a_category, relation.entity_b_category)] += 1
    path = charts / "heatmap_asociaciones.svg"
    _svg_heatmap(f"Heatmap {name_a.lower()} × {name_b.lower()}", dict(matrix), path)
    paths["heatmap_asociaciones"] = path

    # --- Articles by detected study type ---
    study_counter = Counter(article.article_kind for article in articles)
    path = charts / "tipo_estudio.svg"
    _svg_bar("Articulos por tipo de estudio", study_counter.most_common(), path)
    paths["tipo_estudio"] = path

    # --- Association strength distribution ---
    association_counter = Counter(relation.association for relation in relations)
    path = charts / "nivel_asociacion.svg"
    _svg_bar("Relaciones por nivel de asociacion", association_counter.most_common(), path)
    paths["nivel_asociacion"] = path

    return paths


def _slug(value: str) -> str:
    """Lowercase + ASCII-only slug for filenames."""

    import re
    import unicodedata

    cleaned = unicodedata.normalize("NFD", value)
    cleaned = "".join(ch for ch in cleaned if unicodedata.category(ch) != "Mn")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", cleaned).strip("_").lower()
    return cleaned or "variable"
