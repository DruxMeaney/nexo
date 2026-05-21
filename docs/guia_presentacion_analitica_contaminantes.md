# Guía de exposición del PPT: analítica de contaminantes y neurodegeneración

Esta guía acompaña la presentación `analitica_contaminantes_neurodegeneracion.pptx`.
Su objetivo es ayudarte a explicar qué significa cada figura, qué relación matemática representa y por qué es útil para una revisión sistemática. La idea central que conviene repetir durante la exposición es:

> Estas gráficas no cierran conclusiones causales; organizan la evidencia textual para priorizar auditoría manual, extracción sistemática y lectura crítica de los artículos.

## Diapositiva 1. Portada y tamaño del corpus

**Mensaje principal.** La presentación resume una estrategia computacional para analizar 79 artículos científicos mediante conteo contextual, extracción de evidencia y visualización exploratoria.

**Qué muestra.** Presenta tres cifras de arranque: 79 artículos procesados, 14,739 menciones detectadas y 936 relaciones contaminante-enfermedad con algún fragmento de evidencia textual.

**Cómo explicarla.** Aquí conviene aclarar que una "mención" es una aparición textual de un término detectado por el léxico, mientras que una "relación con evidencia" exige algo más: que contaminante y enfermedad aparezcan en un contexto cercano y que el algoritmo conserve el fragmento donde esa relación se sostiene.

**Importancia para la revisión.** Esta diapositiva define el tamaño del universo analizado y separa desde el inicio tres niveles: artículos, menciones y relaciones. Esa separación evita confundir volumen de palabras con evidencia científica.

**Frase útil.** "El pipeline primero detecta lenguaje, después contextualiza y finalmente produce relaciones auditables; por eso no tratamos todos los conteos como evidencia equivalente."

## Diapositiva 2. Algoritmo de conteo de palabras con contexto

**Mensaje principal.** El algoritmo no se limita a contar palabras: convierte apariciones textuales en evidencia interpretable mediante secciones, ventanas de contexto, pistas lingüísticas y reglas.

**Qué muestra.** El flujo completo va de entrada de PDFs/textos a extracción, normalización, detección por léxicos, conteo crudo, análisis contextual y salidas auditables en CSV, Excel, JSON y gráficas.

**Dónde empieza el contexto.** El contexto entra después del conteo crudo, especialmente en los pasos 7 a 11: ubicar sección, extraer ventana textual, buscar pistas, comparar contaminante-enfermedad y aplicar reglas. En ese punto, el algoritmo distingue si una palabra aparece en métodos/resultados o si solo aparece en introducción/referencias.

**Importancia para la revisión.** Esta lámina justifica la trazabilidad. Cada decisión puede revisarse porque el sistema conserva artículo, sección, fragmento textual y nivel de confianza. Eso es clave para revisión sistemática, donde no basta con automatizar: hay que poder auditar.

**Frase útil.** "La parte inteligente no está en contar la palabra, sino en preguntarle al texto dónde aparece, con qué términos aparece cerca y si hay señales de exposición, medición, asociación o negación."

## Diapositiva 3. Zoom: de mención cruda a decisión contextual

**Mensaje principal.** Una mención aislada no tiene el mismo valor que una mención ubicada en un contexto experimental o epidemiológico.

**Qué muestra.** La decisión contextual se expresa como una función: clasificación = f(sección, ventana textual, pistas de exposición, pistas de asociación, cercanía entre entidades y negación).

**Cómo leerla.** Si "aluminio" aparece en métodos/resultados junto con palabras como exposición, dosis, medición, pacientes o modelo, la confianza sube. Si aparece en referencias o introducción sin evidencia directa, puede contarse como mención, pero no como exposición principal.

**Importancia para la revisión.** Esta diapositiva explica el control contra falsos positivos. Muchos artículos mencionan contaminantes en antecedentes, pero no necesariamente los analizan. El objetivo es separar "se menciona" de "se trabaja con él".

**Frase útil.** "El algoritmo no reemplaza la lectura humana; reduce el espacio de búsqueda y muestra por qué tomó una decisión preliminar."

## Diapositiva 4. Menciones totales por contaminante

