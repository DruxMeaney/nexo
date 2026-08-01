# Fixtures de la suite de regresión

Todo lo que la suite necesita vive aquí. Ningún test lee el protocolo de
ejemplo de `config/protocols/` ni el corpus del autor (que está en
`.gitignore` y no existe en un clon limpio).

## `protocol/`

Protocolo mínimo con la misma estructura de carpetas que escribe el
asistente de la aplicación (`protocol.json`, `variables/`, `cues/`,
`sections.json`).

- Variable A (`Contaminantes`): `lead`, `arsenic`, `cadmium` y un término
  marcado como genérico (`generic_pollutant`) para ejercitar la penalización
  de −1.
- Variable B (`Enfermedades neurodegenerativas`): `alzheimers_disease`,
  `parkinsons_disease`.
- Las diez familias de señales llevan patrones cortos y controlados: los
  tests necesitan saber exactamente qué señal dispara cada oración.
- `sections.json` reproduce la tabla de pesos documentada y los patrones
  IMRaD por omisión. El test que comprueba que el peso se lee del protocolo
  copia esta carpeta a un directorio temporal y sobrescribe los pesos, de
  modo que el protocolo de prueba puede seguir siendo realista.

## `corpus/`

Seis artículos sintéticos en `.txt` (el pipeline acepta `.txt`, así que no
hace falta ningún PDF ni se versiona material con derechos de autor). Entre
los seis cubren los casos que el algoritmo debe resolver:

| Archivo | Qué ejercita |
| --- | --- |
| `A1_imrad_completo_es.txt` | IMRaD completo en español: título, resumen, introducción, métodos, resultados, discusión, conclusiones y referencias. Par A–B en la misma oración con señal de asociación fuerte. |
| `A2_encabezado_corrido_en.txt` | Encabezados corridos (`Abstract: We examined…`, `Discussion. This study reveals…`) que deben abrir sección pese a estar en una línea larga. |
| `A3_falsos_encabezados_en.txt` | Dos líneas de cuerpo envueltas que empiezan por `results` y por `method`, y el nombre de una revista citada (`Methods Psychiatr Res 1993;3:1-28.`) dentro de la bibliografía. Ninguno debe abrir sección. |
| `A4_referencias_en_tabla_es.txt` | Una columna de tabla titulada `Referencias` a mitad del documento y la bibliografía real más adelante: solo la última es terminal. |
| `A5_entidades_lejanas_en.txt` | Entidad A y entidad B en oraciones distintas separadas por más de `relation_distance`: no debe emitirse ninguna relación. |
| `A6_misma_seccion_en.txt` | Par A–B en oraciones distintas de la misma sección, a ~400 caracteres: más lejos que `context_radius`, así que la evidencia solo puede ser el tramo conjunto. |

Los identificadores de artículo son los nombres de archivo sin extensión y
están declarados en `tests/conftest.py` (`CORPUS_IDS`): renombrar o borrar
un archivo falla de forma explícita en lugar de encoger el corpus en
silencio.
