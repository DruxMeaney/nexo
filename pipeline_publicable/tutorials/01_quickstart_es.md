# Tutorial 01. Ejecución rápida

Este tutorial muestra cómo ejecutar el pipeline publicable desde cero.

## 1. Entradas esperadas

El pipeline espera:

- PDFs, TXT o MD en una carpeta de artículos.
- Un léxico de contaminantes en JSON.
- Un léxico de enfermedades en JSON.
- Opcionalmente, archivos Excel/CSV con metadatos.

En este proyecto, las entradas actuales son:

```text
Articulos/
config/review_miner_contaminants.json
config/review_miner_diseases.json
ArticulosTotales.xlsx
Base de articulos completa.xlsx
```

## 2. Comando recomendado

Ejecutar desde la carpeta raíz del proyecto:

```bash
/Users/drux/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  pipeline_publicable/run_pipeline_publicable.py \
  --input-dir Articulos \
  --output-dir outputs/review_miner_publication \
  --metadata "ArticulosTotales.xlsx,Base de articulos completa.xlsx" \
  --contaminants config/review_miner_contaminants.json \
  --diseases config/review_miner_diseases.json \
  --k 4 \
  --sample-size 200 \
  --kwic-radius 160
```

## 3. Qué hace el comando

El comando ejecuta:

1. lectura de PDFs y metadatos;
2. detección de tipo de estudio;
3. extracción de contaminantes y enfermedades;
4. extracción de contexto KWIC;
5. clasificación del rol de contaminante/enfermedad;
6. extracción de relaciones contaminante-enfermedad;
7. exportación de tablas para revisión sistemática;
8. cálculo de TF-IDF y frecuencias normalizadas;
9. comparación de co-ocurrencia artículo-vs-evidencia;
10. generación de plantillas de validación manual;
11. visual analytics con K-Means.

## 4. Parámetros importantes

`--kwic-radius` define cuántos caracteres se guardan a cada lado de la palabra detectada. El valor actual es 160.

`--sample-size` define cuántas filas se guardan en las plantillas de validación manual.

`--k` define cuántos clusters usa K-Means en el análisis exploratorio.

`--skip-advanced-visuals` permite saltar K-Means y las figuras avanzadas si solo se quieren las tablas.

## 5. Salida esperada

Al terminar, deberías ver algo parecido a:

```text
Articles processed: 79
Articles without extractable text: 1
Mentions extracted: 14739
Article-entity summaries: 825
Contaminant-disease relations: 936
Publication tables: outputs/review_miner_publication/publication_pipeline
```