**Mensaje principal.** Esta gráfica muestra volumen textual: cuántas veces aparece cada contaminante en todo el corpus.

**Qué muestra.** Las barras representan apariciones textuales totales. En el corpus, cadmio aparece 1,383 veces, aluminio 1,237 veces, BMAA 753 veces y pesticidas/plaguicidas 567 veces. Los diez primeros contaminantes acumulan aproximadamente 66.4% de todas las menciones de contaminantes.

**Cómo interpretarla.** Un contaminante con muchas menciones no necesariamente es el más importante científicamente. Puede estar muy repetido en artículos de revisión, tablas, introducciones o referencias. Por eso esta figura es una capa descriptiva, no una conclusión.

**Relación matemática.** Para cada contaminante se calcula: número de menciones = suma de todas las coincidencias léxicas detectadas en todos los artículos y secciones.

**Importancia para la revisión.** Sirve para identificar los términos dominantes del corpus y revisar si el léxico está capturando bien los contaminantes esperados. También ayuda a detectar temas con alto volumen que podrían requerir subanálisis.

**Frase útil.** "Esta figura responde 'qué contaminantes aparecen más en el texto', no 'cuáles tienen mayor evidencia causal'."

## Diapositiva 5. Menciones totales de contaminantes por sección

**Mensaje principal.** La sección del artículo cambia el significado de una mención.

**Qué muestra.** Las menciones se distribuyen así: resultados 3,165 menciones (32.2%), referencias 2,328 (23.7%), introducción 1,372 (14.0%), discusión 1,124 (11.4%), métodos 890 (9.1%), título 373 (3.8%), resumen 345 (3.5%) y conclusión 234 (2.4%).

**Cómo interpretarla.** El hecho de que resultados concentre la mayor proporción sugiere que una parte relevante de las menciones aparece donde normalmente se reportan hallazgos. Sin embargo, referencias también aporta una proporción grande; eso puede inflar menciones que no corresponden a variables analizadas en el estudio.

**Relación matemática.** Para cada sección se calcula: total de menciones en sección / total de menciones de contaminantes. Esto permite estimar la proporción de menciones por parte del artículo.

**Importancia para la revisión.** Esta gráfica justifica por qué el pipeline no trata todas las secciones igual. Métodos y resultados pesan más para inferir exposición o análisis; introducción y referencias requieren mayor cautela.

**Frase útil.** "La sección funciona como un filtro metodológico: una palabra en resultados tiene otro peso que la misma palabra en referencias."

## Diapositiva 6. Distribución por sección de los 25 contaminantes con más menciones

**Mensaje principal.** El heatmap muestra el patrón interno de cada contaminante a través de las secciones del artículo.

**Qué muestra.** Cada celda es el número de menciones de un contaminante en una sección. Por ejemplo, permite ver si cadmio, aluminio o BMAA aparecen sobre todo en resultados, referencias, introducción o métodos.

**Cómo interpretarla.** Las celdas más oscuras indican concentración de menciones. Si un contaminante tiene muchas menciones en resultados o métodos, puede ser candidato a exposición principal o variable analítica. Si se concentra en referencias, puede reflejar discusión bibliográfica o antecedentes.

**Relación matemática.** Es una matriz contaminante × sección, donde cada celda contiene un conteo absoluto de menciones.

**Importancia para la revisión.** Ayuda a priorizar auditoría manual por contaminante. No solo dice qué contaminante aparece más, sino dónde aparece. Ese "dónde" es lo que permite acercarse al contexto.

**Frase útil.** "Este mapa no solo cuenta contaminantes; muestra su huella estructural dentro de los artículos."

## Diapositiva 7. Frecuencias de contaminantes relevantes para el estudio

**Mensaje principal.** Esta gráfica ya no cuenta todas las menciones; cuenta artículos donde el contaminante fue clasificado como relevante para el estudio.

**Qué muestra.** El eje representa número de artículos, no número de menciones. Aluminio aparece como relevante en 20 artículos, pesticidas/plaguicidas en 18, manganeso y plomo en 14 cada uno, y solventes en 13.

