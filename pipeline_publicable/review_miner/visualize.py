"""Baseline SVG charts for a protocol-driven run.

Chart titles read the protocol's display labels so a run on a "Fármacos /
Efectos adversos" protocol produces, for example, ``"Frecuencia de
deteccion: Fármacos"``. The phrasing carries no participle, so it stays
grammatical whatever the gender and number of the protocol's display names.
"""

from __future__ import annotations

import html
from collections import Counter, defaultdict
from pathlib import Path

from .classify import (
    ROLE_INTRO_DISCUSSION,
    ROLE_PRIMARY_FOCUS,
    ROLE_PROBABLE_FOCUS,
    ROLE_REVIEW_MENTION,
    ROLE_SECONDARY,
)
from .protocol import Protocol
from .schema import Article, EntitySummary, Relation


PALETTE = ["#176B87", "#C2410C", "#4D7C0F", "#7C3AED", "#B45309", "#0F766E", "#BE123C", "#334155"]

# Roles that contribute to the detection-frequency charts. Variable A and
# Variable B use this same set, so the two bar charts count over the same
# population and can be read side by side. Two buckets stay out: entities
# whose mentions live only in the reference list (bibliographic noise, not a
# detection in the article's own text) and entities whose role never became
# clear. Review articles do count: their entities carry ROLE_REVIEW_MENTION
# for both slots, and dropping them would erase every review from one chart
# while keeping it in the other.
FREQUENCY_ROLES = {
    ROLE_PRIMARY_FOCUS,
    ROLE_PROBABLE_FOCUS,
    ROLE_SECONDARY,
    ROLE_INTRO_DISCUSSION,
    ROLE_REVIEW_MENTION,
}

# Printed under both frequency titles so the reader knows what the bars count.
FREQUENCY_SUBTITLE = (
    "Mismo criterio en ambas variables: excluye menciones solo bibliograficas "
    "y entidades sin rol claro"
)

# Caps applied by _svg_bar. Both are announced in the figure when they bite.
MAX_BARS = 35
MAX_LABEL_CHARS = 52


def _svg_bar(
    title: str,
    items: list[tuple[str, int]],
    output_path: Path,
    width: int = 1120,
    subtitle: str = "",
) -> None:
    """Horizontal bar chart with an optional subtitle under the title.

    Neither cap is silent: if the chart shows only the top ``MAX_BARS``
    entities, or clips a long label, an extra note under the title says so,
    so a reader never mistakes a truncated figure for the full set.
    """

    output_path.parent.mkdir(parents=True, exist_ok=True)
    items = [(label, value) for label, value in items if value > 0]
    total = len(items)
    items = items[:MAX_BARS]
    notes = [subtitle] if subtitle else []
    if total > len(items):
        notes.append(f"Mostrando el top {len(items)} de {total} etiquetas con al menos una deteccion")
    if any(len(label) > MAX_LABEL_CHARS for label, _ in items):
        notes.append(f"Etiquetas largas recortadas a {MAX_LABEL_CHARS} caracteres")
    # One note per line: concatenating them would run past the canvas width.
    top = 62 + 18 * len(notes) if notes else 66
    height = top + max(1, len(items)) * 30 + 16
    left = 330
    right = 70
    chart_width = width - left - right
    max_value = max([value for _, value in items] or [1])
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        "<rect width='100%' height='100%' fill='white'/>",
        f"<text x='24' y='38' font-family='Arial, sans-serif' font-size='22' font-weight='700' fill='#111827'>{html.escape(title)}</text>",
    ]
    for idx, note in enumerate(notes):
        parts.append(
            f"<text x='24' y='{58 + idx * 18}' font-family='Arial, sans-serif' font-size='12' fill='#4B5563'>{html.escape(note)}</text>"
        )
    for idx, (label, value) in enumerate(items):
        y = top + idx * 30
        bar_width = max(2, chart_width * value / max_value)
        color = PALETTE[idx % len(PALETTE)]
        shown = label if len(label) <= MAX_LABEL_CHARS else label[: MAX_LABEL_CHARS - 1] + "…"
        parts.append(f"<text x='24' y='{y + 18}' font-family='Arial, sans-serif' font-size='13' fill='#111827'>{html.escape(shown)}</text>")
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
    # Two display names can normalise to the same slug ("Fármacos" /
    # "Farmacos", or a protocol that repeats one name). The slot letter keeps
    # the two figures apart so the B chart can never overwrite the A chart on
    # disk, nor its key in ``paths``.
    if slug_a == slug_b:
        slug_a = f"a_{slug_a}"
        slug_b = f"b_{slug_b}"

    # --- Frequency of Variable A detections ---
    counter_a = Counter(
        summary.label_es or summary.label_en
        for summary in summaries
        if summary.entity_type == "a" and summary.role in FREQUENCY_ROLES
    )
    path = charts / f"frecuencia_{slug_a}.svg"
    _svg_bar(
        f"Frecuencia de deteccion: {name_a}",
        counter_a.most_common(),
        path,
        subtitle=FREQUENCY_SUBTITLE,
    )
    paths[f"frecuencia_{slug_a}"] = path

    # --- Frequency of Variable B detections (same inclusion criterion as A) ---
    counter_b = Counter(
        summary.label_es or summary.label_en
        for summary in summaries
        if summary.entity_type == "b" and summary.role in FREQUENCY_ROLES
    )
    path = charts / f"frecuencia_{slug_b}.svg"
    _svg_bar(
        f"Frecuencia de deteccion: {name_b}",
        counter_b.most_common(),
        path,
        subtitle=FREQUENCY_SUBTITLE,
    )
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
