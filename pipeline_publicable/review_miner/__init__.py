"""Protocol-driven auditable literature-mining pipeline.

The pipeline accepts any two-variable systematic review (contaminants vs
diseases, drugs vs adverse effects, species vs ecosystems, ...) defined as
a protocol folder. See :func:`review_miner.protocol.load_protocol` and
:func:`review_miner.pipeline.run_pipeline`.
"""

from .protocol import Protocol, load_protocol

__all__ = [
    "Protocol",
    "load_protocol",
    "schema",
    "lexicon",
    "io",
    "sections",
    "extract",
    "classify",
    "relations",
    "export",
    "visualize",
    "visual_analytics",
    "publication_extensions",
    "publication_pipeline",
    "pipeline",
    "protocol",
]
