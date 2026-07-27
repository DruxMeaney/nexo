/**
 * NEXO — Encuesta de calibración del modelo de NLP
 * =================================================
 *
 * Genera un Google Forms para que el equipo revise:
 *   PARTE 1 — Pesos del modelo (¿mantener / subir / bajar cada valor?)
 *   PARTE 2 — Términos buscados (contaminantes y enfermedades): ¿bien clasificados?
 *
 * Cómo usarlo:
 *   1. Abre https://script.google.com  ->  "Nuevo proyecto".
 *   2. Borra el código de ejemplo y pega TODO este archivo.
 *   3. Pulsa "Ejecutar" (solo hay una función: crearEncuestaNEXO, ya queda seleccionada).
 *   4. Autoriza el acceso a Google Forms (lo pedirá la primera vez).
 *   5. Abre "Registro de ejecución" (Ctrl+Enter) para ver los enlaces de edición
 *      y de respuesta del formulario que se acaba de crear.
 *
 * Todos los pesos provienen del código del pipeline NEXO (defaults.ts, classify.py,
 * relations.py, publication_extensions.py, visual_analytics.py). Si los pesos
 * cambian en el futuro, actualiza los valores entre paréntesis aquí y vuelve a ejecutar.
 *
 * El formulario es ANÓNIMO: no recolecta correo ni nombre.
 */
