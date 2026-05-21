# Visualizacion de asociaciones y modelos exploratorios

## Que modelo conviene usar

Para estos datos, el objetivo principal no es predecir una variable numerica, sino explorar patrones entre articulos, contaminantes, enfermedades, tipo de estudio y fuerza de evidencia. Por eso:

- **Red bipartita**: es la visualizacion mas directa para asociaciones contaminante-enfermedad.
- **Matriz de burbujas**: ayuda a ver pares especificos con mayor peso de evidencia.
- **Heatmap de categorias**: resume patrones por familias de contaminantes y enfermedades.
- **K-Means**: util como exploracion de perfiles de articulos, pero no como evidencia cientifica.
- **Regresion lineal**: no es prioritaria aqui porque las variables son mayormente categoricas, conteos y etiquetas de evidencia. Si se define una variable objetivo, convendrian mas regresion logistica, Poisson/neg-binomial o modelos supervisados.

## Interpretacion de K-Means

El script crea una matriz articulo x caracteristicas con:

- categorias de contaminantes,
- contaminantes especificos,
- categorias de enfermedades,
- enfermedades especificas,
- tipo de estudio,
- secciones donde aparecen asociaciones,
- pares contaminante-enfermedad,
- fuerza y confianza de las relaciones.

Luego aplica `log1p` para reducir outliers, estandariza las columnas y aplica K-Means implementado con `numpy`. PCA ya no se usa en esta version.

Importante: si los clusters salen desbalanceados, eso no es necesariamente un error tecnico; puede indicar que hay pocos articulos con perfiles muy extremos y que K-Means no resume todo el corpus de forma uniforme. Por eso los graficos de red, burbujas y heatmap deben considerarse prioritarios para interpretar asociaciones.

## Como ejecutar

```bash
/Users/drux/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 run_visual_analytics.py \
  --input-dir outputs/review_miner \
  --output-dir outputs/review_miner/visual_analytics \
  --k 4
```

## Salidas

- `advanced_figures/association_network.svg`: red bipartita contaminante-enfermedad.
- `advanced_figures/bubble_contaminant_disease.svg`: matriz de burbujas por pares especificos.
- `advanced_figures/category_association_heatmap.svg`: heatmap por categorias.
- `advanced_figures/association_by_section.svg`: fuerza de asociaciones por seccion.
- `advanced_figures/top_association_pairs.svg`: pares con mayor peso.
- `advanced_figures/kmeans_cluster_map.svg`: mapa K-Means sin PCA; muestra cluster, distancia al centroide y peso de evidencia.
- `kmeans_articles.csv`: cluster, distancia al centroide y peso de relaciones por articulo.
- `kmeans_centroids.csv`: rasgos que definen cada centroide.
- `cluster_profiles.csv`: rasgos dominantes de cada cluster.
- `association_pairs_collapsed.csv`: tabla ponderada por par contaminante-enfermedad.
- `association_pairs_by_type.csv`: tabla por par y tipo de asociacion.

Las figuras SVG se generan en formato amplio para lectura en pantalla grande o exportacion a imagen/PDF. En el mapa K-Means se etiquetan articulos con alto peso de relaciones o alta distancia al centroide; todos los puntos conservan tooltip dentro del SVG.

## Ponderacion

Las relaciones se ponderan asi:

- `asociacion_fuerte`: 3
- `asociacion_debil`: 2
- `mencion_especulativa`: 1
- `sin_evidencia_suficiente`: 0

Y por confianza:

- `Alta`: 3
- `Media`: 2
- `Baja`: 1

El peso final es `peso_asociacion * peso_confianza`.

## Siguiente mejora recomendada

Antes de modelos predictivos, conviene revisar una muestra de `relations.csv` y crear una etiqueta humana:

- relacion correcta / incorrecta,
- contaminante principal / secundario / contexto,
- enfermedad principal / secundaria / contexto.

Con esas etiquetas, el siguiente paso seria un clasificador supervisado interpretable, por ejemplo regresion logistica o SVM con TF-IDF, y despues embeddings cientificos si el corpus crece.
