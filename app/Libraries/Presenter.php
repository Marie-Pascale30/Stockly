<?php

namespace App\Libraries;

/**
 * Transforme les lignes SQL en représentations JSON propres et typées,
 * identiques quel que soit le driver (MySQL renvoie des chaînes, SQLite non).
 */
final class Presenter
{
    public static function user(array $u): array
    {
        return [
            'id'            => (int) $u['id'],
            'username'      => $u['username'],
            'email'         => $u['email'],
            'role'          => $u['role'],
            'is_active'     => (bool) ($u['is_active'] ?? true),
            'last_login_at' => self::date($u['last_login_at'] ?? null),
            'created_at'    => self::date($u['created_at'] ?? null),
            'stats'         => isset($u['movements_count']) ? [
                'movements'      => (int) $u['movements_count'],
                'last_movement'  => self::date($u['last_movement_at'] ?? null),
            ] : null,
        ];
    }

    public static function settings(?array $s): array
    {
        return [
            'theme'          => $s['theme'] ?? 'system',
            'items_per_page' => (int) ($s['items_per_page'] ?? 10),
            'notifications'  => (bool) ($s['notifications'] ?? true),
            'display_charts' => (bool) ($s['display_charts'] ?? true),
        ];
    }

    public static function product(array $p): array
    {
        $stock    = (int) $p['stock'];
        $min      = (int) $p['stock_min'];
        $purchase = (float) $p['purchase_price'];
        $sale     = (float) $p['sale_price'];

        return [
            'id'             => (int) $p['id'],
            'name'           => $p['name'],
            'reference'      => $p['reference'],
            'category'       => $p['category'] ?: null,
            'supplier'       => $p['supplier'] ?: null,
            'description'    => $p['description'] ?? null,
            'purchase_price' => round($purchase, 2),
            'sale_price'     => round($sale, 2),
            'margin'         => round($sale - $purchase, 2),
            'margin_rate'    => $sale > 0 ? round(($sale - $purchase) / $sale * 100, 1) : null,
            'stock'          => $stock,
            'stock_min'      => $min,
            'stock_value'    => round($stock * $purchase, 2),
            'status'         => self::stockStatus($stock, $min),
            'created_at'     => self::date($p['created_at'] ?? null),
            'updated_at'     => self::date($p['updated_at'] ?? null),
        ];
    }

    public static function movement(array $m): array
    {
        return [
            'id'            => (int) $m['id'],
            'type'          => $m['type'],
            'quantity'      => (int) $m['quantity'],
            'stock_after'   => (int) $m['stock_after'],
            'note'          => $m['note'] ?: null,
            'movement_date' => self::date($m['movement_date']),
            'product'       => [
                'id'        => (int) $m['product_id'],
                'name'      => $m['product_name'] ?? null,
                'reference' => $m['product_reference'] ?? null,
                'category'  => $m['product_category'] ?? null,
            ],
            'user' => $m['user_id'] ? [
                'id'       => (int) $m['user_id'],
                'username' => $m['username'] ?? null,
            ] : null,
        ];
    }

    public static function stockStatus(int $stock, int $min): string
    {
        return match (true) {
            $stock <= 0    => 'out',
            $stock <= $min => 'low',
            default        => 'ok',
        };
    }

    /** Dates au format ISO 8601 avec fuseau, faciles à exploiter côté JS. */
    public static function date(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return (new \DateTimeImmutable($value, new \DateTimeZone(config('App')->appTimezone)))->format(DATE_ATOM);
        } catch (\Exception) {
            return $value;
        }
    }
}
