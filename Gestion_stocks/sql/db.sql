
CREATE DATABASE stock_db;
USE stock_db;

-- Table des utilisateurs (si tu veux gérer les rôles plus tard)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','employee') DEFAULT 'employee',
    created_at DATETIME DEFAULT now()
);

-- Table des produits
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    reference VARCHAR(100) UNIQUE,
    category VARCHAR(100),
    supplier VARCHAR(150),
    purchase_price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    stock INT DEFAULT 0,
    stock_min INT DEFAULT 5,
    created_at DATETIME DEFAULT now()
);

-- Table des mouvements de stock (entrées/sorties)
CREATE TABLE stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('entrée','sortie') NOT NULL,
    quantity INT NOT NULL,
    movement_date DATETIME DEFAULT now(),
    product_id INT,
    user_id INT,
    FOREIGN KEY (product_id) REFERENCES products(id) on delete cascade,
    FOREIGN KEY (user_id) REFERENCES users(id) on delete cascade
);
