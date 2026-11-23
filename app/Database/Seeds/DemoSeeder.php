<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\I18n\Time;

/**
 * Données de démonstration.
 *
 *   php spark db:seed DemoSeeder
 *
 * Tous les comptes utilisent le mot de passe : password
 * L'historique est généré sur les 120 derniers jours (relatif à "maintenant")
 * pour que le tableau de bord soit toujours vivant.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        mt_srand(42);

        $this->db->disableForeignKeyChecks();
        foreach (['stock_movements', 'user_settings', 'api_tokens', 'products', 'users'] as $table) {
            $this->db->table($table)->emptyTable();
        }
        $this->db->enableForeignKeyChecks();

        $now  = Time::now();
        $hash = password_hash('password', PASSWORD_DEFAULT);

        // ------------------------------------------------------------- Users
        $users = [
            ['admin', 'admin@stockly.app', 'admin', 'system', 15],
            ['marie.dupont', 'marie.dupont@entreprise.com', 'employee', 'dark', 10],
            ['pierre.martin', 'pierre.martin@entreprise.com', 'employee', 'light', 20],
            ['sophie.bernard', 'sophie.bernard@entreprise.com', 'employee', 'dark', 12],
            ['luc.durand', 'luc.durand@entreprise.com', 'employee', 'light', 10],
        ];

        $userIds = [];
        foreach ($users as $i => [$username, $email, $role, $theme, $perPage]) {
            $created = $now->subDays(200 - $i * 3)->toDateTimeString();
            $this->db->table('users')->insert([
                'username'      => $username,
                'email'         => $email,
                'password_hash' => $hash,
                'role'          => $role,
                'is_active'     => 1,
                'last_login_at' => $now->subHours(mt_rand(1, 96))->toDateTimeString(),
                'created_at'    => $created,
                'updated_at'    => $created,
            ]);
            $id        = (int) $this->db->insertID();
            $userIds[] = $id;

            $this->db->table('user_settings')->insert([
                'user_id'        => $id,
                'theme'          => $theme,
                'items_per_page' => $perPage,
                'notifications'  => 1,
                'display_charts' => 1,
                'updated_at'     => $created,
            ]);
        }

        // ---------------------------------------------------------- Products
        // [nom, référence, catégorie, fournisseur, achat, vente, stock_min, popularité]
        $catalog = [
            ['Ordinateur portable Dell XPS 13', 'DELL-XPS13-001', 'Informatique', 'Dell Technologies', 899.99, 1199.99, 5, 3],
            ['Écran 27" 4K ASUS ProArt', 'ASUS-MON27-001', 'Informatique', 'ASUS', 349.99, 499.99, 3, 2],
            ['Clavier Logitech MX Keys', 'LOGI-MXKEYS-001', 'Informatique', 'Logitech', 89.99, 129.99, 8, 5],
            ['Souris Logitech MX Master 3S', 'LOGI-MXMASTER-001', 'Informatique', 'Logitech', 79.99, 109.99, 6, 6],
            ['Casque Bose QuietComfort Ultra', 'BOSE-QCU-001', 'Audio', 'Bose Corporation', 279.99, 399.99, 4, 3],
            ['Enceinte Sonos Era 100', 'SONOS-ERA100-001', 'Audio', 'Sonos', 199.99, 279.99, 3, 2],
            ['Webcam Logitech Brio 4K', 'LOGI-BRIO-001', 'Informatique', 'Logitech', 149.99, 219.99, 5, 3],
            ['SSD externe Samsung T9 2 To', 'SAMS-T9-2TB-001', 'Stockage', 'Samsung', 179.99, 249.99, 7, 5],
            ['Disque dur WD My Passport 4 To', 'WD-PASS4TB-001', 'Stockage', 'Western Digital', 99.99, 139.99, 6, 4],
            ['Imprimante HP LaserJet Pro', 'HP-LASERJET-001', 'Impression', 'HP Inc.', 149.99, 219.99, 2, 1],
            ['Routeur WiFi 7 ASUS RT-BE88U', 'ASUS-RTBE88U-001', 'Réseau', 'ASUS', 329.99, 449.99, 3, 2],
            ['Switch Ubiquiti 8 ports PoE', 'UBNT-SW8POE-001', 'Réseau', 'Ubiquiti', 109.99, 159.99, 4, 2],
            ['Onduleur APC Back-UPS 1500VA', 'APC-1500VA-001', 'Électronique', 'APC by Schneider', 179.99, 249.99, 4, 1],
            ['Licence Microsoft 365 Business', 'MS365-BUS-001', 'Logiciel', 'Microsoft', 69.99, 99.99, 10, 7],
            ['Antivirus Bitdefender Total Security', 'BD-TS-001', 'Logiciel', 'Bitdefender', 39.99, 59.99, 5, 4],
            ['Câble HDMI 2.1 — 2 m', 'CABLE-HDMI-2M-001', 'Accessoires', 'Belkin', 9.99, 19.99, 15, 9],
            ['Adaptateur USB-C vers HDMI', 'ADAPT-USBC-HDMI-001', 'Accessoires', 'Anker', 19.99, 34.99, 10, 7],
            ['Sacoche ordinateur 15"', 'SAC-15P-001', 'Accessoires', 'Targus', 24.99, 44.99, 8, 4],
        ];

        $days = 120;
        $movementRows = [];

        foreach ($catalog as $index => [$name, $ref, $cat, $supplier, $buy, $sell, $min, $pop]) {
            $created = $now->subDays($days + 5)->toDateTimeString();
            $this->db->table('products')->insert([
                'name'           => $name,
                'reference'      => $ref,
                'category'       => $cat,
                'supplier'       => $supplier,
                'description'    => null,
                'purchase_price' => $buy,
                'sale_price'     => $sell,
                'stock'          => 0,
                'stock_min'      => $min,
                'created_at'     => $created,
                'updated_at'     => $created,
            ]);
            $productId = (int) $this->db->insertID();

            // Simulation chronologique : réception initiale puis ventes & réassorts.
            $stock    = 0;
            $initial  = $min * 3 + mt_rand(2, 10);
            $timeline = [[$now->subDays($days)->setHour(8)->setMinute(mt_rand(0, 59)), 'in', $initial, 'Réception initiale']];

            for ($d = $days - 1; $d >= 0; $d--) {
                // Plus d'activité en semaine, et un peu plus récemment.
                $day     = $now->subDays($d);
                $weekday = (int) $day->format('N') <= 5;
                $chance  = ($weekday ? 0.11 : 0.04) * $pop * ($d < 30 ? 1.25 : 1.0);

                if (mt_rand() / mt_getrandmax() < $chance) {
                    $qty        = mt_rand(1, max(1, (int) ceil($pop / 2) + 1));
                    $timeline[] = [$day->setHour(mt_rand(9, 18))->setMinute(mt_rand(0, 59)), 'out', $qty, null];
                }
            }

            usort($timeline, static fn ($a, $b) => $a[0]->getTimestamp() <=> $b[0]->getTimestamp());

            foreach ($timeline as [$when, $type, $qty, $note]) {
                if ($type === 'out') {
                    // Réassort automatique quand on passe sous le seuil
                    // (sauf quelques produits volontairement en tension sur les 25 derniers jours).
                    $tension = $index % 5 === 1 && $when->isAfter($now->subDays(25));
                    if ($stock - $qty < $min && ! $tension) {
                        $restock = $min * 2 + mt_rand(3, 12);
                        $stock  += $restock;
                        $movementRows[] = $this->movement($productId, $userIds, 'in', $restock, $stock, $when->subHours(2), 'Réassort fournisseur');
                    }
                    if ($stock - $qty < 0) {
                        continue;
                    }
                    $stock -= $qty;
                } else {
                    $stock += $qty;
                }
                $movementRows[] = $this->movement($productId, $userIds, $type, $qty, $stock, $when, $note);
            }

            // Une correction d'inventaire de temps en temps.
            if ($index % 6 === 0 && $stock > 2) {
                $stock--;
                $movementRows[] = $this->movement($productId, $userIds, 'adjust', -1, $stock, $now->subDays(3)->setHour(17), 'Inventaire : article endommagé');
            }

            $this->db->table('products')->where('id', $productId)->update(['stock' => $stock]);
        }

        usort($movementRows, static fn ($a, $b) => strcmp($a['movement_date'], $b['movement_date']));
        foreach (array_chunk($movementRows, 200) as $chunk) {
            $this->db->table('stock_movements')->insertBatch($chunk);
        }
    }

    private function movement(int $productId, array $userIds, string $type, int $qty, int $after, Time $when, ?string $note): array
    {
        // L'admin fait plutôt les entrées, les employés plutôt les sorties.
        $userId = $type === 'out'
            ? $userIds[mt_rand(1, count($userIds) - 1)]
            : $userIds[mt_rand(0, 1) === 0 ? 0 : mt_rand(1, count($userIds) - 1)];

        return [
            'product_id'    => $productId,
            'user_id'       => $userId,
            'type'          => $type,
            'quantity'      => $qty,
            'stock_after'   => $after,
            'note'          => $note,
            'movement_date' => $when->toDateTimeString(),
            'created_at'    => $when->toDateTimeString(),
        ];
    }
}
