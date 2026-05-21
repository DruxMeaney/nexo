from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle


COLORS = {
    "bg": "#FBFAF6",
    "ink": "#15202B",
    "muted": "#5E6A75",
    "line": "#DCD6CA",
    "blue": "#176D87",
    "copper": "#C45F35",
    "green": "#648A33",
    "violet": "#6F3CE8",
    "gold": "#D8A64A",
    "rose": "#A33D5A",
    "slate": "#60707E",
    "pale_blue": "#EAF4F7",
    "pale_gold": "#FFF5DD",
    "white": "#FFFFFF",
}


def box(ax, x, y, w, h, title, body, color, number=None, fill="#FFFFFF"):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.03,rounding_size=0.06",
        linewidth=1.4,
        edgecolor=COLORS["line"],
        facecolor=fill,
        zorder=2,
    )
    ax.add_patch(patch)
    ax.add_patch(Rectangle((x, y + h - 0.09), w, 0.09, facecolor=color, edgecolor="none", zorder=3))
    prefix = f"{number}. " if number is not None else ""
    ax.text(x + 0.18, y + h - 0.34, f"{prefix}{title}", fontsize=12.2, fontweight="bold", color=color, va="top", zorder=4)
    ax.text(x + 0.18, y + h - 0.78, body, fontsize=9.4, color=COLORS["ink"], va="top", linespacing=1.12, zorder=4)


def arrow(ax, start, end, rad=0.0, color="#AFA79B"):
    ax.add_patch(
        FancyArrowPatch(
            start,
            end,
            arrowstyle="-|>",
            mutation_scale=15,
            linewidth=1.7,
            color=color,
            alpha=0.78,
            connectionstyle=f"arc3,rad={rad}",
            zorder=1,
        )
    )


def small_note(ax, x, y, w, h, title, body, color):
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.02,rounding_size=0.04",
            linewidth=1.1,
            edgecolor=COLORS["line"],
            facecolor=COLORS["white"],
            zorder=2,
        )
    )
    ax.add_patch(Rectangle((x, y), 0.08, h, facecolor=color, edgecolor="none", zorder=3))
    ax.text(x + 0.22, y + h - 0.22, title, fontsize=10.2, fontweight="bold", color=color, va="top", zorder=4)
    ax.text(x + 0.22, y + h - 0.56, body, fontsize=8.8, color=COLORS["ink"], va="top", linespacing=1.12, zorder=4)


