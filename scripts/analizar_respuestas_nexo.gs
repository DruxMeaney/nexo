/**
 * NEXO — Análisis de respuestas de la encuesta de calibración
 * ===========================================================
 * Lee las respuestas del formulario creado con cualquiera de los scripts crear_encuesta_nexo*.gs
 * y genera una HOJA DE CÁLCULO nueva con el resumen, en 4 pestañas:
 *   • Pesos       -> por cada peso: cuántos votaron Mantener / Subir / Bajar / No sé,
 *                    y el resumen de los números propuestos (promedio, mediana, mín, máx y la lista).
 *   • Términos    -> por cada término: cómo quedó su clasificación (bien / otro grupo / sobra / no sé).
 *   • Comentarios -> todas las opiniones escritas, agrupadas por la pregunta a la que responden.
 *   • Perfil      -> en qué perfil se ubicaron quienes respondieron.
 *
 * ¿CUÁNDO se usa?  DESPUÉS de que tu equipo responda (cuando quieras ver resultados).
 *                  Puedes correrlo las veces que quieras; cada vez crea una hoja nueva.
 *
 * ¿DÓNDE se pega?  En un PROYECTO NUEVO y APARTE del que crea el formulario (recomendado),
 *                  para que "Ejecutar" no corra por error el script que crea el formulario.
 *
 * Cómo usarlo:
 *   1. Abre https://script.google.com  ->  "Nuevo proyecto".
 *   2. Borra el código de ejemplo y pega TODO este archivo.
 *   3. En la línea URL_FORM de abajo, pega el enlace "Editar" que te dio el primer script
 *      (el que empieza con https://docs.google.com/forms/d/..../edit).
 *   4. Pulsa "Ejecutar" (solo hay una función: analizarRespuestasNEXO).
 *   5. Autoriza el acceso a Forms y a Hojas de cálculo (lo pedirá la primera vez).
 *   6. Abre "Registro de ejecución" (Ctrl+Enter): ahí aparece el enlace a la hoja con el resumen.
 */
