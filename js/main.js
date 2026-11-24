/* Entry point. */
(function () {
  'use strict';
  function boot() {
    try {
      var W4 = window.W4;
      W4.Game.init();
      W4.UI.init();
    } catch (e) {
      if (window.console) console.error(e);
      var s = document.getElementById('screen');
      if (s) s.innerHTML = '<div class="wrap"><div class="panel bad"><b>Error al iniciar.</b><p>Tu navegador bloqueó una parte del juego. Intenta recargar. Si persiste, borra los datos almacenados de este sitio.</p></div></div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