**Cómo interpretarla.** Esta figura está más cerca de la lógica de revisión sistemática que la gráfica de menciones totales, porque resume presencia a nivel artículo. Un contaminante puede tener menos menciones totales pero aparecer en más artículos, o viceversa.

**Relación matemática.** Para cada contaminante se cuenta un artículo cuando el algoritmo lo clasifica como exposición principal o variable secundaria/contexto analítico. Por eso no equivale a "número de veces que aparece la palabra".

**Importancia para la revisión.** Sirve para identificar contaminantes que aparecen repetidamente como variables potencialmente relevantes, no solo como términos frecuentes.

**Frase útil.** "Aquí la unidad de análisis cambia: ya no son palabras, son artículos."

## Diapositiva 8. Enfermedades, niveles de asociación y tipos de estudio

**Mensaje principal.** Esta diapositiva resume tres dimensiones necesarias para interpretar el corpus: desenlaces, fuerza de asociación y diseño de estudio.

**Qué muestra.** Las enfermedades más frecuentes son neurodegeneración general (58), Alzheimer (55), Parkinson (48), demencia (28), deterioro cognitivo (18), esclerosis lateral amiotrófica (17), esclerosis múltiple (11) y Huntington (7). También muestra niveles de asociación: 350 relaciones con evidencia insuficiente, 331 débiles, 149 fuertes y 106 especulativas. En tipo de estudio predominan in vitro (31), epidemiológicos humanos (21), revisiones/síntesis (14), no determinados (9) e in vivo (4).

**Cómo interpretarla.** La frecuencia de enfermedades indica qué desenlaces domina el corpus. La distribución de asociaciones muestra que una parte importante de los pares requiere cautela. El tipo de estudio ayuda a interpretar la naturaleza de la evidencia: no es lo mismo una asociación epidemiológica que un ensayo in vitro.

**Relación matemática.** Son conteos categóricos: número de artículos o relaciones por clase.

**Importancia para la revisión.** Esta diapositiva ayuda a organizar la extracción: qué enfermedades priorizar, qué asociaciones auditar primero y qué diseños pesan más en la evidencia disponible.

**Frase útil.** "La figura muestra el mapa general de la evidencia: qué desenlaces aparecen, con qué nivel de soporte textual y bajo qué tipo de estudio."

## Diapositiva 9. Matriz contaminante-enfermedad

**Mensaje principal.** La matriz convierte relaciones dispersas en un mapa de pares contaminante-enfermedad.

**Qué muestra.** Cada celda indica cuántas relaciones contaminante-enfermedad fueron detectadas con soporte textual. Por categoría, los metales pesados concentran muchas relaciones con Alzheimer (88), neurodegeneración general (87), Parkinson (67), demencia (46), ELA (31) y deterioro cognitivo (27).

**Cómo interpretarla.** Una celda alta significa que ese cruce aparece repetidamente en artículos y contextos. No significa causalidad ni prueba definitiva. Es una señal de densidad documental.

**Relación matemática.** celda(i,j) = conteo de relaciones donde i es categoría de contaminante y j es enfermedad, excluyendo pares sin evidencia textual suficiente.

**Importancia para la revisión.** Funciona como mapa basal para ubicar qué pares deben revisarse primero. También permite detectar vacíos: celdas claras pueden indicar poca evidencia o baja presencia en el corpus.

**Frase útil.** "El heatmap transforma una tabla larga de relaciones en una lectura rápida de densidad de evidencia."

## Diapositiva 10. Agregación por categoría y evidencia ponderada

**Mensaje principal.** Al ponderar fuerza y confianza, se observa que el peso de evidencia se concentra sobre todo en metales pesados, pesticidas y contaminantes orgánicos persistentes.

**Qué muestra.** Cada celda suma un peso de evidencia. Los metales pesados tienen pesos altos con Alzheimer (435), neurodegeneración general (426), Parkinson (318), demencia (233), ELA (146) y deterioro cognitivo (125). Pesticidas destacan con Parkinson (143) y neurodegeneración general (108).

**Cómo interpretarla.** A diferencia de la matriz de conteo, esta matriz no solo cuenta relaciones: las pondera según asociación y confianza. Por eso una celda puede subir si acumula relaciones fuertes o de alta confianza.

