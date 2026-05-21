# Arquitectura web de NEXO

## Resumen

NEXO ("Mineria de datos para revisiones.") es una capa web local-first sobre el pipeline `review_miner`. La app no reemplaza la logica cientifica existente; la organiza y la hace operable desde una interfaz visual.

## Flujo de usuario

1. El usuario abre la landing y entiende el alcance de la herramienta.
2. Entra al analizador.
3. Valida una carpeta local con articulos.
4. Carga o construye dos bases JSON de terminos.
5. Define contexto, distancia de relacion, KWIC y visual analytics.
6. Guarda el protocolo maestro para reutilizarlo.
7. Ejecuta el pipeline publicable.
8. Sigue el estado de ejecucion.
9. Revisa resultados en tablas y figuras.
10. Descarga imagenes, reporte Word o paquete ZIP completo.

## Componentes

- Frontend: Next.js App Router.
- Backend local: rutas API de Next.js.
- Procesamiento: scripts Python existentes.
- Reporte: `scripts/generate_review_report.py`.
- Empaquetado: comando local `zip`.

## APIs locales

- `GET /api/project`: configuracion del proyecto.
- `POST /api/local/dialog`: dialogo nativo local para elegir carpetas o archivos.
- `POST /api/lexicon/load`: carga bases JSON de terminos.
- `POST /api/lexicon/save`: guarda bases JSON compatibles con `review_miner`.
- `POST /api/protocols/load`: carga un protocolo reutilizable.
- `POST /api/protocols/save`: guarda un protocolo reutilizable.
- `POST /api/pipeline/scan`: escaneo de carpeta local.
- `POST /api/pipeline/run`: inicia una ejecucion.
- `GET /api/pipeline/status`: consulta estado y logs.
- `GET /api/results`: lista tablas, figuras, reportes y paquetes.
- `GET /api/files/view`: sirve imagenes generadas dentro del proyecto.
- `GET /api/files/download`: descarga archivos generados.
- `GET /api/files/table`: previsualiza CSV.

## Limitacion de navegador y Vercel

Los navegadores no entregan acceso irrestricto a rutas locales. El atributo `webkitdirectory` permite listar archivos seleccionados por el usuario, pero no habilita al servidor remoto a leer una carpeta local. Por esa razon, el procesamiento real se ejecuta en un backend local.

En Vercel, las rutas API no deben intentar leer `Articulos/` de la computadora del usuario. La app informa esa limitacion y bloquea el procesamiento local cuando detecta `process.env.VERCEL`.

## Privacidad

Los PDFs cientificos pueden estar sujetos a copyright o confidencialidad. La arquitectura evita subir documentos a servicios externos. El repositorio ignora corpus, salidas y documentos pesados por defecto.

## Extension futura

Una version hibrida podria separar:

- UI hospedada en Vercel.
- Agente local instalado en la maquina del investigador.
- Canal autenticado entre UI y agente.
- Cola local de ejecuciones.
- Historial local de proyectos y revisiones.
