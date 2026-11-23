<?php

namespace App\Services;

use App\Libraries\Presenter;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\I18n\Time;

/**
 * Agrégats du tableau de bord et des statistiques.
 * SQL volontairement portable (MySQL / SQLite) : les dates sont calculées en PHP.
 */
class StatsService
{
    private BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? db_connect();
    }

    // ===================================================================
    // Tableau de bord
    // ===================================================================

    public function dashboard(): array
    {
        $now      = Time::now();
        $from30   = $now->subDays(29)->setTime(0, 0)->toDateTimeString();
        $from60   = $now->subDays(59)->setTime(0, 0)->toDateTimeString();
        $from7    = $now->subDays(6)->setTime(0, 0)->toDateTimeString();
        $from14   = $now->subDays(13)->setTime(0, 0)->toDateTimeString();

        $inventory = $this->inventory();
        $current   = $this->flows($from30, null);
        $previous  = $this->flows($from60, $from30);

        $moves7    = $this->countMovements($from7, null);
        $movesPrev = $this->countMovements($from14, $from7);

        $series = $this->dailySeries(30, null);

        return [
            'kpis' => [
                'products'        => $inventory['products'],
                'units'           => $inventory['units'],
                'stock_value'     => $inventory['value_purchase'],
                'stock_value_sale'=> $inventory['value_sale'],
                'potential_margin'=> round($inventory['value_sale'] - $inventory['value_purchase'], 2),
                'low_stock'       => $inventory['low'],
                'out_of_stock'    => $inventory['out'],
                'movements_7d'    => ['value' => $moves7, 'previous' => $movesPrev, 'trend' => self::trend($moves7, $movesPrev)],
                'revenue_30d'     => ['value' => $current['revenue'], 'previous' => $previous['revenue'], 'trend' => self::trend($current['revenue'], $previous['revenue'])],
                'units_out_30d'   => ['value' => $current['out_units'], 'previous' => $previous['out_units'], 'trend' => self::trend($current['out_units'], $previous['out_units'])],
                'units_in_30d'    => ['value' => $current['in_units'], 'previous' => $previous['in_units'], 'trend' => self::trend($current['in_units'], $previous['in_units'])],
            ],
            'series'     => $series,
            'categories' => $this->categories(null, $from30),
            'alerts'     => $this->critical(8),
            'top'        => $this->topProducts($from30, null, 5),
            'recent'     => $this->recent(8),
        ];
    }

    // ===================================================================
    // Statistiques détaillées
    // ===================================================================

    public function stats(int $days, ?string $category): array
    {
        $now       = Time::now();
        $from      = $now->subDays($days - 1)->setTime(0, 0)->toDateTimeString();
        $prevFrom  = $now->subDays($days * 2 - 1)->setTime(0, 0)->toDateTimeString();

        $cur  = $this->flows($from, null, $category);
        $prev = $this->flows($prevFrom, $from, $category);

        $summary = [];
        foreach (['revenue', 'cogs', 'gross_margin', 'out_units', 'in_units', 'movements'] as $key) {
            $summary[$key] = ['value' => $cur[$key], 'previous' => $prev[$key], 'trend' => self::trend($cur[$key], $prev[$key])];
        }
        $summary['margin_rate'] = $cur['revenue'] > 0 ? round($cur['gross_margin'] / $cur['revenue'] * 100, 1) : null;

        return [
            'period'     => ['days' => $days, 'from' => Presenter::date($from), 'to' => Presenter::date($now->toDateTimeString()), 'category' => $category],
            'summary'    => $summary,
            'series'     => $this->dailySeries($days, $category),
            'categories' => $this->categories($category, $from),
            'top'        => $this->topProducts($from, $category, 10),
            'users'      => $this->topUsers($from, $category),
            'critical'   => $this->critical(10, $category),
            'dormant'    => $this->dormant($from, $category),
        ];
    }

    // ===================================================================
    // Briques
    // ===================================================================

    private function inventory(): array
    {
        $r = $this->db->query(
            'SELECT COUNT(*) AS products,
                    COALESCE(SUM(stock), 0) AS units,
                    COALESCE(SUM(stock * purchase_price), 0) AS value_purchase,
                    COALESCE(SUM(stock * sale_price), 0) AS value_sale,
                    COALESCE(SUM(CASE WHEN stock > 0 AND stock <= stock_min THEN 1 ELSE 0 END), 0) AS low,
                    COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS out_count
             FROM products WHERE deleted_at IS NULL'
        )->getRowArray();

        return [
            'products'       => (int) $r['products'],
            'units'          => (int) $r['units'],
            'value_purchase' => round((float) $r['value_purchase'], 2),
            'value_sale'     => round((float) $r['value_sale'], 2),
            'low'            => (int) $r['low'],
            'out'            => (int) $r['out_count'],
        ];
    }

    /** Flux entrants/sortants et valorisation (prix courants) sur [from, to[. */
    private function flows(string $from, ?string $to, ?string $category = null): array
    {
        [$where, $binds] = $this->periodWhere($from, $to, $category);

        $r = $this->db->query(
            "SELECT COUNT(*) AS movements,
                    COALESCE(SUM(CASE WHEN m.type = 'in'  THEN m.quantity ELSE 0 END), 0) AS in_units,
                    COALESCE(SUM(CASE WHEN m.type = 'out' THEN m.quantity ELSE 0 END), 0) AS out_units,
                    COALESCE(SUM(CASE WHEN m.type = 'out' THEN m.quantity * p.sale_price ELSE 0 END), 0) AS revenue,
                    COALESCE(SUM(CASE WHEN m.type = 'out' THEN m.quantity * p.purchase_price ELSE 0 END), 0) AS cogs
             FROM stock_movements m JOIN products p ON p.id = m.product_id
             WHERE {$where}",
            $binds
        )->getRowArray();

        $revenue = round((float) $r['revenue'], 2);
        $cogs    = round((float) $r['cogs'], 2);

        return [
            'movements'    => (int) $r['movements'],
            'in_units'     => (int) $r['in_units'],
            'out_units'    => (int) $r['out_units'],
            'revenue'      => $revenue,
            'cogs'         => $cogs,
            'gross_margin' => round($revenue - $cogs, 2),
        ];
    }

    private function countMovements(string $from, ?string $to): int
    {
        [$where, $binds] = $this->periodWhere($from, $to, null);

        return (int) $this->db->query(
            "SELECT COUNT(*) AS c FROM stock_movements m JOIN products p ON p.id = m.product_id WHERE {$where}",
            $binds
        )->getRow('c');
    }

    /**
     * Série journalière complète (jours sans activité inclus).
     * À partir de 90 jours, regroupement hebdomadaire pour rester lisible.
     */
    private function dailySeries(int $days, ?string $category): array
    {
        $now  = Time::now();
        $from = $now->subDays($days - 1)->setTime(0, 0);
        [$where, $binds] = $this->periodWhere($from->toDateTimeString(), null, $category);

        $rows = $this->db->query(
            "SELECT DATE(m.movement_date) AS day, m.type, SUM(m.quantity) AS qty,
                    SUM(m.quantity * p.sale_price) AS amount
             FROM stock_movements m JOIN products p ON p.id = m.product_id
             WHERE {$where} AND m.type IN ('in', 'out')
             GROUP BY DATE(m.movement_date), m.type",
            $binds
        )->getResultArray();

        $index = [];
        foreach ($rows as $row) {
            $index[$row['day']][$row['type']] = (int) $row['qty'];
            if ($row['type'] === 'out') {
                $index[$row['day']]['revenue'] = round((float) $row['amount'], 2);
            }
        }

        $weekly  = $days >= 90;
        $buckets = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $from->addDays($i);
            $day  = $date->format('Y-m-d');
            $key  = $weekly ? $date->subDays((int) $date->format('N') - 1)->format('Y-m-d') : $day;

            $buckets[$key] ??= ['date' => $key, 'in' => 0, 'out' => 0, 'revenue' => 0.0];
            $buckets[$key]['in']      += $index[$day]['in'] ?? 0;
            $buckets[$key]['out']     += $index[$day]['out'] ?? 0;
            $buckets[$key]['revenue'] += $index[$day]['revenue'] ?? 0;
        }

        return ['granularity' => $weekly ? 'week' : 'day', 'points' => array_values($buckets)];
    }

    private function categories(?string $category, string $from): array
    {
        $binds = [$from];
        $filter = '';
        if ($category) {
            $filter  = ' AND p.category = ?';
            $binds[] = $category;
        }

        $rows = $this->db->query(
            "SELECT COALESCE(p.category, 'Sans catégorie') AS category,
                    COUNT(*) AS products,
                    SUM(p.stock) AS units,
                    SUM(p.stock * p.purchase_price) AS value,
                    SUM(COALESCE(o.qty, 0)) AS out_units,
                    SUM(COALESCE(o.qty, 0) * p.sale_price) AS revenue
             FROM products p
             LEFT JOIN (
                SELECT product_id, SUM(quantity) AS qty FROM stock_movements
                WHERE type = 'out' AND movement_date >= ? GROUP BY product_id
             ) o ON o.product_id = p.id
             WHERE p.deleted_at IS NULL{$filter}
             GROUP BY COALESCE(p.category, 'Sans catégorie')
             ORDER BY value DESC",
            $binds
        )->getResultArray();

        return array_map(static fn ($r) => [
            'category'  => $r['category'],
            'products'  => (int) $r['products'],
            'units'     => (int) $r['units'],
            'value'     => round((float) $r['value'], 2),
            'out_units' => (int) $r['out_units'],
            'revenue'   => round((float) $r['revenue'], 2),
        ], $rows);
    }

    private function topProducts(string $from, ?string $category, int $limit): array
    {
        [$where, $binds] = $this->periodWhere($from, null, $category);

        $rows = $this->db->query(
            "SELECT p.id, p.name, p.reference, p.category, p.stock, p.stock_min,
                    SUM(m.quantity) AS qty,
                    SUM(m.quantity * p.sale_price) AS revenue,
                    SUM(m.quantity * (p.sale_price - p.purchase_price)) AS margin
             FROM stock_movements m JOIN products p ON p.id = m.product_id
             WHERE {$where} AND m.type = 'out' AND p.deleted_at IS NULL
             GROUP BY p.id, p.name, p.reference, p.category, p.stock, p.stock_min
             ORDER BY revenue DESC
             LIMIT " . (int) $limit,
            $binds
        )->getResultArray();

        return array_map(static fn ($r) => [
            'id'        => (int) $r['id'],
            'name'      => $r['name'],
            'reference' => $r['reference'],
            'category'  => $r['category'],
            'stock'     => (int) $r['stock'],
            'status'    => Presenter::stockStatus((int) $r['stock'], (int) $r['stock_min']),
            'qty'       => (int) $r['qty'],
            'revenue'   => round((float) $r['revenue'], 2),
            'margin'    => round((float) $r['margin'], 2),
        ], $rows);
    }

    private function topUsers(string $from, ?string $category): array
    {
        [$where, $binds] = $this->periodWhere($from, null, $category);

        $rows = $this->db->query(
            "SELECT u.id, u.username, u.role,
                    COUNT(*) AS movements,
                    SUM(CASE WHEN m.type = 'in' THEN m.quantity ELSE 0 END) AS in_units,
                    SUM(CASE WHEN m.type = 'out' THEN m.quantity ELSE 0 END) AS out_units
             FROM stock_movements m
             JOIN products p ON p.id = m.product_id
             JOIN users u ON u.id = m.user_id
             WHERE {$where}
             GROUP BY u.id, u.username, u.role
             ORDER BY movements DESC",
            $binds
        )->getResultArray();

        return array_map(static fn ($r) => [
            'id'        => (int) $r['id'],
            'username'  => $r['username'],
            'role'      => $r['role'],
            'movements' => (int) $r['movements'],
            'in_units'  => (int) $r['in_units'],
            'out_units' => (int) $r['out_units'],
        ], $rows);
    }

    public function critical(int $limit, ?string $category = null): array
    {
        $builder = $this->db->table('products')
            ->where('deleted_at', null)
            ->where('stock <= stock_min', null, false)
            ->orderBy('(stock - stock_min)', 'ASC', false)
            ->orderBy('name', 'ASC')
            ->limit($limit);

        if ($category) {
            $builder->where('category', $category);
        }

        return array_map(static function ($p) {
            $out              = Presenter::product($p);
            $out['shortage']  = max(0, $out['stock_min'] - $out['stock']);
            $out['suggested'] = max(1, $out['stock_min'] * 2 - $out['stock']); // réassort conseillé

            return $out;
        }, $builder->get()->getResultArray());
    }

    /** Produits en stock sans aucune sortie sur la période : capital immobilisé. */
    private function dormant(string $from, ?string $category): array
    {
        $binds  = [$from];
        $filter = '';
        if ($category) {
            $filter  = ' AND p.category = ?';
            $binds[] = $category;
        }

        $rows = $this->db->query(
            "SELECT p.* FROM products p
             WHERE p.deleted_at IS NULL AND p.stock > 0{$filter}
               AND NOT EXISTS (
                 SELECT 1 FROM stock_movements m
                 WHERE m.product_id = p.id AND m.type = 'out' AND m.movement_date >= ?
               )
             ORDER BY p.stock * p.purchase_price DESC
             LIMIT 10",
            array_merge(array_slice($binds, 1), [$binds[0]])
        )->getResultArray();

        return array_map([Presenter::class, 'product'], $rows);
    }

    private function recent(int $limit): array
    {
        $rows = (new StockService($this->db))->baseQuery()
            ->orderBy('m.movement_date', 'DESC')
            ->orderBy('m.id', 'DESC')
            ->limit($limit)
            ->get()->getResultArray();

        return array_map([Presenter::class, 'movement'], $rows);
    }

    /** @return array{0: string, 1: list<mixed>} */
    private function periodWhere(string $from, ?string $to, ?string $category): array
    {
        $where = 'm.movement_date >= ?';
        $binds = [$from];

        if ($to) {
            $where  .= ' AND m.movement_date < ?';
            $binds[] = $to;
        }
        if ($category) {
            $where  .= ' AND p.category = ?';
            $binds[] = $category;
        }

        return [$where, $binds];
    }

    /** Variation en % (null si pas de base de comparaison). */
    private static function trend(float|int $current, float|int $previous): ?float
    {
        if ($previous == 0) {
            return $current > 0 ? 100.0 : null;
        }

        return round(($current - $previous) / abs($previous) * 100, 1);
    }

    public function categoriesList(): array
    {
        return array_column(
            $this->db->table('products')->select('category')->distinct()
                ->where('deleted_at', null)->where('category IS NOT NULL', null, false)->where('category !=', '')
                ->orderBy('category')->get()->getResultArray(),
            'category'
        );
    }
}