function analizarRespuestasNEXO() {

  // ===================================================================== //
  //  PEGA AQUÍ EL ENLACE "EDITAR" DEL FORMULARIO (lo dio el primer script) //
  // ===================================================================== //
  var URL_FORM = 'PEGA_AQUI_EL_ENLACE_DE_EDITAR_DEL_FORMULARIO';
  // ===================================================================== //

  var form = FormApp.openByUrl(URL_FORM);

  // Columnas posibles en las rejillas de TÉRMINOS (misma escala del formulario).
  var COLS_TERMINO = ['Bien clasificado', 'Debería ir en otro grupo', 'No debería estar / sobra', 'No sé', '(sin responder)'];

  // --------------------------------------------------------------------- //
  // Acumuladores                                                          //
  // --------------------------------------------------------------------- //
  var pesos = {};            // nombre -> {actual, mantener, subir, bajar, nose, propuestos:[]}
  var ordenPesos = [];       // conserva el orden del formulario
  var terminos = {};         // "rejilla :: fila" -> {columna -> conteo}
  var ordenTerminos = [];    // [{key, grid, fila}]
  var comentarios = {};      // titulo -> [textos]
  var ordenComentarios = []; // conserva el orden del formulario
  var perfil = {};           // opcion -> conteo

  function pesoRec(nombre) {
    if (!pesos[nombre]) {
      pesos[nombre] = { actual: '', mantener: 0, subir: 0, bajar: 0, nose: 0, propuestos: [] };
      ordenPesos.push(nombre);
    }
    return pesos[nombre];
  }

  // --------------------------------------------------------------------- //
  // Paso 1: leer el formulario para fijar el ORDEN y los valores actuales //
  // (así el resumen sale ordenado aunque nadie haya respondido un peso).  //
  // --------------------------------------------------------------------- //
  form.getItems().forEach(function (it) {
    var m = it.getTitle().match(/^(.*) \(valor actual: (.*)\)$/);
    if (m) { pesoRec(m[1]).actual = m[2]; }
  });

  // --------------------------------------------------------------------- //
  // Paso 2: recorrer TODAS las respuestas                                 //
  // --------------------------------------------------------------------- //
  var responses = form.getResponses();
  responses.forEach(function (resp) {
    resp.getItemResponses().forEach(function (ir) {
      var item = ir.getItem();
      var title = item.getTitle();
      var type = item.getType();
      var ans = ir.getResponse();

      // (a) Peso: opción Mantener / Subir / Bajar / No sé
      var m = title.match(/^(.*) \(valor actual: (.*)\)$/);
      if (m) {
        var rec = pesoRec(m[1]);
        rec.actual = m[2];
        var a = String(ans);
        if (a.indexOf('Mantener') === 0) rec.mantener++;
        else if (a.indexOf('Subir') === 0) rec.subir++;
        else if (a.indexOf('Bajar') === 0) rec.bajar++;
        else rec.nose++;
        return;
      }

      // (b) Valor propuesto (número escrito en el campo corto)
      if (title.indexOf('Valor propuesto — ') === 0) {
        var nombre = title.substring('Valor propuesto — '.length);
        var num = parseFloat(String(ans).trim().replace(',', '.'));
        if (!isNaN(num)) pesoRec(nombre).propuestos.push(num);
        return;
      }

      // (c) Perfil
      if (title.indexOf('Perfil') === 0) {
        var p = String(ans).trim() || '(sin responder)';
        perfil[p] = (perfil[p] || 0) + 1;
        return;
      }

      // (d) Rejilla de términos (la respuesta es un arreglo paralelo a las filas)
      if (type === FormApp.ItemType.GRID) {
        var rows = item.asGridItem().getRows();
        for (var k = 0; k < rows.length; k++) {
          var key = title + ' :: ' + rows[k];
          if (!terminos[key]) {
            terminos[key] = {};
            ordenTerminos.push({ key: key, grid: title, fila: rows[k] });
          }
          var col = (ans && ans[k]) ? ans[k] : '(sin responder)';
          terminos[key][col] = (terminos[key][col] || 0) + 1;
        }
        return;
      }

      // (e) Comentarios (texto largo o corto que no sea "Valor propuesto")
      if (type === FormApp.ItemType.PARAGRAPH_TEXT || type === FormApp.ItemType.TEXT) {
        var txt = String(ans).trim();
        if (txt) {
          if (!comentarios[title]) { comentarios[title] = []; ordenComentarios.push(title); }
          comentarios[title].push(txt);
        }
        return;
      }
    });
  });

  // --------------------------------------------------------------------- //
  // Estadística sencilla para los números propuestos                      //
  // --------------------------------------------------------------------- //
  function prom(arr) {
    if (!arr.length) return '';
    var s = 0; arr.forEach(function (x) { s += x; });
    return Math.round((s / arr.length) * 100) / 100;
  }
  function mediana(arr) {
    if (!arr.length) return '';
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : Math.round(((a[mid - 1] + a[mid]) / 2) * 100) / 100;
  }
  function minimo(arr) { return arr.length ? Math.min.apply(null, arr) : ''; }
  function maximo(arr) { return arr.length ? Math.max.apply(null, arr) : ''; }

  // --------------------------------------------------------------------- //
  // Crear la hoja de cálculo de salida                                    //
  // --------------------------------------------------------------------- //
  var ss = SpreadsheetApp.create('NEXO — Resumen de respuestas (' + new Date().toISOString().substring(0, 10) + ')');

  // --- Pestaña 1: PESOS ------------------------------------------------ //
  var shP = ss.getSheets()[0].setName('Pesos');
  var filasP = [[
    'Parámetro', 'Valor actual', 'Respuestas', 'Mantener', 'Subir', 'Bajar', 'No sé',
    '% que cambiaría', 'Nº de números propuestos', 'Promedio propuesto', 'Mediana', 'Mín', 'Máx', 'Valores propuestos'
  ]];
  ordenPesos.forEach(function (nombre) {
    var r = pesos[nombre];
    var total = r.mantener + r.subir + r.bajar + r.nose;
    var pct = total ? Math.round(((r.subir + r.bajar) / total) * 100) + '%' : '';
    filasP.push([
      nombre, r.actual, total, r.mantener, r.subir, r.bajar, r.nose, pct,
      r.propuestos.length, prom(r.propuestos), mediana(r.propuestos),
      minimo(r.propuestos), maximo(r.propuestos), r.propuestos.join(', ')
    ]);
  });
  shP.getRange(1, 1, filasP.length, filasP[0].length).setValues(filasP);
  shP.setFrozenRows(1);
  shP.getRange(1, 1, 1, filasP[0].length).setFontWeight('bold');
  shP.autoResizeColumns(1, filasP[0].length);

  // --- Pestaña 2: TÉRMINOS --------------------------------------------- //
  var shT = ss.insertSheet('Términos');
  var headT = ['Rejilla', 'Término'].concat(COLS_TERMINO);
  var filasT = [headT];
  ordenTerminos.forEach(function (o) {
    var conteo = terminos[o.key];
    var fila = [o.grid, o.fila];
    COLS_TERMINO.forEach(function (c) { fila.push(conteo[c] || 0); });
    filasT.push(fila);
  });
  if (filasT.length === 1) filasT.push(['(sin respuestas todavía)', '', '', '', '', '', '']);
  shT.getRange(1, 1, filasT.length, headT.length).setValues(filasT);
  shT.setFrozenRows(1);
  shT.getRange(1, 1, 1, headT.length).setFontWeight('bold');
  shT.autoResizeColumns(1, headT.length);

  // --- Pestaña 3: COMENTARIOS ------------------------------------------ //
  var shC = ss.insertSheet('Comentarios');
  var filasC = [['Sección / pregunta', 'Comentario']];
  ordenComentarios.forEach(function (titulo) {
    comentarios[titulo].forEach(function (txt) { filasC.push([titulo, txt]); });
  });
  if (filasC.length === 1) filasC.push(['(sin comentarios todavía)', '']);
  shC.getRange(1, 1, filasC.length, 2).setValues(filasC);
  shC.setFrozenRows(1);
  shC.getRange(1, 1, 1, 2).setFontWeight('bold');
  shC.setColumnWidth(1, 300);
  shC.setColumnWidth(2, 620);

  // --- Pestaña 4: PERFIL ----------------------------------------------- //
  var shPf = ss.insertSheet('Perfil');
  var filasPf = [['Perfil', 'Respuestas']];
  Object.keys(perfil).forEach(function (k) { filasPf.push([k, perfil[k]]); });
  if (filasPf.length === 1) filasPf.push(['(sin respuestas todavía)', 0]);
  shPf.getRange(1, 1, filasPf.length, 2).setValues(filasPf);
  shPf.setFrozenRows(1);
  shPf.getRange(1, 1, 1, 2).setFontWeight('bold');
  shPf.autoResizeColumns(1, 2);

  // --------------------------------------------------------------------- //
  // Enlaces de salida                                                     //
  // --------------------------------------------------------------------- //
  Logger.log('Respuestas analizadas: ' + responses.length);
  Logger.log('Resumen creado en: ' + ss.getUrl());
}
