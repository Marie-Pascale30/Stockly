// Exécuté avant le premier rendu (script externe : compatible avec la CSP « script-src 'self' »).
(function () {
  // Applique le thème avant le premier rendu (pas de flash).
  var theme = 'system';
  try { theme = (JSON.parse(localStorage.getItem('stockly.session') || '{}').settings || {}).theme || 'system'; } catch (e) {}
  document.documentElement.dataset.theme = theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  // URLs relatives à la page : fonctionne à la racine comme dans un sous-dossier.
  window.STOCKLY = { api: new URL('api/v1', document.baseURI).href };
})();
