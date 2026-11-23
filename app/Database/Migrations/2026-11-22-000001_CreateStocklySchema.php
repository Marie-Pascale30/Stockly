<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Schéma complet de Stockly.
 *
 * Portable MySQL / SQLite : pas d'ENUM, pas de fonctions SQL spécifiques.
 */
class CreateStocklySchema extends Migration
{
    public function up(): void
    {
        // ---------------------------------------------------------------- users
        $this->forge->addField([
            'id'            => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'username'      => ['type' => 'VARCHAR', 'constraint' => 100],
            'email'         => ['type' => 'VARCHAR', 'constraint' => 190],
            'password_hash' => ['type' => 'VARCHAR', 'constraint' => 255],
            'role'          => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'employee'],
            'is_active'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'last_login_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('username');
        $this->forge->addUniqueKey('email');
        $this->forge->createTable('users', true);

        // ----------------------------------------------------------- api_tokens
        $this->forge->addField([
            'id'           => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'      => ['type' => 'INT', 'unsigned' => true],
            'token_hash'   => ['type' => 'CHAR', 'constraint' => 64],
            'user_agent'   => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'last_used_at' => ['type' => 'DATETIME', 'null' => true],
            'expires_at'   => ['type' => 'DATETIME'],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('token_hash');
        $this->forge->addKey('user_id');
        $this->forge->addForeignKey('user_id', 'users', 'id', '', 'CASCADE');
        $this->forge->createTable('api_tokens', true);

        // ------------------------------------------------------------- products
        $this->forge->addField([
            'id'             => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name'           => ['type' => 'VARCHAR', 'constraint' => 200],
            'reference'      => ['type' => 'VARCHAR', 'constraint' => 100],
            'category'       => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'supplier'       => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
            'description'    => ['type' => 'TEXT', 'null' => true],
            'purchase_price' => ['type' => 'DECIMAL', 'constraint' => '10,2', 'default' => 0],
            'sale_price'     => ['type' => 'DECIMAL', 'constraint' => '10,2', 'default' => 0],
            'stock'          => ['type' => 'INT', 'default' => 0],
            'stock_min'      => ['type' => 'INT', 'default' => 5],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
            'deleted_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        // Unicité de la référence vérifiée applicativement (les produits archivés libèrent leur référence).
        $this->forge->addKey('reference');
        $this->forge->addKey('category');
        $this->forge->createTable('products', true);

        // ------------------------------------------------------ stock_movements
        $this->forge->addField([
            'id'            => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'product_id'    => ['type' => 'INT', 'unsigned' => true],
            'user_id'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'type'          => ['type' => 'VARCHAR', 'constraint' => 10], // in | out | adjust
            'quantity'      => ['type' => 'INT'],                          // signé pour "adjust"
            'stock_after'   => ['type' => 'INT'],
            'note'          => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'movement_date' => ['type' => 'DATETIME'],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['product_id', 'movement_date']);
        $this->forge->addKey('movement_date');
        $this->forge->addForeignKey('product_id', 'products', 'id', '', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', '', 'SET NULL');
        $this->forge->createTable('stock_movements', true);

        // -------------------------------------------------------- user_settings
        $this->forge->addField([
            'user_id'        => ['type' => 'INT', 'unsigned' => true],
            'theme'          => ['type' => 'VARCHAR', 'constraint' => 10, 'default' => 'system'],
            'items_per_page' => ['type' => 'INT', 'default' => 10],
            'notifications'  => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'display_charts' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('user_id');
        $this->forge->addForeignKey('user_id', 'users', 'id', '', 'CASCADE');
        $this->forge->createTable('user_settings', true);
    }

    public function down(): void
    {
        $this->forge->dropTable('user_settings', true);
        $this->forge->dropTable('stock_movements', true);
        $this->forge->dropTable('products', true);
        $this->forge->dropTable('api_tokens', true);
        $this->forge->dropTable('users', true);
    }
}
