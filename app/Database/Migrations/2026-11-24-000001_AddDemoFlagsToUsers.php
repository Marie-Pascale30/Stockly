<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Comptes de démonstration.
 *
 *   is_demo      : compte créé par le seeder (identifiants publics). Il est protégé :
 *                  mot de passe, email, rôle, activation et suppression verrouillés.
 *   demo_sandbox : compte visible et gérable depuis un compte de démo
 *                  (comptes de démo + comptes créés depuis un compte de démo).
 *                  Les inscriptions de vrais visiteurs restent à 0 : l'admin de démo
 *                  public ne les voit pas et ne peut pas agir dessus.
 */
class AddDemoFlagsToUsers extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('users', [
            'is_demo'      => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'demo_sandbox' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
        ]);
    }

    public function down(): void
    {
        $this->forge->dropColumn('users', ['is_demo', 'demo_sandbox']);
    }
}
