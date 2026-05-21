# NEXO

**Mineria de datos para revisiones.**

Interfaz web local-first para revision sistematica de literatura cientifica. NEXO envuelve un pipeline Python generico (`review_miner`) que toma cualquier par de variables (contaminantes/enfermedades, farmacos/efectos adversos, especies/ecosistemas, etc.) definido como un protocolo y produce menciones auditables, relaciones con evidencia textual, figuras, tablas y un reporte Word.

## Que hace

- Lee una carpeta local con PDFs, TXT o MD.
- Ejecuta `pipeline_publicable/run_pipeline_publicable.py`.
- Permite construir o cargar un protocolo reutilizable.
- Permite cargar o editar las dos bases JSON de terminos a relacionar.
- Genera tablas CSV, Excel y JSON.
- Expone figuras SVG y visual analytics.
- Genera un reporte Word con resumen ejecutivo, metodo y referencias a figuras.
- Crea un paquete ZIP con el analisis completo.

## Arquitectura

```text
RevisionContaminantes/
  src/app/                 Web app Next.js
  src/app/api/             APIs locales para escaneo, ejecucion y archivos
  src/components/          Landing, analizador y visualizador
  src/lib/server/          Adaptadores entre Next.js y el pipeline Python
  scripts/                 Utilidades de reporte
  review_miner/            Pipeline auditable existente
  pipeline_publicable/     Pipeline extendido para revision sistematica
  config/                  Lexicos de contaminantes y enfermedades
  config/protocols/        Protocolos reutilizables creados desde la app
```

## Requisitos

- Node.js 20 o superior.
- Python 3.10 o superior.
- Dependencias Python del pipeline.
- `zip` disponible en la maquina local para crear el paquete descargable.

Instala dependencias JavaScript:

```bash
npm install
```

Instala dependencias Python:

```bash
python3 -m pip install -r requirements_review_miner.txt
```

## Ejecucion local

```bash
npm run dev
```

Abre:

```text
http://localhost:3000
```

La ruta `/analizador` permite validar una carpeta local y ejecutar el pipeline. Si no defines una salida, la app crea una carpeta nueva bajo:

```text
outputs/webapp_runs/
```

## Constructor de protocolo

El analizador incluye una seccion para construir el corpus conceptual de la revision:

- Variable A: por defecto contaminantes.
- Variable B: por defecto enfermedades.
- Cada variable puede tener tipo, subtipo y subsubtipo.
- Cada termino se guarda con `id`, etiquetas ES/EN, categoria jerarquica, bandera `generic` y patrones regex.
- Las bases se pueden cargar desde `config/review_miner_contaminants.json` y `config/review_miner_diseases.json`.
- Tambien se pueden guardar nuevas bases JSON compatibles con el pipeline.

Los protocolos guardan:

- rutas de corpus y salida;
- rutas y contenido de las dos bases de terminos;
- caracteres de contexto por mencion;
- radio KWIC;
- distancia maxima para relacion;
- parametros de K-Means y validacion manual.

El boton con icono de carpeta usa un dialogo nativo del sistema operativo mediante el backend local. Esto solo funciona al ejecutar la app localmente.

## Variables de entorno

Opcionales:

```bash
PYTHON_BIN=/ruta/a/python3
```

Si no se define, la app usa `python3`.

## Vercel

La interfaz puede prepararse para Vercel, pero hay una limitacion importante: una app desplegada en Vercel no puede leer carpetas locales del usuario ni procesar PDFs privados de su computadora.

Modo recomendado:

1. Usar Vercel para hospedar la landing/interfaz informativa.
2. Ejecutar el procesamiento real de PDFs en modo local con `npm run dev`.
3. Evitar subir PDFs, salidas sensibles o documentos con copyright a repositorios publicos.

Arquitectura alternativa futura:

- Frontend en Vercel.
- Agente local o backend local instalado por el usuario.
- Comunicacion autenticada entre frontend y agente local.
- Procesamiento siempre en la maquina donde residen los PDFs.

## Salidas principales

El pipeline genera, entre otros:

- `articles.csv`
- `mentions.csv`
- `entity_summaries.csv`
- `relations.csv`
- `systematic_review_table.csv`
- `review_miner_results.xlsx`
- `publication_pipeline/*.csv`
- `figures/*.svg`
- `visual_analytics/advanced_figures/*.svg`
- `reporte_revision_nexo.docx`
- `_package/nexo_analysis.zip`

## Guardrails cientificos

- Una mencion no equivale a asociacion.
- Una co-ocurrencia no equivale a causalidad.
- Toda relacion reportada debe revisarse contra su evidencia textual.
- Los resultados apoyan la revision sistematica, pero no sustituyen cribado, elegibilidad, evaluacion de calidad ni lectura critica.

## Preparacion para GitHub

El `.gitignore` evita subir por accidente:

- PDFs y corpus en `Articulos/`.
- Salidas en `outputs/`.
- Documentos Word, Excel y PowerPoint.
- Archivos de entorno y dependencias locales.

Antes de publicar un repositorio, revisa manualmente que no haya PDFs, credenciales ni resultados confidenciales.
