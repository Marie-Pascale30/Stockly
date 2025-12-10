<?php
require_once 'config.php';
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $name = $_POST['name'];
    $reference = $_POST['reference'];
    $category = $_POST['category'];
    $supplier = $_POST['supplier'];
    $purchase_price = $_POST['purchase_price'];
    $sale_price = $_POST['sale_price'];
    $stock = $_POST['stock'];

    $stmt = $conn->prepare("INSERT INTO products (name, reference, category, supplier, purchase_price, sale_price, stock) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssdi", $name, $reference, $category, $supplier, $purchase_price, $sale_price, $stock);
    $stmt->execute();
    header("Location: products.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ajouter Produit</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container mt-4">
  <h1>➕ Ajouter un Produit</h1>
  <form method="POST">
    <div class="mb-3">
      <label class="form-label">Nom</label>
      <input type="text" name="name" class="form-control" required>
    </div>
    <div class="mb-3">
      <label class="form-label">Référence</label>
      <input type="text" name="reference" class="form-control">
    </div>
    <div class="mb-3">
      <label class="form-label">Catégorie</label>
      <input type="text" name="category" class="form-control">
    </div>
    <div class="mb-3">
      <label class="form-label">Fournisseur</label>
      <input type="text" name="supplier" class="form-control">
    </div>
    <div class="mb-3">
      <label class="form-label">Prix d’achat (€)</label>
      <input type="number" step="0.01" name="purchase_price" class="form-control">
    </div>
    <div class="mb-3">
      <label class="form-label">Prix de vente (€)</label>
      <input type="number" step="0.01" name="sale_price" class="form-control">
    </div>
    <div class="mb-3">
      <label class="form-label">Stock initial</label>
      <input type="number" name="stock" class="form-control" required>
    </div>
    <button type="submit" class="btn btn-success">✅ Enregistrer</button>
    <a href="products.php" class="btn btn-secondary">❌ Annuler</a>
  </form>
</div>
</body>
</html>
