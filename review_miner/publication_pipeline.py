"""Top-level orchestrator for the publication-ready pipeline.

Wraps :func:`review_miner.pipeline.run_pipeline` with the publication
extensions (KWIC, TF-IDF, cooccurrence, manual validation templates) and
the advanced visual analytics. The single source of configuration is the
protocol folder passed via ``--protocol``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .pipeline import run_pipeline
from .protocol import Protocol, load_protocol
from .publication_extensions import export_publication_extensions
from .visual_analytics import run_visual_analytics


def run_publication_pipeline(
    protocol: Protocol,
    input_dir: str | Path,
    output_dir: str | Path,
    metadata_paths: str | None = None,
    k: int | None = None,
    sample_size: int | None = None,
    kwic_radius: int | None = None,
    run_advanced_visuals: bool = True,
) -> dict[str, object]:
    """Run the auditable pipeline plus publication-oriented extensions."""

    output_dir = Path(output_dir)
    results = run_pipeline(
        protocol=protocol,
        input_dir=input_dir,
        output_dir=output_dir,
        metadata_paths=metadata_paths,
    )
    publication_paths = export_publication_extensions(
        output_dir=output_dir,
        articles=results["articles"],
        mentions=results["mentions"],
        summaries=results["summaries"],
        relations=results["relations"],
        protocol=protocol,
        sample_size=sample_size if sample_size is not None else protocol.analysis.validation_sample_size,
        kwic_radius=kwic_radius if kwic_radius is not None else protocol.analysis.kwic_radius,
    )
    visual_paths: dict[str, Path] = {}
    if run_advanced_visuals:
        visual_paths = run_visual_analytics(
            protocol=protocol,
            input_dir=output_dir,
            output_dir=output_dir / "visual_analytics",
            k=k,
        )

    return {
        **results,
        "publication_paths": publication_paths,
        "advanced_visual_paths": visual_paths,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Pipeline publicable para revisión sistemática: extracción contextual, "
            "KWIC, TF-IDF, co-ocurrencia, validación manual y visual analytics. "
            "Toda la configuración se carga desde el protocolo (--protocol)."
        )
    )
    parser.add_argument("--protocol", required=True, help="Carpeta del protocolo (ver `config/protocols/`).")
    parser.add_argument("--input-dir", default="Articulos", help="Carpeta con PDFs, TXT o MD.")
    parser.add_argument("--output-dir", default="outputs/review_miner_publication", help="Carpeta de salida.")
    parser.add_argument(
        "--metadata",
        default="ArticulosTotales.xlsx,Base de articulos completa.xlsx",
        help="Archivos CSV/XLSX opcionales con metadatos separados por coma.",
    )
    parser.add_argument("--k", type=int, default=None, help="Override del K-Means.")
    parser.add_argument("--sample-size", type=int, default=None, help="Override del tamaño de muestra para validación manual.")
    parser.add_argument("--kwic-radius", type=int, default=None, help="Override del radio KWIC.")
    parser.add_argument("--skip-advanced-visuals", action="store_true", help="Omite K-Means y figuras avanzadas.")
    args = parser.parse_args()

    protocol = load_protocol(args.protocol)
    results = run_publication_pipeline(
        protocol=protocol,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        metadata_paths=args.metadata,
        k=args.k,
        sample_size=args.sample_size,
        kwic_radius=args.kwic_radius,
        run_advanced_visuals=not args.skip_advanced_visuals,
    )

    print(f"Protocolo: {protocol.identity.name or '(sin nombre)'}")
    print(f"  Variable A: {protocol.variable_a.display_name}")
    print(f"  Variable B: {protocol.variable_b.display_name}")
    print(f"Articulos procesados: {len(results['articles'])}")
    print(f"Articulos sin texto extraible: {sum(1 for a in results['articles'] if not a.text_extractable)}")
    print(f"Menciones extraidas: {len(results['mentions'])}")
    print(f"Resumenes articulo-entidad: {len(results['summaries'])}")
    print(f"Relaciones A↔B con evidencia textual: {len(results['relations'])}")
    print(f"Tablas de publicacion: {Path(args.output_dir, 'publication_pipeline').resolve()}")
    print(f"Carpeta de salida: {Path(args.output_dir).resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
