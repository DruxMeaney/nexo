# Algoritmo contextual para contaminantes

Este proyecto incluye una primera version auditable para identificar contaminantes mencionados en los articulos y estimar si cada contaminante fue trabajado como exposicion/ensayo o si solo aparece como contexto.

## Idea central

Un conteo simple de palabras no basta, porque un articulo puede mencionar "paraquat" en la introduccion, pero trabajar experimentalmente con cadmio. Por eso el algoritmo combina:

1. Extraccion de texto desde PDFs.
2. Diccionario editable de contaminantes y sinonimos.
3. Deteccion aproximada de secciones del articulo: titulo/resumen, introduccion, metodos, resultados, discusion, conclusiones y referencias.
4. Busqueda de pistas contextuales cercanas a cada mencion: exposicion, dosis, concentracion, grupo control, medicion, mg/L, ppm, ug/L, etc.
5. Clasificacion por score en categorias auditables.

## Archivos principales

- `analisis_contexto_contaminantes.py`: script principal.
- `contaminantes_lexico.json`: diccionario editable de contaminantes, familias y patrones.
- `salidas_contexto_contaminantes/menciones_auditables.csv`: una fila por mencion encontrada.
- `salidas_contexto_contaminantes/resumen_contaminantes_por_articulo.csv`: resumen por articulo-contaminante.
- `salidas_contexto_contaminantes/resumen_articulos.csv`: vista por articulo.
- `salidas_contexto_contaminantes/resumen_categorias.csv`: vista por familia.
- `salidas_contexto_contaminantes/graficas/*.svg`: graficas vectoriales.

## Como correrlo

```bash
/Users/drux/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 analisis_contexto_contaminantes.py
```

Con parametros explicitos:

```bash
/Users/drux/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 analisis_contexto_contaminantes.py \
  --pdf-dir Articulos \
  --lexicon contaminantes_lexico.json \
  --metadata-xlsx "ArticulosTotales.xlsx,Base de articulos completa.xlsx" \
  --output-dir salidas_contexto_contaminantes
```

## Clasificaciones

- `trabajado_como_exposicion_o_ensayo`: hay evidencia en titulo/resumen, metodos o resultados, junto con pistas de exposicion, medicion o dosis.
- `posible_secundario`: el contaminante aparece en un contexto informativo, pero la evidencia no basta para decir que es la exposicion central.
- `mencion_de_contexto`: aparece como antecedente o comparacion.
- `solo_referencias`: aparece unicamente en referencias.
- `revision_o_sintesis`: el articulo parece una revision; se separa de estudios primarios.

## Sobre Machine Learning

K-means y PCA no son la primera herramienta para esta pregunta.

- `PCA` sirve para visualizar o reducir dimensiones, pero no decide si un contaminante fue trabajado.
- `K-means` puede agrupar articulos por vocabulario, pero los grupos no equivalen automaticamente a "contaminante estudiado".
- Un clasificador supervisado si seria util despues: se etiquetan manualmente ejemplos como `trabajado`, `secundario` o `contexto`, y se entrena un modelo con esas etiquetas.

La ruta recomendada es:

1. Usar este algoritmo de reglas para producir una primera tabla auditable.
2. Revisar manualmente una muestra de menciones y corregir falsos positivos/falsos negativos en el lexico o las reglas.
3. Crear una columna de validacion humana.
4. Si hay suficientes ejemplos validados, entrenar un clasificador supervisado.

## Limitaciones conocidas

- La deteccion de secciones depende de que el PDF tenga texto extraible y encabezados reconocibles.
- `C7.pdf` no tiene capa de texto extraible; requiere OCR para integrarse automaticamente.
- Los terminos genericos, como `pesticides` o `persistent organic pollutants`, deben interpretarse con cautela.
- El algoritmo favorece transparencia y auditabilidad sobre sofisticacion opaca.
