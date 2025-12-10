<?php
require_once 'config.php';

// Requête pour récupérer les mouvements avec le nom du produit
$sql = "SELECT sm.*, p.name AS product_name, u.username AS user_name 
        FROM stock_movements sm 
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN users u ON sm.user_id = u.id
        ORDER BY sm.movement_date DESC";
$result = $conn->query($sql);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Gestion des Mouvements de Stock</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container mt-4">
  <h1 class="mb-4">📊 Mouvements de Stock</h1>
  <a href="add_movement.php" class="btn btn-primary mb-3">➕ Nouveau mouvement</a>
  <a href="products.php" class="btn btn-secondary mb-3">⬅️ Retour aux produits</a>

  <table class="table table-bordered table-striped">
    <thead class="table-dark">
      <tr>
        <th>Produit</th>
        <th>Type</th>
        <th>Quantité</th>
        <th>Date</th>
        <th>Utilisateur</th>
      </tr>
    </thead>
    <tbody>
      <?php while($row = $result->fetch_assoc()): ?>
        <tr>
          <td><?= htmlspecialchars($row['product_name']) ?></td>
          <td><?= ($row['type'] === 'entrée') ? "🟢 Entrée" : "🔴 Sortie" ?></td>
          <td><?= $row['quantity'] ?></td>
          <td><?= $row['movement_date'] ?></td>
          <td><?= $row['user_name'] ?? "Système" ?></td>
        </tr>
      <?php endwhile; ?>
    </tbody>
  </table>
</div>
</body>
</html>