**Relación matemática.** peso = fuerza × confianza. En el pipeline: asociación fuerte = 3, débil = 2, especulativa = 1; confianza alta = 3, media = 2, baja = 1. La celda es la suma de esos pesos para cada cruce categoría-enfermedad.

**Importancia para la revisión.** Ayuda a priorizar familias de contaminantes, no solo contaminantes individuales. Es útil cuando hay muchos sinónimos o nombres específicos y se necesita una vista más estable.

**Frase útil.** "Esta figura responde qué familias acumulan más evidencia ponderada, no solo más menciones."

## Diapositiva 11. Matriz de burbujas

**Mensaje principal.** La burbuja separa dos cosas que suelen confundirse: volumen de evidencia y fuerza promedio.

**Qué muestra.** El tamaño de la burbuja representa el peso acumulado de un par contaminante-enfermedad. El color representa la fuerza promedio. Una burbuja grande puede deberse a muchas asociaciones moderadas; una burbuja más pequeña pero más intensa puede indicar menos relaciones pero más fuertes.

**Cómo interpretarla.** Los pares grandes y oscuros son candidatos prioritarios para auditoría manual. Los pares grandes pero de color más tenue deben revisarse con cautela, porque podrían reflejar mucha evidencia débil o dispersa.

**Relación matemática.** Área de burbuja proporcional a suma(peso). Color proporcional a fuerza promedio del par.

**Importancia para la revisión.** Es útil para construir una agenda de lectura. Permite seleccionar pares que combinan recurrencia y fortaleza, y evita priorizar únicamente por conteo.

**Frase útil.** "La burbuja permite distinguir acumulación documental de intensidad de evidencia."

## Diapositiva 12. Red bipartita de asociaciones

**Mensaje principal.** La red muestra conectividad: qué contaminantes se enlazan con múltiples desenlaces y qué enfermedades reciben evidencia desde varias categorías.

**Qué muestra.** Los nodos de la izquierda son contaminantes; los de la derecha son enfermedades. Un enlace existe solo cuando hay evidencia textual cercana. El grosor del enlace es proporcional al peso de la relación.

**Cómo interpretarla.** Un contaminante con muchos enlaces tiene alto grado y puede ser transversal en el corpus. Un enlace grueso indica un par repetido y con mayor peso. Sin embargo, una red densa también puede deberse a términos generales o a artículos de revisión, por eso debe cruzarse con sección y tipo de estudio.

**Relación matemática.** grado(nodo) = número de enlaces. Grosor(enlace) proporcional a peso acumulado del par.

**Importancia para la revisión.** Ayuda a visualizar estructura global: qué contaminantes funcionan como hubs y qué enfermedades concentran más conexiones. Es una herramienta de navegación, no una prueba causal.

**Frase útil.** "La red no dice qué causa qué; muestra dónde se concentran las conexiones textuales que conviene auditar."

## Diapositiva 13. Pares prioritarios

**Mensaje principal.** Esta gráfica ordena los pares contaminante-enfermedad que conviene auditar primero.

**Qué muestra.** Los pares con mayor score son aluminio-Alzheimer (108; 17 relaciones), aluminio-demencia (88; 16), manganeso-neurodegeneración general (59; 8), cobre-neurodegeneración general (53; 11), pesticidas/plaguicidas-neurodegeneración general (51; 15), paraquat-Parkinson (51; 9) y pesticidas/plaguicidas-Parkinson (51; 12).

**Cómo interpretarla.** El score combina fuerza y confianza, pero debe leerse junto con el número de relaciones. Un par puede estar arriba por muchas relaciones moderadas o por pocas relaciones fuertes.

**Relación matemática.** score(par) = suma(fuerza × confianza). n_relations = número de relaciones detectadas. avg_strength = score / n_relations.

**Importancia para la revisión.** Esta diapositiva puede convertirse directamente en una agenda de extracción: tomar los pares top, abrir sus artículos, revisar fragmentos y confirmar manualmente si la asociación está bien clasificada.

