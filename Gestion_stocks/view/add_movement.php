<?php
require_once 'config.php';

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $product_id = $_POST['product_id'];
    $type = $_POST['type'];
    $quantity = (int) $_POST['quantity'];
    $user_id = 1; // TODO: remplacer par $_SESSION['user_id'] si gestion login

    // Insertion du mouvement
    $stmt = $conn->prepare("INSERT INTO stock_movements (product_id, type, quantity, user_id) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isii", $product_id, $type, $quantity, $user_id);
    $stmt->execute();

    // Mise à jour du stock dans la table produits
    if ($type === 'entrée') {
        $conn->query("UPDATE products SET stock = stock + $quantity WHERE id = $product_id");
    } else {
        $conn->query("UPDATE products SET stock = stock - $quantity WHERE id = $product_id");
    }

    header("Location: stock.php");
    exit;
}

// Récupération des produits
$products = $conn->query("SELECT * FROM products ORDER BY name ASC");
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ajouter un Mouvement</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container mt-4">
  <h1>➕ Nouveau Mouvement</h1>
  <form method="POST">
    <div class="mb-3">
      <label class="form-label">Produit</label>
      <select name="product_id" class="form-control" required>
        <option value="">-- Choisir un produit --</option>
        <?php while($p = $products->fetch_assoc()): ?>
          <option value="<?= $p['id'] ?>"><?= htmlspecialchars($p['name']) ?> (Stock: <?= $p['stock'] ?>)</option>
        <?php endwhile; ?>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Type</label>
      <select name="type" class="form-control" required>
        <option value="entrée">🟢 Entrée</option>
        <option value="sortie">🔴 Sortie</option>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Quantité</label>
      <input type="number" name="quantity" class="form-control" required min="1">
    </div>
    <button type="submit" class="btn btn-success">✅ Enregistrer</button>
    <a href="stock.php" class="btn btn-secondary">❌ Annuler</a>
  </form>
</div>
</body>
</html>