function crearEncuestaNEXO() {

  // --------------------------------------------------------------------- //
  // Escalas reutilizables (columnas de las rejillas)                      //
  // --------------------------------------------------------------------- //
  var ESCALA_PESO = ['Mantener igual', 'Subir', 'Bajar', 'No sé'];
  var ESCALA_TERMINO = ['Bien clasificado', 'Debería ir en otro grupo', 'No debería estar / sobra', 'No sé'];

  // --------------------------------------------------------------------- //
  // Crear el formulario                                                   //
  // --------------------------------------------------------------------- //
  var form = FormApp.create('NEXO — Revisión de pesos y términos del modelo de NLP');

  form.setDescription(
    'Estás ayudando a calibrar el modelo de NLP de NEXO, que analiza artículos para relacionar ' +
    'contaminantes ambientales (Variable A) con enfermedades neurodegenerativas (Variable B).\n\n' +
    'El modelo asigna "pesos" (números) a distintas señales del texto y clasifica en grupos los ' +
    'términos que busca. La encuesta tiene dos partes:\n\n' +
    '  • PARTE 1 — Pesos: para cada peso verás su valor actual; dinos si lo mantendrías, subirías o bajarías.\n' +
    '  • PARTE 2 — Términos: revisa si los contaminantes y las enfermedades están bien clasificados en su grupo.\n\n' +
    'Es ANÓNIMA y toma ~10-15 min. No tienes que responder todo: enfócate en lo que conoces. ¡Gracias!'
  );

  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage('¡Gracias! Tus respuestas ayudarán a afinar el modelo NEXO.');

  // --------------------------------------------------------------------- //
  // Helpers internos (usan el "form" de arriba por cierre/closure)        //
  // --------------------------------------------------------------------- //
  function _seccion(titulo, ayuda) {
    var pb = form.addPageBreakItem().setTitle(titulo);
    if (ayuda) pb.setHelpText(ayuda);
    return pb;
  }
  function _rejilla(titulo, ayuda, filas, columnas) {
    var item = form.addGridItem().setTitle(titulo);
    if (ayuda) item.setHelpText(ayuda);
    item.setRows(filas).setColumns(columnas).setRequired(false);
    return item;
  }
  function _comentario(titulo, ayuda) {
    var item = form.addParagraphTextItem().setTitle(titulo);
    if (ayuda) item.setHelpText(ayuda);
    item.setRequired(false);
    return item;
  }

  // Pregunta de perfil (opcional, no identifica a la persona) ----------- //
  form.addMultipleChoiceItem()
    .setTitle('Perfil (opcional)')
    .setHelpText('Solo sirve para interpretar resultados. La encuesta sigue siendo anónima.')
    .setChoiceValues([
      'Toxicología / ciencias ambientales',
      'Neurociencia / clínica',
      'Bioinformática / NLP / datos',
      'Revisión sistemática / metodología',
      'Otro'
    ])
    .showOtherOption(true)
    .setRequired(false);

  // ===================================================================== //
  // PARTE 1 — PESOS                                                       //
  // ===================================================================== //

  // --- 1. Pesos por sección del artículo ------------------------------- //
  _seccion('PARTE 1 · Pesos — 1. Por sección del artículo',
    'Cada vez que se menciona un término, el modelo le suma el peso de la sección donde aparece ' +
    '(un hallazgo en Resultados debe pesar más que uno en Referencias). Perfil de pesos activo: "baseline_current". ' +
    '¿Mantendrías cada valor, lo subirías o lo bajarías?');
  _rejilla('Pesos por sección (valor actual entre paréntesis)', null, [
    'Título (peso actual: +5)',
    'Resumen / abstract (peso actual: +4)',
    'Introducción (peso actual: +1)',
    'Métodos (peso actual: +6)',
    'Resultados (peso actual: +5)',
    'Discusión (peso actual: +2)',
    'Conclusión (peso actual: +2)',
    'Referencias (peso actual: -3)',
    'Otra sección no identificada (peso actual: +1)'
  ], ESCALA_PESO);
  _comentario('Comentarios — pesos por sección',
    'Si marcaste "Subir" o "Bajar", indícanos qué valor propondrías y por qué.');

  // --- 2. Pesos de contexto (cues) a nivel de mención ------------------ //
  _seccion('PARTE 1 · Pesos — 2. Contexto de la palabra (cues)',
    'Alrededor de cada mención el modelo busca palabras clave ("cues") y ajusta el puntaje: ' +
    'dosis y exposición suman; especulación, negación y los términos genéricos restan.');
  _rejilla('Pesos de cue (señales en el contexto de la mención)', null, [
    'Dosis / unidades — mg/L, ppm, µg/L (peso actual: +5)',
    'Exposición / tratamiento / medición (peso actual: +4)',
    'Asociación — riesgo, OR, HR (peso actual: +2)',
    'Lenguaje especulativo — podría, posible (peso actual: -1)',
    'Negación — "no association" (peso actual: -2)',
    'Término genérico — no es un compuesto nombrado (peso actual: -1)'
  ], ESCALA_PESO);
  _comentario('Comentarios — pesos de contexto (cues)',
    'Si marcaste "Subir" o "Bajar", indícanos qué valor propondrías y por qué.');

  // --- 3. Bonos en la capa de relaciones A<->B ------------------------- //
  _seccion('PARTE 1 · Pesos — 3. Relaciones entre contaminante y enfermedad',
    'Cuando un contaminante (A) y una enfermedad (B) aparecen cerca en el texto, el modelo crea una ' +
    '"relación" y le suma bonos o penalizaciones según el lenguaje que comparten.');
  _rejilla('Bonos y penalizaciones en la relación A<->B', null, [
    'Hay cue de asociación en la evidencia (bono actual: +4)',
    'Hay cue de asociación FUERTE (bono actual: +4, adicional al anterior)',
    'El vínculo está en lenguaje especulativo (penalización actual: -2)',
    'La evidencia niega la relación (penalización actual: -4)'
  ], ESCALA_PESO);
  _comentario('Comentarios — pesos de relaciones',
    'Si marcaste "Subir" o "Bajar", indícanos qué valor propondrías y por qué.');

  // --- 4. Peso de evidencia (fuerza x confianza) ----------------------- //
  _seccion('PARTE 1 · Pesos — 4. Peso de evidencia (fuerza × confianza)',
    'Para agregar resultados y dibujar las figuras, cada relación se resume en un "peso de evidencia" ' +
    '= fuerza de la asociación × nivel de confianza. Aquí calificas ambos factores por separado.');
  _rejilla('4a. Peso por fuerza de la asociación', null, [
    'Asociación fuerte (peso actual: +3)',
    'Asociación débil (peso actual: +2)',
    'Mención especulativa (peso actual: +1)',
    'Sin evidencia suficiente (peso actual: 0)'
  ], ESCALA_PESO);
  _rejilla('4b. Peso por nivel de confianza', null, [
    'Confianza Alta (peso actual: +3)',
    'Confianza Media (peso actual: +2)',
    'Confianza Baja (peso actual: +1)'
  ], ESCALA_PESO);
  _comentario('Comentarios — peso de evidencia',
    'Si marcaste "Subir" o "Bajar", indícanos qué valor propondrías y por qué.');

  // --- 5. Peso por rol de la entidad ----------------------------------- //
  _seccion('PARTE 1 · Pesos — 5. Rol del término en el artículo',
    'A cada término se le asigna un rol según qué tan central es en el artículo (foco principal, ' +
    'mención secundaria, solo en la introducción, etc.). Ese rol funciona como multiplicador al agregar resultados.');
  _rejilla('Peso (multiplicador) por rol de la entidad', null, [
    'Foco principal del estudio (peso actual: +3)',
    'Foco probable (peso actual: +2.5)',
    'Variable secundaria (peso actual: +2)',
    'Solo en introducción / discusión (peso actual: +0.5)',
    'No determinado (peso actual: +0.5)',
    'Mención dentro de una revisión (peso actual: +0.3)',
    'Solo en la bibliografía (peso actual: +0.2)'
  ], ESCALA_PESO);
  _comentario('Comentarios — pesos de rol',
    'Si marcaste "Subir" o "Bajar", indícanos qué valor propondrías y por qué.');

  // ===================================================================== //
  // PARTE 2 — TÉRMINOS Y CLASIFICACIÓN                                    //
  // ===================================================================== //

  // --- 6. Contaminantes (Variable A) ----------------------------------- //
  _seccion('PARTE 2 · Términos — 6. Contaminantes (Variable A)',
    'Estos son los contaminantes que el algoritmo busca, agrupados por categoría. Para cada uno, ' +
    'dinos si está bien clasificado en su grupo. "Genérico" = término amplio que abarca varios compuestos.');

  _rejilla('6.1 Grupo: Metales pesados', null, [
    'Plomo (lead)', 'Cadmio (cadmium)', 'Aluminio (aluminum)', 'Arsénico (arsenic)',
    'Mercurio (mercury)', 'Manganeso (manganese)', 'Cobre (copper)', 'Cromo (chromium)',
    'Níquel (nickel)', 'Zinc', 'Selenio (selenium)', 'Uranio (uranium)',
    'Metales pesados (genérico)'
  ], ESCALA_TERMINO);

  _rejilla('6.2 Grupo: Pesticidas', null, [
    'Paraquat', 'Atrazina (atrazine)', 'Glifosato (glyphosate)', 'Mancozeb',
    'Diclorvos (dichlorvos)', 'Diazinón (diazinon)', 'Clorpirifós (chlorpyrifos)',
    'Triadimefon', 'Pesticidas / plaguicidas (genérico)'
  ], ESCALA_TERMINO);

  _rejilla('6.3 Grupo: Contaminantes orgánicos persistentes', null, [
    'HAP / PAH — hidrocarburos aromáticos policíclicos (genérico)',
    'Benzo[a]pireno (benzo[a]pyrene)',
    'PCB — bifenilos policlorados',
    'Dioxinas (dioxins)',
    'COP — contaminantes orgánicos persistentes (genérico)'
  ], ESCALA_TERMINO);

  _rejilla('6.4 Otros grupos (se indica el grupo de cada término)', null, [
    'Microplásticos — grupo: Microplásticos',
    'Nanoplásticos — grupo: Microplásticos',
    'Material particulado, PM2.5/PM10 — grupo: Material particulado',
    'Contaminación atmosférica, NO2, ozono — grupo: Contaminantes atmosféricos',
    'Solventes — tolueno, benceno — grupo: Solventes',
    'PFAS — grupo: Otros contaminantes relevantes',
    'BMAA — grupo: Otros contaminantes relevantes',
    'Microcistina (microcystin) — grupo: Otros contaminantes relevantes',
    'Cianotoxinas (genérico) — grupo: Otros contaminantes relevantes',
    'Piridinio de furosemida — grupo: Otros contaminantes relevantes',
    'Bisfenol A / BPA — grupo: Otros contaminantes relevantes',
    'Mezcla ambiental (genérico) — grupo: Otros contaminantes relevantes'
  ], ESCALA_TERMINO);

  _comentario('Reclasificación de contaminantes',
    'Si marcaste "Debería ir en otro grupo" en alguno, dinos cuál y a qué grupo debería ir.');
  _comentario('¿Faltan contaminantes o sobran grupos?',
    'Indícanos contaminantes relevantes que falten, términos mal escritos o repetidos, y si algún ' +
    'grupo debería renombrarse, dividirse en subgrupos o fusionarse (p. ej., separar metales esenciales de no esenciales).');

  // --- 7. Enfermedades neurodegenerativas (Variable B) ----------------- //
  _seccion('PARTE 2 · Términos — 7. Enfermedades neurodegenerativas (Variable B)',
    'Estas son las enfermedades / desenlaces que el algoritmo busca, con el grupo al que pertenecen. ' +
    'Dinos si cada una está bien clasificada.');
  _rejilla('7.1 Enfermedades y desenlaces (se indica el grupo de cada término)', null, [
    'Alzheimer — grupo: Alzheimer',
    'Parkinson — grupo: Parkinson',
    'Esclerosis lateral amiotrófica (ELA / ALS) — grupo: Esclerosis lateral amiotrófica',
    'Huntington — grupo: Huntington',
    'Demencia, incluye vascular y mixta — grupo: Demencia',
    'Deterioro cognitivo, incluye DCL / MCI — grupo: Deterioro cognitivo',
    'Esclerosis múltiple — grupo: Otras enfermedades detectadas',
    'Neurodegeneración general / neurotoxicidad — grupo: Enfermedades neurodegenerativas generales'
  ], ESCALA_TERMINO);
  _comentario('Comentarios — enfermedades',
    'Si marcaste "Debería ir en otro grupo", dinos cuál y a dónde. ¿Falta alguna enfermedad o desenlace? ' +
    '¿Alguna está mal agrupada (p. ej., unir o separar "demencia" y "deterioro cognitivo")? ' +
    '¿La esclerosis múltiple debería tener su propio grupo?');

  // --- 8. Cobertura de léxico y cierre --------------------------------- //
  _seccion('Cierre — Cobertura de términos y comentarios finales',
    'Últimas preguntas abiertas, opcionales.');
  _comentario('Sinónimos, siglas y variantes de escritura',
    '¿Hay sinónimos, siglas o variantes (en español o inglés) de algún contaminante o enfermedad que ' +
    'el algoritmo debería reconocer y quizá no detecta? Indícanos el término y sus variantes.');
  _comentario('¿Algo más que debamos revisar del modelo?',
    'Cualquier otro parámetro, comportamiento o sesgo del modelo que creas que vale la pena revisar.');

  // --------------------------------------------------------------------- //
  // Enlaces de salida                                                     //
  // --------------------------------------------------------------------- //
  Logger.log('Formulario creado.');
  Logger.log('Editar:    ' + form.getEditUrl());
  Logger.log('Responder: ' + form.getPublishedUrl());
}
