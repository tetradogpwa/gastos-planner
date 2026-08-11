/*
 * Fuente ÚNICA de la versión de la app.
 *
 *  - El service worker la importa con importScripts('./version.js').
 *  - La página la carga con <script src="./version.js"></script>.
 *
 * Para sacar una nueva versión:
 *   1) Edita SOLO el valor de APP_VERSION en este archivo.
 *   2) Toca también el comentario "build:" de service-worker.js para
 *      forzar al navegador a detectar el cambio y reinstalar el SW.
 *   3) Redeploy.
 *
 * NO dupliques el número en index.html, service-worker.js ni en
 * ningún otro sitio: ambos lo leen de aquí.
 */
(function () {
  'use strict';
  const APP_VERSION = 'v3.0.4';
  const root = typeof self !== 'undefined' ? self : window;
  root.APP_VERSION = APP_VERSION;
})();
