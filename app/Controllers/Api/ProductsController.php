<?php

namespace App\Controllers\Api;

use App\Libraries\Auth;
use App\Libraries\Presenter;
use App\Services\StatsService;
use App\Services\StockService;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\I18n\Time;

class ProductsController extends ApiController
{
    private const SORTS = [
        'name'       => 'name',
        'reference'  => 'reference',
        'category'   => 'category',
        'stock'      => 'stock',
        'price'      => 'sale_price',
        'value'      => 'stock * purchase_price',
        'created_at' => 'created_at',
        'updated_at' => 'updated_at',
    ];

    /**
     * GET /products
     *   ?q=        recherche (nom, référence, fournisseur)
     *   ?category= catégorie exacte
     *   ?status=   ok | low | out | alert (low + out)
     *   ?sort=     name | -stock | value … (préfixe "-" = décroissant)
     *   ?page= &per_page=
     */
    public function index(): ResponseInterface
    {
        $builder = $this->filtered();
        $this->applySort($builder, self::SORTS, 'name');

        [$rows, $meta] = $this->paginate($builder);

        return $this->ok(array_map([Presenter::class, 'product'], $rows), $meta);
    }

    /** GET /products/{id} — fiche complète : derniers mouvements + historique du stock sur 30 jours. */
    public function show(int $id): ResponseInterface
    {
        $product = $this->findProduct($id);
        if (! $product) {
            return $this->notFound('Produit introuvable.');
        }

        $stock    = new StockService();
        $recent   = $stock->baseQuery()->where('m.product_id', $id)
            ->orderBy('m.movement_date', 'DESC')->orderBy('m.id', 'DESC')->limit(15)->get()->getResultArray();

        $data              = Presenter::product($product);
        $data['movements'] = array_map([Presenter::class, 'movement'], $recent);
        $data['history']   = $this->history($id, (int) $product['stock'], 30);
        $data['totals']    = $this->totals($id);

        return $this->ok($data);
    }

