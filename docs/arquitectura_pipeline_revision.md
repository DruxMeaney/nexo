# Pipeline auditable para revision sistematica

## Enfoque recomendado

Para esta tarea conviene empezar con un sistema hibrido basado en reglas linguisticas, diccionarios expertos y evidencia textual. La razon principal es metodologica: en una revision sistematica importa que cada decision pueda auditarse. Un modelo opaco puede clasificar bien, pero si no guarda el fragmento textual que sustenta la decision, no sirve como herramienta primaria de extraccion.

El pipeline implementado separa tres niveles:

1. Extraccion literal: menciones exactas de contaminantes y enfermedades.
2. Inferencia contextual: clasificacion del rol de la mencion segun seccion, dosis, exposicion, modelo experimental y contexto.
3. Relacion contaminante-enfermedad: solo se emite si ambas entidades aparecen cerca y hay un fragmento textual que pueda auditarse.

## Por que no K-Means como metodo principal

K-Means no es adecuado como clasificador principal porque agrupa documentos por similitud global, pero no responde de forma trazable si un contaminante fue la exposicion principal, una variable secundaria o una simple mencion bibliografica. Puede ser util despues para exploracion tematica, deteccion de grupos de articulos o revision de outliers.

PCA tampoco clasifica; sirve para reducir dimensiones y visualizar embeddings o matrices TF-IDF.

## Donde si entra Machine Learning

La ruta mas solida es:

1. Ejecutar este pipeline basado en reglas.
2. Revisar manualmente una muestra de `systematic_review_table.csv`.
3. Agregar etiquetas humanas: contaminante principal, secundario, contexto, asociacion fuerte/debil/especulativa.
4. Entrenar un clasificador supervisado con ejemplos validados.

Opciones futuras:

- TF-IDF + regresion logistica/SVM: fuerte, barato y explicable.
- Embeddings cientificos: utiles para sinonimos, contaminantes nuevos y similitud semantica.
- Modelos biomédicos preentrenados: BioBERT/SciBERT/PubMedBERT, si se cuenta con GPU o infraestructura.
- NER biomédico: util si se requiere ir mas alla de diccionarios, pero debe validarse contra falsos positivos.

## Arquitectura

```text
RevisionContaminantes/
  config/
    review_miner_contaminants.json
    review_miner_diseases.json
  review_miner/
    io.py              # lectura de PDFs, TXT, metadatos Excel/CSV
    lexicon.py         # carga de diccionarios controlados
    sections.py        # deteccion de secciones
    text.py            # ventanas de contexto y segmentacion simple
    extract.py         # extraccion de menciones y cues
    classify.py        # clasificacion de rol y tipo de estudio
    relations.py       # relaciones contaminante-enfermedad con evidencia
    export.py          # CSV, Excel, JSON
    visualize.py       # graficas SVG sin dependencias pesadas
    pipeline.py        # orquestador
  run_review_miner.py  # CLI
  outputs/review_miner/
    articles.csv
    mentions.csv
    entity_summaries.csv
    relations.csv
    systematic_review_table.csv
    review_miner_results.xlsx
    review_miner_results.json
    figures/*.svg
```

## Supuestos actuales

- Los archivos de entrada estan en `Articulos/` y pueden ser PDF, TXT o MD.
- Los metadatos se leen desde `ArticulosTotales.xlsx` y `Base de articulos completa.xlsx` cuando el ID coincide.
- Si un PDF no tiene capa de texto, queda marcado como no extraible. En esta carpeta ocurre con `C7.pdf`.
- La deteccion de secciones usa encabezados frecuentes en ingles y espanol.
- La clasificacion es conservadora: si no hay evidencia textual cercana, la asociacion queda como `sin_evidencia_suficiente`.

## Guardrails implementados

- No se inventan entidades: solo se extraen si aparecen por patron del diccionario.
- Cada relacion incluye `evidence_text`.
- `extraction_or_inference` separa extraccion literal de inferencia contextual.
- Las relaciones negativas o ambiguas se degradan con `cue_negation` y `cue_speculative`.
- Una mencion en referencias no basta para clasificar una exposicion principal.
- Los resultados incluyen `confidence` y `confidence_score`.

## Ejecucion

```bash
/Users/drux/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 run_review_miner.py \
  --input-dir Articulos \
  --metadata "ArticulosTotales.xlsx,Base de articulos completa.xlsx" \
  --contaminants config/review_miner_contaminants.json \
  --diseases config/review_miner_diseases.json \
  --output-dir outputs/review_miner
```

## Salidas principales

- `articles.csv`: diagnostico de articulos, tipo de estudio, DOI, año y extraccion de texto.
- `mentions.csv`: una fila por mencion, con seccion, pagina estimada, contexto y cues.
- `entity_summaries.csv`: resumen por articulo-entidad.
- `relations.csv`: relaciones contaminante-enfermedad con evidencia textual.
- `systematic_review_table.csv`: tabla integrada orientada a revision sistematica.
- `review_miner_results.xlsx`: todas las tablas en un libro Excel.
- `figures/`: graficas SVG de frecuencia, matriz y tipos de estudio.

## Extender a ingles y espanol

El sistema ya usa patrones bilingues. Para mejorar cobertura:

- Agregar sinonimos en los JSON de `config/`.
- Agregar encabezados de seccion adicionales en `review_miner/sections.py`.
- Agregar cues en `review_miner/extract.py`.
- Validar falsos positivos por idioma en `mentions.csv`.

## Interpretacion responsable

Las salidas son apoyo para cribado, extraccion y auditoria. No deben convertirse automaticamente en conclusiones cientificas. Antes de reportar asociaciones en el manuscrito, revisar manualmente `evidence_text`, `section`, `confidence` y el texto original.
