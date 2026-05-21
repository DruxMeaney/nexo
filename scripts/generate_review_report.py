#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

import pandas as pd
from docx import Document
from docx.shared import Inches


FIGURE_DESCRIPTIONS = {
    "frecuencia_contaminantes": "Frecuencia de contaminantes detectados como exposicion o variable analitica.",
    "frecuencia_enfermedades": "Frecuencia de enfermedades neurodegenerativas detectadas.",
    "heatmap_asociaciones": "Matriz de categorias contaminante-enfermedad basada en relaciones textuales.",
    "tipo_estudio": "Distribucion de articulos por tipo de estudio inferido.",
    "nivel_asociacion": "Relaciones agrupadas por nivel de asociacion textual.",
    "association_network": "Red exploratoria de relaciones contaminante-enfermedad.",
    "bubble_contaminant_disease": "Pares contaminante-enfermedad representados como burbujas por peso/frecuencia.",
    "top_association_pairs": "Pares de asociacion mas frecuentes.",
    "category_association_heatmap": "Heatmap avanzado por categorias.",
    "association_by_section": "Distribucion de evidencia por seccion del articulo.",
    "cluster_sizes": "Tamanos de clusters en K-Means exploratorio.",
    "kmeans_cluster_map": "Mapa K-Means para triage exploratorio y deteccion de outliers.",
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def add_metric_table(document: Document, metrics: dict[str, object]) -> None:
    table = document.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    header = table.rows[0].cells
    header[0].text = "Indicador"
    header[1].text = "Valor"
    for key, value in metrics.items():
        row = table.add_row().cells
        row[0].text = key
        row[1].text = str(value)


def add_top_relations(document: Document, relations: pd.DataFrame) -> None:
    if relations.empty:
        document.add_paragraph("No se encontraron relaciones contaminante-enfermedad con evidencia cercana.")
        return
    columns = ["contaminant", "disease", "association", "confidence", "section"]
    available = [column for column in columns if column in relations.columns]
    preview = relations[available].head(12)
    table = document.add_table(rows=1, cols=len(available))
    table.style = "Table Grid"
    for idx, column in enumerate(available):
        table.rows[0].cells[idx].text = column
    for _, data in preview.iterrows():
        row = table.add_row().cells
        for idx, column in enumerate(available):
            row[idx].text = str(data.get(column, ""))[:220]


def figure_rows(output_dir: Path) -> list[tuple[str, str]]:
    figures = sorted(
        [
            path
            for path in output_dir.rglob("*")
            if path.suffix.lower() in {".svg", ".png", ".jpg", ".jpeg", ".webp"}
        ]
    )
    rows = []
    for figure in figures:
        stem = figure.stem
        rows.append((str(figure.relative_to(output_dir)), FIGURE_DESCRIPTIONS.get(stem, "Figura generada por el pipeline.")))
    return rows


def add_figure_references(document: Document, rows: list[tuple[str, str]]) -> None:
    if not rows:
        document.add_paragraph("No se encontraron figuras en la carpeta de salida.")
        return
    table = document.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text = "Figura"
    table.rows[0].cells[1].text = "Descripcion"
    for file_name, description in rows:
        row = table.add_row().cells
        row[0].text = file_name
        row[1].text = description


def build_report(output_dir: Path) -> Path:
    articles = read_csv(output_dir / "articles.csv")
    mentions = read_csv(output_dir / "mentions.csv")
    summaries = read_csv(output_dir / "entity_summaries.csv")
    relations = read_csv(output_dir / "relations.csv")

    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)

    document.add_heading("Reporte de revision sistematica asistida", level=0)
    document.add_paragraph("Aplicacion: NEXO — Mineria de datos para revisiones.")
    document.add_paragraph(f"Fecha de generacion: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    document.add_paragraph(f"Carpeta de salida: {output_dir}")

    document.add_heading("Resumen ejecutivo", level=1)
    metrics = {
        "Articulos procesados": len(articles),
        "Articulos con texto extraible": int((articles.get("text_extractable", pd.Series(dtype=str)).astype(str).str.lower() == "si").sum())
        if not articles.empty
        else 0,
        "Menciones auditables": len(mentions),
        "Resumenes articulo-entidad": len(summaries),
        "Relaciones con evidencia textual cercana": len(relations),
        "Figuras generadas": len(figure_rows(output_dir)),
    }
    add_metric_table(document, metrics)

    document.add_heading("Metodo general", level=1)
    document.add_paragraph(
        "El analisis aplica un pipeline auditable basado en lexicos controlados de contaminantes y enfermedades, "
        "extraccion de texto desde PDFs, deteccion aproximada de secciones, ventanas de contexto, pistas de exposicion, "
        "dosis, asociacion, especulacion y negacion, ademas de relaciones contaminante-enfermedad por cercania textual."
    )
    document.add_paragraph(
        "Las salidas deben interpretarse como apoyo para revision sistematica y auditoria manual. Una mencion o "
        "co-ocurrencia no equivale a causalidad. Las asociaciones reportadas requieren confirmacion por lectura humana."
    )

    document.add_heading("Resultados principales", level=1)
    add_top_relations(document, relations)

    document.add_heading("Referencias a figuras generadas", level=1)
    add_figure_references(document, figure_rows(output_dir))

    document.add_heading("Advertencias metodologicas", level=1)
    document.add_paragraph(
        "Los resultados dependen de la calidad de extraccion de texto del PDF, de la cobertura de los lexicos y de la "
        "estructura textual del articulo. El sistema distingue mencion, co-ocurrencia y asociacion textual, pero no "
        "establece evidencia concluyente ni recomienda decisiones clinicas."
    )

    report_path = output_dir / "reporte_revision_nexo.docx"
    document.save(report_path)
    return report_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera reporte Word para las salidas de NEXO.")
    parser.add_argument("--output-dir", required=True, help="Carpeta de salida del pipeline.")
    args = parser.parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = build_report(output_dir)
    print(f"Reporte Word generado: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
