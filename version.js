/*
 * Fuente ÚNICA de la versión que ve la página.
 *
 *  - La página la carga con <script src="./version.js"></script> y
 *    usa window.APP_VERSION para mostrar la versión en la UI.
 *
 * IMPORTANTE: service-worker.js NO importa este archivo. Tiene su
 * PROPIA copia literal de APP_VERSION porque el navegador sólo detecta
 * cambios del SW comparando bytes de service-worker.js; si la versión
 * se leyera vía importScripts(), cambiar este archivo no forzaría la
 * reinstalación del SW y los usuarios se quedarían con caché vieja.
 *
 * Para sacar una nueva versión:
 *   1) Edita APP_VERSION en ESTE archivo (version.js).
 *   2) Edita TAMBIÉN APP_VERSION en service-worker.js con el mismo
 *      valor. Es la ÚNICA duplicación permitida y es obligatoria.
 *   3) Redeploy.
 */
(function () {
  'use strict';
  const APP_VERSION = 'v3.0.5';
  const root = typeof self !== 'undefined' ? self : window;
  root.APP_VERSION = APP_VERSION;
})();
