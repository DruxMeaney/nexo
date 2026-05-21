#!/usr/bin/env python3
"""Root CLI for the protocol-driven review_miner pipeline.

Usage:
    python3 run_review_miner.py \
        --protocol config/protocols/my-protocol \
        --input-dir Articulos \
        --output-dir outputs/my-run

The protocol folder is produced by the NEXO wizard
(``/protocolo/nuevo``); it carries the two variables, lexical cues, section
weights and numeric parameters. No domain assumptions remain in the CLI.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from review_miner.pipeline import run_pipeline
from review_miner.protocol import load_protocol


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Protocol-driven literature mining: extract Variable-A / Variable-B "
            "mentions and evidence-backed relations from a folder of PDFs."
        )
    )
    parser.add_argument(
        "--protocol",
        required=True,
        help="Carpeta del protocolo (ver `config/protocols/`).",
    )
    parser.add_argument(
        "--input-dir",
        default="Articulos",
        help="Carpeta con PDFs, TXT o MD.",
    )
    parser.add_argument(
        "--output-dir",
        default="outputs/review_miner",
        help="Carpeta de salida.",
    )
    parser.add_argument(
        "--metadata",
        default="ArticulosTotales.xlsx,Base de articulos completa.xlsx",
        help="CSV/XLSX opcional con metadatos; separa varios por coma.",
    )
    args = parser.parse_args()

    protocol = load_protocol(args.protocol)
    results = run_pipeline(
        protocol=protocol,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        metadata_paths=args.metadata,
    )

    print(f"Protocolo: {protocol.identity.name or '(sin nombre)'}")
    print(f"  Variable A: {protocol.variable_a.display_name}")
    print(f"  Variable B: {protocol.variable_b.display_name}")
    print(f"Articulos procesados: {len(results['articles'])}")
    print(f"Articulos sin texto extraible: {sum(1 for a in results['articles'] if not a.text_extractable)}")
    print(f"Menciones extraidas: {len(results['mentions'])}")
    print(f"Resumenes articulo-entidad: {len(results['summaries'])}")
    print(f"Relaciones A↔B con evidencia textual: {len(results['relations'])}")
    print(f"Salidas: {Path(args.output_dir).resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
