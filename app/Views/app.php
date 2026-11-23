<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Stockly — Gestion de stock</title>
    <meta name="description" content="Stockly : pilotez votre stock en temps réel.">
    <meta name="theme-color" content="#0b0b14">
    <link rel="icon" href="assets/img/logo.svg" type="image/svg+xml">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css?v=1">

    <script>
        // Applique le thème avant le premier rendu (pas de flash).
        (function () {
            var theme = 'system';
            try { theme = (JSON.parse(localStorage.getItem('stockly.session') || '{}').settings || {}).theme || 'system'; } catch (e) {}
            document.documentElement.dataset.theme = theme === 'system'
                ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : theme;
        })();
        // URLs relatives à la page : fonctionne à la racine comme dans un sous-dossier.
        window.STOCKLY = { api: new URL('api/v1', document.baseURI).href };
    </script>
</head>
<body>
    <div class="aurora" aria-hidden="true"><span></span><span></span><span></span></div>

    <div id="app">
        <div class="boot"><div class="boot-logo"></div></div>
    </div>

    <div id="toasts" class="toasts" aria-live="polite"></div>
    <div id="overlay-root"></div>

    <noscript><p style="padding:2rem;text-align:center">Stockly nécessite JavaScript.</p></noscript>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
    <script type="module" src="assets/js/main.js?v=1"></script>
</body>
</html>