def main() -> None:
    out_dir = Path("outputs/review_miner/mention_figures")
    out_dir.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(18, 14))
    fig.patch.set_facecolor(COLORS["bg"])
    ax.set_facecolor(COLORS["bg"])
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 14)
    ax.axis("off")

    ax.text(0.55, 13.45, "Algoritmo de conteo de palabras con contexto", fontsize=28, fontweight="bold", color=COLORS["ink"], va="top")
    ax.text(
        0.55,
        13.02,
        "El conteo crudo identifica apariciones; el contexto se incorpora despues usando seccion, ventana textual y reglas auditables.",
        fontsize=13.5,
        color=COLORS["muted"],
        va="top",
    )

    # Phase labels
    ax.text(0.65, 12.1, "A. Preparacion del texto", fontsize=11, fontweight="bold", color=COLORS["blue"])
    ax.text(6.35, 12.1, "B. Conteo crudo", fontsize=11, fontweight="bold", color=COLORS["copper"])
    ax.text(10.2, 12.1, "C. Interpretacion contextual", fontsize=11, fontweight="bold", color=COLORS["violet"])
    ax.text(14.1, 12.1, "D. Salidas auditables", fontsize=11, fontweight="bold", color=COLORS["green"])

    # Top pipeline
    box(ax, 0.6, 10.45, 2.45, 1.35, "Entrada", "PDFs, abstracts,\ntextos cientificos,\nmetadatos", COLORS["blue"], 1)
    box(ax, 3.45, 10.45, 2.45, 1.35, "Extraccion", "PDF -> texto;\nOCR si hace falta;\nID del articulo", COLORS["blue"], 2)
    box(ax, 6.3, 10.45, 2.45, 1.35, "Normalizacion", "minusculas,\nacentos, espacios,\nlimpieza basica", COLORS["blue"], 3)
    box(ax, 9.15, 10.45, 2.45, 1.35, "Secciones", "titulo/resumen;\nintroduccion;\nmetodos/resultados", COLORS["green"], 4)
    box(ax, 12.0, 10.45, 2.45, 1.35, "Lexicos", "contaminantes,\nenfermedades,\nsinonimos ES/EN", COLORS["violet"], 5)
    box(ax, 14.85, 10.45, 2.45, 1.35, "Mencion cruda", "match exacto o\nsinonimo detectado;\nse suma 1 mencion", COLORS["copper"], 6)

    for sx, ex in [(3.05, 3.42), (5.9, 6.27), (8.75, 9.12), (11.6, 11.97), (14.45, 14.82)]:
        arrow(ax, (sx, 11.12), (ex, 11.12))

    # Highlight context region
    highlight = FancyBboxPatch(
        (0.55, 5.55),
        17.0,
        3.75,
        boxstyle="round,pad=0.04,rounding_size=0.08",
        linewidth=1.6,
        linestyle="--",
        edgecolor=COLORS["gold"],
        facecolor=COLORS["pale_gold"],
        alpha=0.55,
        zorder=0,
    )
    ax.add_patch(highlight)
    ax.text(0.82, 8.93, "Aqui es donde el algoritmo empieza a 'entender contexto'", fontsize=14, fontweight="bold", color=COLORS["gold"], zorder=4)
    ax.text(
        0.82,
        8.63,
        "No basta con encontrar la palabra; se evalua donde aparece, que palabras la rodean y si hay pistas de experimento, exposicion o asociacion.",
        fontsize=11,
        color=COLORS["muted"],
        zorder=4,
    )

    # Context steps
    box(
        ax,
        0.95,
        6.6,
        2.95,
        1.35,
        "Ubicar seccion",
        "La misma palabra pesa distinto:\nmetodos/resultados >\nintroduccion/referencias.",
        COLORS["green"],
        7,
        fill="#FFFFFF",
    )
    box(
        ax,
        4.35,
        6.6,
        2.95,
        1.35,
        "Extraer ventana",
        "Se guarda oracion y texto\nalrededor de la mencion\npara auditoria humana.",
        COLORS["violet"],
        8,
    )
    box(
        ax,
        7.75,
        6.6,
        2.95,
        1.35,
        "Buscar pistas",
        "exposed, dose, treated,\nmeasured, model, patients,\nrisk, not.",
        COLORS["rose"],
        9,
    )
    box(
        ax,
        11.15,
        6.6,
        2.95,
        1.35,
        "Comparar entidades",
        "Si contaminante y enfermedad\naparecen cerca, se propone\nrelacion candidata.",
        COLORS["blue"],
        10,
    )
    box(
        ax,
        14.55,
        6.6,
        2.45,
        1.35,
        "Reglas",
        "combina seccion,\npistas, cercania\ny negacion.",
        COLORS["copper"],
        11,
    )

    for sx, ex in [(3.9, 4.32), (7.3, 7.72), (10.7, 11.12), (14.1, 14.52)]:
        arrow(ax, (sx, 7.28), (ex, 7.28))
    arrow(ax, (16.08, 10.42), (15.4, 8.0), rad=-0.18, color="#B9AA8D")
    ax.text(14.05, 8.1, "cada mencion cruda\nse evalua aqui", fontsize=9.5, color=COLORS["muted"], ha="center")

    # Decision layer
    box(
        ax,
        0.95,
        3.3,
        3.25,
        1.35,
        "Rol del contaminante",
        "exposicion principal;\nvariable secundaria;\nsolo mencion; no claro",
        COLORS["copper"],
        12,
    )
    box(
        ax,
        4.65,
        3.3,
        3.25,
        1.35,
        "Nivel de confianza",
        "Alta: metodos/resultados;\nMedia: abstract/discusion;\nBaja: mencion ambigua",
        COLORS["violet"],
        13,
    )
    box(
        ax,
        8.35,
        3.3,
        3.25,
        1.35,
        "Asociacion",
        "fuerte, debil,\nespeculativa o evidencia\ninsuficiente",
        COLORS["green"],
        14,
    )
    box(
        ax,
        12.05,
        3.3,
        2.85,
        1.35,
        "Evidencia textual",
        "fragmento exacto,\nseccion, articulo,\npagina si existe",
        COLORS["blue"],
        15,
    )
    box(
        ax,
        15.3,
        3.3,
        2.0,
        1.35,
        "Tablas y graficos",
        "CSV, Excel,\nJSON, graficos,\nredes y K-Means",
        COLORS["slate"],
        16,
    )

    arrow(ax, (15.78, 6.57), (2.58, 4.68), rad=0.08, color="#B9AA8D")
    for sx, ex in [(4.2, 4.62), (7.9, 8.32), (11.6, 12.02), (14.9, 15.27)]:
        arrow(ax, (sx, 3.98), (ex, 3.98))

    # Examples
    small_note(
        ax,
        0.9,
        1.0,
        5.1,
        1.2,
        "Ejemplo A: contexto experimental",
        "'Rats were exposed to aluminum chloride...'\nen metodos/resultados -> exposicion principal\no variable analitica.",
        COLORS["green"],
    )
    small_note(
        ax,
        6.35,
        1.0,
        5.1,
        1.2,
        "Ejemplo B: mencion general",
        "'Aluminum has been suggested...'\nen introduccion -> mencion contextual\no especulativa.",
        COLORS["gold"],
    )
    small_note(
        ax,
        11.8,
        1.0,
        5.1,
        1.2,
        "Ejemplo C: bibliografia",
        "Si aparece solo en referencias,\ncuenta como mencion, pero no como\nvariable trabajada.",
        COLORS["rose"],
    )

    ax.text(
        0.6,
        0.38,
        "Resultado clave: el algoritmo separa conteo literal, inferencia contextual y evidencia auditable; no inventa asociaciones sin texto de respaldo.",
        fontsize=12,
        fontweight="bold",
        color=COLORS["ink"],
    )

    png = out_dir / "diagrama_algoritmo_conteo_contextual_detallado.png"
    svg = out_dir / "diagrama_algoritmo_conteo_contextual_detallado.svg"
    fig.savefig(png, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    fig.savefig(svg, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(png.resolve())
    print(svg.resolve())


if __name__ == "__main__":
    main()
