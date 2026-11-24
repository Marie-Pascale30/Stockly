<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Stockly — Gestion de stock</title>
    <meta name="description" content="Stockly : pilotez votre stock en temps réel.">
    <meta name="theme-color" content="#0b0b14">
    <link rel="icon" href="assets/img/logo.svg" type="image/svg+xml">

    <link rel="stylesheet" href="assets/css/fonts.css?v=2">
    <link rel="stylesheet" href="assets/css/app.css?v=2">

    <script src="assets/js/boot.js?v=2"></script>
</head>
<body>
    <div class="aurora" aria-hidden="true"><span></span><span></span><span></span></div>

    <div class="demo-banner" role="note">
        <b>Démo</b>
        <span>Application de démonstration (portfolio) : données fictives, effacées à chaque redémarrage du serveur. N’entrez pas de vraies données.</span>
        <a href="#/legal">Mentions légales &amp; confidentialité</a>
    </div>

    <div id="app">
        <div class="boot"><div class="boot-logo"></div></div>
    </div>

    <div id="toasts" class="toasts" aria-live="polite"></div>
    <div id="overlay-root"></div>

    <noscript><p class="noscript">Stockly nécessite JavaScript.</p></noscript>

    <script src="assets/lib/chart.umd.min.js?v=4.4.1"></script>
    <script type="module" src="assets/js/main.js?v=2"></script>
</body>
</html>