**Frase útil.** "Estos son los pares que el algoritmo recomienda revisar primero, no los pares que ya podemos declarar concluyentes."

## Diapositiva 14. Contexto por sección

**Mensaje principal.** La sección del artículo es el filtro clave contra falsos positivos.

**Qué muestra.** El heatmap cruza nivel de asociación con sección. En el peso ponderado, las asociaciones fuertes se concentran principalmente en resultados (711), resumen/abstract (297), título (198) y métodos (135). Las asociaciones débiles aparecen mucho en referencias (512), introducción (360) y discusión (196).

**Cómo interpretarla.** Si una relación aparece sobre todo en métodos/resultados, es más probable que corresponda a una variable trabajada o un hallazgo reportado. Si aparece sobre todo en referencias/introducción, puede ser contexto bibliográfico.

**Relación matemática.** Cada celda suma el peso de relaciones por nivel de asociación y sección del artículo.

**Importancia para la revisión.** Permite justificar por qué el pipeline diferencia exposición principal, variable secundaria y simple mención. También permite decidir dónde hacer auditoría manual más estricta.

**Frase útil.** "Una asociación gana credibilidad contextual cuando vive en métodos o resultados; pierde peso cuando solo vive en antecedentes o referencias."

## Diapositiva 15. K-Means

**Mensaje principal.** K-Means sirve para explorar perfiles de artículos, no para demostrar relaciones causales.

**Qué muestra.** Cada artículo se representa como un vector de rasgos: contaminantes, enfermedades, secciones, roles, tipo de estudio y asociaciones. Luego se aplica log(1+X), se estandarizan las columnas y K-Means agrupa artículos con perfiles similares. En la versión actual ya no se usa PCA.

**Cómo interpretarla.** Los artículos dentro del mismo cluster comparten patrones parecidos de rasgos. La distancia al centroide indica qué tan típico o atípico es un artículo dentro de su grupo. Los puntos lejanos pueden ser revisiones amplias, artículos con muchos desenlaces o trabajos con un patrón temático poco común.

**Relación matemática.** X = matriz artículo × rasgo. X' = log(1+X) para reducir la dominancia de valores extremos. Después se estandarizan las columnas y K-Means agrupa artículos minimizando la distancia dentro de cada cluster respecto a su centroide.

**Resultado clave.** La figura debe leerse como exploratoria. K-Means ordena perfiles de artículos, pero no valida asociaciones biomédicas.

**Importancia para la revisión.** Sirve para detectar artículos que conviene revisar juntos, posibles duplicados conceptuales o subgrupos temáticos. No sustituye la lectura de evidencia textual.

**Frase útil.** "K-Means nos ayuda a ordenar el corpus por perfiles, no a validar asociaciones biomédicas."

## Diapositiva 16. Recomendación metodológica

**Mensaje principal.** La estrategia más sólida es usar reglas auditables ahora y aprendizaje supervisado después, cuando exista una base etiquetada manualmente.

**Qué muestra.** Resume cinco capas: léxicos, contexto, reglas, matrices y ML. La lógica es progresiva: primero detectar entidades, después contextualizar, luego clasificar con reglas, después visualizar y finalmente entrenar modelos supervisados si hay etiquetas humanas.

**Cómo interpretarla.** K-Means es útil como herramienta exploratoria, pero la clasificación final de exposición principal, variable secundaria o asociación fuerte/débil requiere evidencia textual y validación humana.

**Importancia para la revisión.** Esta diapositiva defiende una postura metodológica conservadora: evitar sobreinterpretación, conservar trazabilidad y usar machine learning como apoyo, no como sustituto del criterio sistemático.

**Frase útil.** "El siguiente paso natural no es reemplazar las reglas por una caja negra, sino entrenar un modelo supervisado con las decisiones que el equipo revisor valide manualmente."

## Cierre sugerido

Para cerrar la exposición, puedes decir:

> En conjunto, el pipeline permite pasar de 79 artículos y miles de menciones a una agenda ordenada de revisión. Las gráficas no pretenden demostrar causalidad; sirven para localizar patrones, priorizar pares contaminante-enfermedad, controlar falsos positivos por sección y conservar evidencia textual auditable para cada decisión.