    /** POST /products */
    public function create(): ResponseInterface
    {
        $data = $this->normalize($this->payload());
        if ($fail = $this->validateProduct($data)) {
            return $fail;
        }

        $now     = Time::now()->toDateTimeString();
        $initial = max(0, (int) ($data['initial_stock'] ?? 0));
        $db      = db_connect();

        $db->table('products')->insert($this->columns($data) + [
            'stock'      => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $db->insertID();

        // Le stock initial est tracé comme un vrai mouvement d'entrée.
        if ($initial > 0) {
            (new StockService($db))->record($id, 'in', $initial, Auth::id(), 'Stock initial');
        }

        return $this->created(Presenter::product($this->findProduct($id)));
    }

    /** PUT|PATCH /products/{id} — le stock ne se modifie que via les mouvements. */
    public function update(int $id): ResponseInterface
    {
        $current = $this->findProduct($id);
        if (! $current) {
            return $this->notFound('Produit introuvable.');
        }

        // PATCH partiel : on complète avec les valeurs existantes.
        $data = $this->normalize($this->payload() + $current);
        if ($fail = $this->validateProduct($data, $id)) {
            return $fail;
        }

        db_connect()->table('products')->where('id', $id)->update($this->columns($data) + [
            'updated_at' => Time::now()->toDateTimeString(),
        ]);

        return $this->ok(Presenter::product($this->findProduct($id)));
    }

    /** DELETE /products/{id} — archivage (l'historique des mouvements est conservé). */
    public function delete(int $id): ResponseInterface
    {
        if (! $this->findProduct($id)) {
            return $this->notFound('Produit introuvable.');
        }

        db_connect()->table('products')->where('id', $id)->update(['deleted_at' => Time::now()->toDateTimeString()]);

        return $this->noContent();
    }

    /** GET /products/categories — catégories et fournisseurs existants (autocomplétion). */
    public function categories(): ResponseInterface
    {
        $suppliers = array_column(
            db_connect()->table('products')->select('supplier')->distinct()
                ->where('deleted_at', null)->where('supplier IS NOT NULL', null, false)->where('supplier !=', '')
                ->orderBy('supplier')->get()->getResultArray(),
            'supplier'
        );

        return $this->ok([
            'categories' => (new StatsService())->categoriesList(),
            'suppliers'  => $suppliers,
        ]);
    }

    /** GET /products/export — CSV compatible Excel (séparateur ;, UTF-8 BOM), mêmes filtres que la liste. */
    public function export(): ResponseInterface
    {
        $builder = $this->filtered();
        $this->applySort($builder, self::SORTS, 'name');

        $out = fopen('php://temp', 'r+b');
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['Référence', 'Nom', 'Catégorie', 'Fournisseur', 'Prix achat', 'Prix vente', 'Marge %', 'Stock', 'Stock min', 'Valeur stock', 'Statut'], ';', '"', '');

        $labels = ['ok' => 'OK', 'low' => 'Stock bas', 'out' => 'Rupture'];
        foreach ($builder->get()->getResultArray() as $row) {
            $p = Presenter::product($row);
            fputcsv($out, [
                $p['reference'], $p['name'], $p['category'], $p['supplier'],
                self::num($p['purchase_price']), self::num($p['sale_price']), self::num((float) $p['margin_rate']),
                $p['stock'], $p['stock_min'], self::num($p['stock_value']), $labels[$p['status']],
            ], ';', '"', '');
        }

        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        return $this->response
            ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->setHeader('Content-Disposition', 'attachment; filename="stockly-produits-' . date('Y-m-d') . '.csv"')
            ->setBody($csv);
    }

    // ==================================================================

    private function filtered()
    {
        $builder = db_connect()->table('products')->where('deleted_at', null);

        if ($q = trim((string) $this->request->getGet('q'))) {
            $builder->groupStart()
                ->like('name', $q)->orLike('reference', $q)->orLike('supplier', $q)->orLike('category', $q)
                ->groupEnd();
        }

        if ($category = $this->request->getGet('category')) {
            $builder->where('category', $category);
        }

        match ($this->request->getGet('status')) {
            'out'   => $builder->where('stock <=', 0),
            'low'   => $builder->where('stock >', 0)->where('stock <= stock_min', null, false),
            'alert' => $builder->where('stock <= stock_min', null, false),
            'ok'    => $builder->where('stock > stock_min', null, false),
            default => null,
        };

        return $builder;
    }

    private function findProduct(int $id): ?array
    {
        return db_connect()->table('products')->where('id', $id)->where('deleted_at', null)->get()->getRowArray();
    }

    private function normalize(array $data): array
    {
        foreach (['category', 'supplier', 'description'] as $field) {
            if (isset($data[$field]) && $data[$field] === '') {
                $data[$field] = null;
            }
        }
        if (isset($data['reference']) && is_string($data['reference'])) {
            $data['reference'] = mb_strtoupper($data['reference']);
        }

        return $data;
    }

    private function validateProduct(array $data, ?int $id = null): ?ResponseInterface
    {
        if ($fail = $this->check($data, [
            'name'           => ['label' => 'Nom', 'rules' => 'required|min_length[2]|max_length[200]'],
            'reference'      => ['label' => 'Référence', 'rules' => 'required|max_length[100]|regex_match[/^[A-Z0-9._\/-]+$/]'],
            'category'       => ['label' => 'Catégorie', 'rules' => 'permit_empty|max_length[100]'],
            'supplier'       => ['label' => 'Fournisseur', 'rules' => 'permit_empty|max_length[150]'],
            'description'    => ['label' => 'Description', 'rules' => 'permit_empty|max_length[2000]'],
            'purchase_price' => ['label' => 'Prix d\'achat', 'rules' => 'required|decimal|greater_than_equal_to[0]|less_than[100000000]'],
            'sale_price'     => ['label' => 'Prix de vente', 'rules' => 'required|decimal|greater_than_equal_to[0]|less_than[100000000]'],
            'stock_min'      => ['label' => 'Seuil d\'alerte', 'rules' => 'required|is_natural|less_than[1000000]'],
            'initial_stock'  => ['label' => 'Stock initial', 'rules' => 'permit_empty|is_natural|less_than[1000000]'],
        ])) {
            return $fail;
        }

        $duplicate = db_connect()->table('products')
            ->where('reference', $data['reference'])
            ->where('deleted_at', null)
            ->where('id !=', $id ?? 0)
            ->countAllResults();

        if ($duplicate) {
            return $this->validationFailed(['reference' => 'Cette référence est déjà utilisée par un autre produit.']);
        }

        return null;
    }

    private function columns(array $d): array
    {
        return [
            'name'           => $d['name'],
            'reference'      => $d['reference'],
            'category'       => $d['category'] ?? null,
            'supplier'       => $d['supplier'] ?? null,
            'description'    => $d['description'] ?? null,
            'purchase_price' => round((float) $d['purchase_price'], 2),
            'sale_price'     => round((float) $d['sale_price'], 2),
            'stock_min'      => (int) $d['stock_min'],
        ];
    }

    /** Reconstitue le stock de fin de journée en remontant le temps depuis le stock actuel. */
    private function history(int $id, int $currentStock, int $days): array
    {
        $from = Time::now()->subDays($days - 1)->setTime(0, 0);

        $rows = db_connect()->table('stock_movements')
            ->select('DATE(movement_date) AS day', false)
            ->select("SUM(CASE WHEN type = 'out' THEN -quantity ELSE quantity END) AS delta", false)
            ->where('product_id', $id)
            ->where('movement_date >=', $from->toDateTimeString())
            ->groupBy('DATE(movement_date)', false)
            ->get()->getResultArray();

        $deltas = array_column($rows, 'delta', 'day');
        $points = [];
        $stock  = $currentStock;

        for ($i = 0; $i < $days; $i++) {
            $day      = Time::now()->subDays($i)->format('Y-m-d');
            $points[] = ['date' => $day, 'stock' => $stock];
            $stock   -= (int) ($deltas[$day] ?? 0);
        }

        return array_reverse($points);
    }

    private function totals(int $id): array
    {
        $r = db_connect()->query(
            "SELECT COUNT(*) AS movements,
                    COALESCE(SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END), 0) AS in_units,
                    COALESCE(SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END), 0) AS out_units,
                    MAX(movement_date) AS last_movement
             FROM stock_movements WHERE product_id = ?",
            [$id]
        )->getRowArray();

        return [
            'movements'     => (int) $r['movements'],
            'in_units'      => (int) $r['in_units'],
            'out_units'     => (int) $r['out_units'],
            'last_movement' => Presenter::date($r['last_movement']),
        ];
    }

    private static function num(float $v): string
    {
        return number_format($v, 2, ',', '');
    }
}
