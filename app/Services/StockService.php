<?php

namespace App\Services;

use App\Libraries\Presenter;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\I18n\Time;
use DomainException;

/**
 * Toute modification de stock passe par ici.
 *
 * La mise à jour du stock est une requête UPDATE conditionnelle unique,
 * exécutée dans une transaction avec l'écriture du mouvement : deux sorties
 * simultanées ne peuvent jamais rendre le stock négatif.
 */
class StockService
{
    public const TYPES = ['in', 'out', 'adjust'];

    private BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? db_connect();
    }

    /**
     * @param string $type     in | out | adjust
     * @param int    $quantity quantité pour in/out ; stock compté (absolu) pour adjust
     *
     * @return array{movement: array, product: array, alert: string|null}
     *
     * @throws DomainException code 404 (produit introuvable) ou 409 (stock insuffisant / aucun écart)
     */
    public function record(int $productId, string $type, int $quantity, ?int $userId, ?string $note = null): array
    {
        $now = Time::now()->toDateTimeString();

        $this->db->transBegin();

        try {
            $product = $this->db->table('products')
                ->where('id', $productId)
                ->where('deleted_at', null)
                ->get()->getRowArray();

            if (! $product) {
                throw new DomainException('Produit introuvable.', 404);
            }

            $table = $this->db->prefixTable('products');

            if ($type === 'in') {
                $this->db->query("UPDATE {$table} SET stock = stock + ?, updated_at = ? WHERE id = ?", [$quantity, $now, $productId]);
                $delta = $quantity;
            } elseif ($type === 'out') {
                $this->db->query(
                    "UPDATE {$table} SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?",
                    [$quantity, $now, $productId, $quantity]
                );
                if ($this->db->affectedRows() === 0) {
                    throw new DomainException(sprintf(
                        'Stock insuffisant : %d disponible(s) pour « %s », %d demandé(s).',
                        (int) $product['stock'],
                        $product['name'],
                        $quantity
                    ), 409);
                }
                $delta = -$quantity;
            } else { // adjust : $quantity est le stock réellement compté
                $delta = $quantity - (int) $product['stock'];
                if ($delta === 0) {
                    throw new DomainException('Le stock compté est identique au stock actuel : aucun ajustement nécessaire.', 409);
                }
                $this->db->query("UPDATE {$table} SET stock = ?, updated_at = ? WHERE id = ?", [$quantity, $now, $productId]);
            }

            $stockAfter = (int) $this->db->table('products')->select('stock')->where('id', $productId)->get()->getRow('stock');

            $this->db->table('stock_movements')->insert([
                'product_id'    => $productId,
                'user_id'       => $userId,
                'type'          => $type,
                'quantity'      => $type === 'adjust' ? $delta : $quantity,
                'stock_after'   => $stockAfter,
                'note'          => $note !== null && trim($note) !== '' ? mb_substr(trim($note), 0, 255) : null,
                'movement_date' => $now,
                'created_at'    => $now,
            ]);
            $movementId = (int) $this->db->insertID();

            if ($this->db->transStatus() === false) {
                throw new \RuntimeException('Échec de la transaction.');
            }

            $this->db->transCommit();
        } catch (\Throwable $e) {
            $this->db->transRollback();

            throw $e;
        }

        $product['stock']      = $stockAfter;
        $product['updated_at'] = $now;
        $presented        = Presenter::product($product);

        return [
            'movement' => $this->find($movementId),
            'product'  => $presented,
            'alert'    => match ($presented['status']) {
                'out'   => sprintf('« %s » est maintenant en rupture de stock.', $product['name']),
                'low'   => sprintf('« %s » est sous le seuil d\'alerte (%d restant(s), minimum %d).', $product['name'], $stockAfter, $product['stock_min']),
                default => null,
            },
        ];
    }

    public function find(int $movementId): ?array
    {
        $row = $this->baseQuery()->where('m.id', $movementId)->get()->getRowArray();

        return $row ? Presenter::movement($row) : null;
    }

    /** Requête de base des mouvements avec produit et utilisateur joints. */
    public function baseQuery()
    {
        return $this->db->table('stock_movements m')
            ->select('m.*, p.name AS product_name, p.reference AS product_reference, p.category AS product_category, u.username')
            ->join('products p', 'p.id = m.product_id')
            ->join('users u', 'u.id = m.user_id', 'left');
    }
}
