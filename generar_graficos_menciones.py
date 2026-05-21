from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch


CATEGORY_COLORS = {
    "Metales pesados": "#176D87",
    "Pesticidas": "#C45F35",
    "Microplasticos": "#6F3CE8",
    "Material particulado": "#648A33",
    "Solventes": "#B45309",
    "Contaminantes organicos persistentes": "#A33D5A",
    "Contaminantes atmosfericos": "#D8A64A",
    "Otros contaminantes relevantes": "#5E6A75",
}

SECTION_ORDER = [
    "title",
    "abstract",
    "introduction",
    "methods",
    "results",
    "discussion",
    "conclusion",
    "references",
    "unknown",
]

SECTION_LABELS = {
    "title": "Titulo",
    "abstract": "Resumen",
    "introduction": "Introduccion",
    "methods": "Metodos",
    "results": "Resultados",
    "discussion": "Discusion",
    "conclusion": "Conclusion",
    "references": "Referencias",
    "unknown": "No detectada",
}


def save_both(fig: plt.Figure, output_base: Path) -> None:
    output_base.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_base.with_suffix(".png"), dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    fig.savefig(output_base.with_suffix(".svg"), bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def build_contaminant_mentions(mentions: pd.DataFrame) -> pd.DataFrame:
    contaminants = mentions[mentions["entity_type"].eq("contaminant")].copy()
    grouped = (
        contaminants.groupby(["label_es", "category"], dropna=False)
        .agg(
            menciones_totales=("matched_text", "size"),
            articulos_unicos=("article_id", "nunique"),
        )
        .reset_index()
        .rename(columns={"label_es": "contaminante", "category": "categoria"})
        .sort_values(["menciones_totales", "articulos_unicos", "contaminante"], ascending=[False, False, True])
    )
    total = grouped["menciones_totales"].sum()
    grouped["porcentaje_menciones"] = grouped["menciones_totales"] / total * 100
    return grouped


def plot_contaminant_mentions(counts: pd.DataFrame, output_dir: Path) -> None:
    rows = counts.copy().sort_values("menciones_totales", ascending=True)
    n = len(rows)
    fig_h = max(9, 0.34 * n + 2.2)
    fig, ax = plt.subplots(figsize=(13.5, fig_h))
    fig.patch.set_facecolor("#FBFAF6")
    ax.set_facecolor("#FBFAF6")
    colors = [CATEGORY_COLORS.get(cat, "#5E6A75") for cat in rows["categoria"]]
    bars = ax.barh(rows["contaminante"], rows["menciones_totales"], color=colors, height=0.66)
    max_value = max(rows["menciones_totales"].max(), 1)
    for bar, mentions_total, articles, pct in zip(
        bars,
        rows["menciones_totales"],
        rows["articulos_unicos"],
        rows["porcentaje_menciones"],
    ):
        ax.text(
            bar.get_width() + max_value * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{int(mentions_total):,} menc. | {int(articles)} arts. | {pct:.1f}%",
            va="center",
            fontsize=9.5,
            color="#15202B",
        )
    ax.set_title(
        "Menciones totales por contaminante",
        loc="left",
        fontsize=20,
        fontweight="bold",
        color="#15202B",
        pad=18,
    )
    ax.text(
        0,
        1.015,
        "Cada barra cuenta apariciones textuales detectadas; no equivale al numero de articulos.",
        transform=ax.transAxes,
        fontsize=11,
        color="#5E6A75",
    )
    ax.set_xlabel("Numero total de menciones textuales", fontsize=11, color="#5E6A75")
    ax.grid(axis="x", color="#E8E3D8", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.spines["bottom"].set_color("#DCD6CA")
    ax.tick_params(axis="x", colors="#5E6A75")
    ax.tick_params(axis="y", length=0, labelsize=10)

    legend_handles = []
    for category, color in CATEGORY_COLORS.items():
        if category in set(rows["categoria"]):
            legend_handles.append(plt.Line2D([0], [0], marker="s", linestyle="", color=color, label=category))
    ax.legend(
        handles=legend_handles,
        loc="lower right",
        frameon=False,
        fontsize=9,
        title="Categoria",
        title_fontsize=10,
    )
    save_both(fig, output_dir / "menciones_totales_por_contaminante")


def build_section_mentions(mentions: pd.DataFrame) -> pd.DataFrame:
    contaminants = mentions[mentions["entity_type"].eq("contaminant")].copy()
    contaminants["section"] = contaminants["section"].fillna("unknown")
    counts = contaminants.groupby("section").size().rename("menciones_totales").reset_index()
    all_sections = pd.DataFrame({"section": SECTION_ORDER})
    counts = all_sections.merge(counts, on="section", how="left").fillna({"menciones_totales": 0})
    extra = contaminants.loc[~contaminants["section"].isin(SECTION_ORDER), "section"].value_counts()
    if len(extra):
        counts = pd.concat(
            [counts, extra.rename_axis("section").reset_index(name="menciones_totales")],
            ignore_index=True,
        )
    counts["menciones_totales"] = counts["menciones_totales"].astype(int)
    total = counts["menciones_totales"].sum()
    counts["porcentaje_menciones"] = counts["menciones_totales"] / total * 100
    counts["seccion"] = counts["section"].map(SECTION_LABELS).fillna(counts["section"])
    return counts


def plot_section_mentions(counts: pd.DataFrame, output_dir: Path) -> None:
    rows = counts[counts["menciones_totales"].gt(0)].copy()
    fig, ax = plt.subplots(figsize=(13.5, 7.2))
    fig.patch.set_facecolor("#FBFAF6")
    ax.set_facecolor("#FBFAF6")
    colors = ["#176D87", "#C45F35", "#648A33", "#6F3CE8", "#B45309", "#A33D5A", "#D8A64A", "#5E6A75", "#93A4B2"]
    bars = ax.bar(rows["seccion"], rows["menciones_totales"], color=colors[: len(rows)], width=0.68)
    max_value = max(rows["menciones_totales"].max(), 1)
    for bar, value, pct in zip(bars, rows["menciones_totales"], rows["porcentaje_menciones"]):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max_value * 0.018,
            f"{int(value):,}\n{pct:.1f}%",
            ha="center",
            va="bottom",
            fontsize=10.5,
            color="#15202B",
        )
    ax.set_title(
        "Menciones totales de contaminantes por seccion",
        loc="left",
        fontsize=20,
        fontweight="bold",
        color="#15202B",
        pad=18,
    )
    ax.text(
        0,
        1.02,
        "La seccion indica donde fue detectada la mencion; referencias e introduccion pueden inflar menciones no experimentales.",
        transform=ax.transAxes,
        fontsize=11,
        color="#5E6A75",
    )
    ax.set_ylabel("Numero total de menciones textuales", fontsize=11, color="#5E6A75")
    ax.grid(axis="y", color="#E8E3D8", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.spines["bottom"].set_color("#DCD6CA")
    ax.tick_params(axis="x", labelrotation=22, colors="#15202B")
    ax.tick_params(axis="y", colors="#5E6A75")
    save_both(fig, output_dir / "menciones_totales_por_seccion")


def plot_contaminant_section_heatmap(mentions: pd.DataFrame, output_dir: Path, top_n: int = 25) -> None:
    contaminants = mentions[mentions["entity_type"].eq("contaminant")].copy()
    top = contaminants["label_es"].value_counts().head(top_n).index
    matrix = (
        contaminants[contaminants["label_es"].isin(top)]
        .pivot_table(index="label_es", columns="section", values="matched_text", aggfunc="size", fill_value=0)
        .reindex(index=top)
    )
    cols = [section for section in SECTION_ORDER if section in matrix.columns] + [
        section for section in matrix.columns if section not in SECTION_ORDER
    ]
    matrix = matrix[cols]
    labels = [SECTION_LABELS.get(section, section) for section in matrix.columns]

    fig_h = max(7, 0.32 * len(matrix) + 2)
    fig, ax = plt.subplots(figsize=(13.5, fig_h))
    fig.patch.set_facecolor("#FBFAF6")
    ax.set_facecolor("#FBFAF6")
    im = ax.imshow(matrix.values, aspect="auto", cmap="PuBu", interpolation="nearest")
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=35, ha="right", fontsize=10)
    ax.set_yticks(range(len(matrix.index)))
    ax.set_yticklabels(matrix.index, fontsize=10)
    ax.set_title(
        f"Distribucion por seccion de los {top_n} contaminantes con mas menciones",
        loc="left",
        fontsize=18,
        fontweight="bold",
        color="#15202B",
        pad=18,
    )
    ax.text(
        0,
        1.015,
        "Cada celda es el numero de menciones textuales del contaminante en esa seccion.",
        transform=ax.transAxes,
        fontsize=11,
        color="#5E6A75",
    )
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            value = int(matrix.iat[i, j])
            if value:
                ax.text(j, i, str(value), ha="center", va="center", fontsize=8.3, color="#111827")
    cbar = fig.colorbar(im, ax=ax, shrink=0.82, pad=0.02)
    cbar.set_label("Menciones", fontsize=10, color="#5E6A75")
    cbar.ax.tick_params(labelsize=9, colors="#5E6A75")
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    save_both(fig, output_dir / "heatmap_contaminante_por_seccion_top25")


def draw_algorithm_diagram(output_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(14, 8))
    fig.patch.set_facecolor("#FBFAF6")
    ax.set_facecolor("#FBFAF6")
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis("off")

    nodes = [
        (0.6, 5.7, "1. Entrada", "PDFs, abstracts\ny textos cientificos", "#176D87"),
        (3.2, 5.7, "2. Texto", "extraccion, limpieza\ny normalizacion", "#C45F35"),
        (5.8, 5.7, "3. Secciones", "titulo, resumen,\nmetodos, resultados", "#648A33"),
        (8.4, 5.7, "4. Lexicos", "contaminantes,\nenfermedades y sinonimos", "#6F3CE8"),
        (11.0, 5.7, "5. Menciones", "conteo por entidad,\narticulo y seccion", "#B45309"),
        (2.0, 2.6, "6. Contexto", "ventanas de texto,\ncues de exposicion", "#A33D5A"),
        (5.0, 2.6, "7. Clasificacion", "exposicion principal,\nvariable secundaria,\nsolo mencion", "#D8A64A"),
        (8.0, 2.6, "8. Relaciones", "contaminante ->\nenfermedad con evidencia", "#176D87"),
        (11.0, 2.6, "9. Salidas", "CSV, Excel, JSON,\ngraficos y auditoria", "#5E6A75"),
    ]

    def box(x: float, y: float, title: str, body: str, color: str) -> None:
        patch = FancyBboxPatch(
            (x, y),
            2.25,
            1.08,
            boxstyle="round,pad=0.025,rounding_size=0.06",
            linewidth=1.2,
            edgecolor="#E1D9CB",
            facecolor="#FFFFFF",
        )
        ax.add_patch(patch)
        ax.add_patch(plt.Rectangle((x, y + 1.02), 2.25, 0.06, color=color, linewidth=0))
        ax.text(x + 0.15, y + 0.76, title, fontsize=11.5, fontweight="bold", color=color, va="center")
        ax.text(x + 0.15, y + 0.39, body, fontsize=10, color="#15202B", va="center")

    for node in nodes:
        box(*node)

    arrows = [
        ((2.85, 6.24), (3.15, 6.24)),
        ((5.45, 6.24), (5.75, 6.24)),
        ((8.05, 6.24), (8.35, 6.24)),
        ((10.65, 6.24), (10.95, 6.24)),
        ((12.1, 5.7), (3.1, 3.68)),
        ((4.25, 3.14), (4.95, 3.14)),
        ((7.25, 3.14), (7.95, 3.14)),
        ((10.25, 3.14), (10.95, 3.14)),
    ]
    for start, end in arrows:
        ax.add_patch(
            FancyArrowPatch(
                start,
                end,
                arrowstyle="-|>",
                mutation_scale=12,
                linewidth=1.4,
                color="#AFA79B",
                connectionstyle="arc3,rad=0.0",
            )
        )

    ax.text(
        0.6,
        7.35,
        "Diagrama del algoritmo de conteo contextual",
        fontsize=22,
        fontweight="bold",
        color="#15202B",
    )
    ax.text(
        0.6,
        7.02,
        "El conteo simple se combina con secciones y contexto para distinguir menciones generales de variables trabajadas.",
        fontsize=12,
        color="#5E6A75",
    )
    ax.text(
        0.7,
        0.8,
        "Guardrail: ninguna asociacion se acepta sin fragmento de evidencia textual; K-Means se usa solo para exploracion de perfiles.",
        fontsize=11,
        color="#5E6A75",
    )
    save_both(fig, output_dir / "diagrama_algoritmo_conteo_contextual")


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera graficos de menciones totales y diagrama del algoritmo.")
    parser.add_argument("--mentions", default="outputs/review_miner/mentions.csv")
    parser.add_argument("--output-dir", default="outputs/review_miner/mention_figures")
    args = parser.parse_args()

    mentions_path = Path(args.mentions)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    mentions = pd.read_csv(mentions_path)

    contaminant_counts = build_contaminant_mentions(mentions)
    section_counts = build_section_mentions(mentions)
    contaminant_counts.to_csv(output_dir / "menciones_totales_por_contaminante.csv", index=False)
    section_counts.to_csv(output_dir / "menciones_totales_por_seccion.csv", index=False)

    plot_contaminant_mentions(contaminant_counts, output_dir)
    plot_section_mentions(section_counts, output_dir)
    plot_contaminant_section_heatmap(mentions, output_dir)
    draw_algorithm_diagram(output_dir)

    print(f"Graficos guardados en: {output_dir.resolve()}")
    print(f"Total contaminantes: {len(contaminant_counts)}")
    print(f"Total menciones de contaminantes: {int(contaminant_counts['menciones_totales'].sum())}")


if __name__ == "__main__":
    main()
