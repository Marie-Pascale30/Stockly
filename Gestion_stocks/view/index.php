<?php
session_start();
$theme = $_SESSION['theme'] ?? 'light';
?>
<!DOCTYPE html>
<html lang="fr" data-theme="<?= $theme ?>">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stockly - Tableau de bord</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600&family=Roboto&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: #2C6BED;
      --background-color: #FFFFFF;
      --text-color: #2E2E2E;
      --sidebar-bg: #F2F3F5;
      --sidebar-hover: #E5E7EB;
    }
    [data-theme="dark"] {
      --background-color: #121212;
      --text-color: #EDEDED;
      --sidebar-bg: #1E1E1E;
      --sidebar-hover: #2C2C2C;
    }

    body {
      background-color: var(--background-color);
      color: var(--text-color);
      font-family: 'Roboto', sans-serif;
      display: flex;
      transition: background 0.4s ease, color 0.4s ease;
      margin: 0;
    }

    /* ---- SIDEBAR ---- */
    .sidebar {
      width: 250px;
      height: 100vh;
      background-color: var(--sidebar-bg);
      position: fixed;
      left: 0;
      top: 0;
      display: flex;
      flex-direction: column;
      padding: 1rem;
      border-right: 2px solid var(--primary-color);
      transition: transform 0.3s ease-in-out;
    }

    .sidebar h2 {
      font-family: 'Poppins', sans-serif;
      font-weight: 600;
      color: var(--primary-color);
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .sidebar a {
      color: var(--text-color);
      text-decoration: none;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      display: block;
      transition: background 0.3s;
      font-weight: 500;
    }

    .sidebar a:hover {
      background-color: var(--sidebar-hover);
    }

    .sidebar a.active {
      background-color: var(--primary-color);
      color: #fff;
    }

    /* ---- HEADER ---- */
    header {
      width: 100%;
      background-color: var(--sidebar-bg);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--primary-color);
      position: fixed;
      left: 250px;
      top: 0;
      right: 0;
      z-index: 10;
      transition: left 0.3s;
    }

    .theme-toggle {
      border: none;
      background: none;
      font-size: 1.4rem;
      cursor: pointer;
      color: var(--text-color);
      transition: transform 0.3s;
    }
    .theme-toggle:hover {
      transform: rotate(20deg);
    }

    /* ---- MAIN ---- */
    main {
      margin-left: 250px;
      margin-top: 80px;
      padding: 2rem;
      transition: margin-left 0.3s;
    }

    /* ---- RESPONSIVE ---- */
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
      }
      .sidebar.active {
        transform: translateX(0);
      }
      header {
        left: 0;
      }
      main {
        margin-left: 0;
      }
      .menu-toggle {
        display: block;
      }
    }

    .menu-toggle {
      display: none;
      background: none;
      border: none;
      font-size: 1.8rem;
      cursor: pointer;
      color: var(--text-color);
    }

  </style>
</head>
<body>

  <!-- SIDEBAR -->
  <nav class="sidebar" id="sidebar">
    <h2>📦 Stockly</h2>
    <a href="#" class="active">🏠 Tableau de bord</a>
    <a href="#">📦 Produits</a>
    <a href="#">🔁 Mouvements</a>
    <a href="#">📊 Statistiques</a>
    <a href="#">⚙️ Paramètres</a>
  </nav>

  <!-- HEADER -->
  <header>
    <button class="menu-toggle" id="menuButton">☰</button>
    <h4>Bienvenue, Admin</h4>
    <button id="themeButton" class="theme-toggle" title="Changer de mode">🌙</button>
  </header>

  <!-- CONTENU PRINCIPAL -->
  <main>
    <h1>Tableau de bord</h1>
    <p>Bienvenue sur ton interface de gestion <strong>Stockly</strong> 🧭</p>

    <div class="row mt-4">
      <div class="col-md-4 mb-3">
        <div class="card p-3 shadow-sm" style="background: var(--sidebar-bg);">
          <h5>Produits en stock</h5>
          <p><strong>120</strong> articles</p>
        </div>
      </div>
      <div class="col-md-4 mb-3">
        <div class="card p-3 shadow-sm" style="background: var(--sidebar-bg);">
          <h5>Mouvements récents</h5>
          <p><strong>15</strong> transactions</p>
        </div>
      </div>
      <div class="col-md-4 mb-3">
        <div class="card p-3 shadow-sm" style="background: var(--sidebar-bg);">
          <h5>Valeur totale du stock</h5>
          <p><strong>89 500 €</strong></p>
        </div>
      </div>
    </div>
  </main>

  <script>
    // --- GESTION DU THÈME ---
    const themeButton = document.getElementById("themeButton");
    const html = document.documentElement;
    themeButton.addEventListener("click", () => {
      const current = html.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      html.setAttribute("data-theme", next);
      themeButton.textContent = next === "dark" ? "☀️" : "🌙";
      localStorage.setItem("theme", next);
    });

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      html.setAttribute("data-theme", savedTheme);
      themeButton.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    }

    // --- GESTION DU MENU MOBILE ---
    const menuButton = document.getElementById("menuButton");
    const sidebar = document.getElementById("sidebar");
    menuButton.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  </script>

</body>
</html>
