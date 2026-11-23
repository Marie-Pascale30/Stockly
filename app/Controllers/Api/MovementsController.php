<?php

namespace App\Controllers\Api;

use App\Libraries\Auth;
use App\Libraries\Presenter;
use App\Services\StockService;
use CodeIgniter\HTTP\ResponseInterface;
use DomainException;

class MovementsController extends ApiController
{
    /**
     * GET /movements
     *   ?type=in|out|adjust  ?product_id=  ?user_id=  ?q=
     *   ?from=YYYY-MM-DD  ?to=YYYY-MM-DD  ?page= &per_page=
     */
    public function index(): ResponseInterface
    {
        $service = new StockService();
        $builder = $service->baseQuery();
        $get     = $this->request->getGet();

        if (in_array($get['type'] ?? null, StockService::TYPES, true)) {
            $builder->where('m.type', $get['type']);
        }
        if (! empty($get['product_id'])) {
            $builder->where('m.product_id', (int) $get['product_id']);
        }
        if (! empty($get['user_id'])) {
            $builder->where('m.user_id', (int) $get['user_id']);
        }
        if ($q = trim((string) ($get['q'] ?? ''))) {
            $builder->groupStart()->like('p.name', $q)->orLike('p.reference', $q)->orLike('m.note', $q)->orLike('u.username', $q)->groupEnd();
        }
        if ($from = self::date($get['from'] ?? null)) {
            $builder->where('m.movement_date >=', $from . ' 00:00:00');
        }
        if ($to = self::date($get['to'] ?? null)) {
            $builder->where('m.movement_date <=', $to . ' 23:59:59');
        }

        $builder->orderBy('m.movement_date', 'DESC')->orderBy('m.id', 'DESC');

        [$rows, $meta] = $this->paginate($builder);

        return $this->ok(array_map([Presenter::class, 'movement'], $rows), $meta);
    }

    /**
     * POST /movements  { product_id, type: in|out|adjust, quantity, note? }
     *
     * Pour "adjust", quantity = stock réellement compté lors de l'inventaire.
     */
    public function create(): ResponseInterface
    {
        $data = $this->payload();

        if ($fail = $this->check($data, [
            'product_id' => ['label' => 'Produit', 'rules' => 'required|is_natural_no_zero'],
            'type'       => ['label' => 'Type', 'rules' => 'required|in_list[in,out,adjust]'],
            'quantity'   => ['label' => 'Quantité', 'rules' => ($data['type'] ?? '') === 'adjust'
                ? 'required|is_natural|less_than[1000000]'
                : 'required|is_natural_no_zero|less_than[1000000]'],
            'note'       => ['label' => 'Note', 'rules' => 'permit_empty|max_length[255]'],
        ])) {
            return $fail;
        }

        try {
            $result = (new StockService())->record(
                (int) $data['product_id'],
                $data['type'],
                (int) $data['quantity'],
                Auth::id(),
                $data['note'] ?? null
            );
        } catch (DomainException $e) {
            return $e->getCode() === 404
                ? $this->notFound($e->getMessage())
                : $this->error(409, $data['type'] === 'out' ? 'insufficient_stock' : 'conflict', $e->getMessage());
        }

        return $this->created($result['movement'], [
            'product' => $result['product'],
            'alert'   => $result['alert'],
        ]);
    }

    private static function date(?string $value): ?string
    {
        return $value && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }
}
