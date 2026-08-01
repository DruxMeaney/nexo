# Pipeline publicable para revisión sistemática

Esta carpeta contiene la versión extendida del pipeline de minería de literatura científica para contaminantes ambientales y enfermedades neurodegenerativas.

La versión publicable conserva el pipeline auditable original y añade componentes inspirados en metodologías publicadas:

- conteo de entidades por léxicos controlados;
- ventanas KWIC para revisar contexto;
- ponderación por secciones IMRaD;
- detección de pistas de exposición, dosis, asociación, especulación y negación;
- extracción de relaciones contaminante-enfermedad por proximidad textual;
- frecuencia normalizada por 10,000 palabras;
- matrices TF-IDF por artículo;
- comparación entre co-ocurrencia a nivel artículo y relación con evidencia cercana;
- tablas de sensibilidad de pesos por sección;
- plantillas de validación manual;
- K-Means y visual analytics exploratorios.

## Ejecución rápida

Desde la carpeta principal del proyecto:

```bash
python3 \
  pipeline_publicable/run_pipeline_publicable.py \
  --protocol config/protocols/contaminantes-enfermedades-neurodegenerativas \
  --input-dir Articulos \
  --output-dir outputs/review_miner_publication \
  --metadata "ArticulosTotales.xlsx,Base de articulos completa.xlsx"
```

## Salidas principales

El pipeline genera dos niveles de resultados:

1. Salidas base en `outputs/review_miner_publication/`:
   - `articles.csv`
   - `mentions.csv`
   - `entity_summaries.csv`
   - `relations.csv`
   - `systematic_review_table.csv`
   - `review_miner_results.xlsx`

2. Salidas extendidas en `outputs/review_miner_publication/publication_pipeline/`:
   - `kwic_concordance.csv`
   - `entity_frequency_summary.csv`
   - `contaminant_article_term_counts.csv`
   - `contaminant_article_term_per_10k_words.csv`
   - `contaminant_article_term_tfidf.csv`
   - `disease_article_term_counts.csv`
   - `disease_article_term_per_10k_words.csv`
   - `disease_article_term_tfidf.csv`
   - `cooccurrence_article_vs_evidence.csv`
   - `section_weight_rationale.csv`
   - `section_weight_sensitivity.csv`
   - `manual_validation_entity_roles.csv`
   - `manual_validation_relations.csv`
   - `publication_pipeline_tables.xlsx`

## Tutoriales

- [01_quickstart_es.md](tutorials/01_quickstart_es.md): cómo ejecutar el pipeline.
- [02_outputs_es.md](tutorials/02_outputs_es.md): qué significa cada tabla.
- [03_algorithms_es.md](tutorials/03_algorithms_es.md): para qué sirve cada algoritmo.
- [04_validation_es.md](tutorials/04_validation_es.md): cómo usar las plantillas de validación manual.

## Metodología publicable

El texto metodológico en inglés, con referencias Vancouver, está en:

- [methods_for_indexed_journal_vancouver.md](methodology/methods_for_indexed_journal_vancouver.md)

También se genera una versión Word en esta misma carpeta cuando se corre `pandoc`.

## Nota metodológica importante

Las partes inspiradas en literatura publicada son: text mining para revisión sistemática, KWIC, TF-IDF, relación químico-enfermedad, co-ocurrencia, análisis por secciones IMRaD, K-Means exploratorio y visual analytics. Las partes propias del proyecto son: léxicos específicos, pesos exactos por sección, reglas de confianza, score fuerza × confianza y adaptación a contaminantes ambientales/neurodegeneración.

## Código incluido en esta carpeta

La carpeta incluye una copia del paquete Python actualizado en:

```text
pipeline_publicable/review_miner/
```

El ejecutable `run_pipeline_publicable.py` carga primero esa copia local. Esto deja la versión publicable empaquetada en una sola carpeta, aunque los datos de entrada y los léxicos actuales sigan viviendo en:

```text
Articulos/
config/
```
