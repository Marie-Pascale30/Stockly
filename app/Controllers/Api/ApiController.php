<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\Database\BaseBuilder;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Base de tous les contrôleurs API.
 *
 * Contrat de réponse :
 *   succès  → { "data": …, "meta": { … } }
 *   erreur  → { "error": { "status": 422, "code": "validation_failed", "message": "…", "details": { champ: message } } }
 */
abstract class ApiController extends BaseController
{
    protected const MAX_PER_PAGE = 100;

    // ------------------------------------------------------------ Réponses

    protected function ok(mixed $data = null, array $meta = [], int $status = 200): ResponseInterface
    {
        $body = ['data' => $data];
        if ($meta !== []) {
            $body['meta'] = $meta;
        }

        return $this->response->setStatusCode($status)->setJSON($body);
    }

    protected function created(mixed $data, array $meta = []): ResponseInterface
    {
        return $this->ok($data, $meta, 201);
    }

    protected function noContent(): ResponseInterface
    {
        return $this->response->setStatusCode(204)->setBody('');
    }

    protected function error(int $status, string $code, string $message, array $details = []): ResponseInterface
    {
        $error = ['status' => $status, 'code' => $code, 'message' => $message];
        if ($details !== []) {
            $error['details'] = $details;
        }

        return $this->response->setStatusCode($status)->setJSON(['error' => $error]);
    }

    protected function validationFailed(array $details, string $message = 'Certains champs sont invalides.'): ResponseInterface
    {
        return $this->error(422, 'validation_failed', $message, $details);
    }

    protected function notFound(string $message = 'Ressource introuvable.'): ResponseInterface
    {
        return $this->error(404, 'not_found', $message);
    }

    protected function conflict(string $message): ResponseInterface
    {
        return $this->error(409, 'conflict', $message);
    }

    // ------------------------------------------------------------- Entrées

    /** Corps de la requête : JSON ou formulaire, nettoyé des espaces superflus. */
    protected function payload(): array
    {
        try {
            $data = $this->request->getJSON(true);
        } catch (\Throwable) {
            $data = null;
        }

        if (! is_array($data)) {
            $data = $this->request->getPost() ?: $this->request->getRawInput() ?: [];
        }

        return array_map(static fn ($v) => is_string($v) ? trim($v) : $v, $data);
    }

    /**
     * Valide $data ; renvoie null si tout va bien, sinon la réponse 422 prête à l'emploi.
     */
    protected function check(array $data, array $rules): ?ResponseInterface
    {
        if ($this->validateData($data, $rules)) {
            return null;
        }

        return $this->validationFailed($this->validator->getErrors());
    }

    // ---------------------------------------------------------- Pagination

    /** @return array{0: int, 1: int} [page, perPage] */
    protected function pageParams(): array
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $default = $this->userSettings()['items_per_page'] ?? 10;
        $perPage = (int) ($this->request->getGet('per_page') ?? $default);

        return [$page, min(self::MAX_PER_PAGE, max(1, $perPage))];
    }

    /**
     * Exécute un builder paginé.
     *
     * @return array{0: list<array>, 1: array} [lignes, meta]
     */
    protected function paginate(BaseBuilder $builder): array
    {
        [$page, $perPage] = $this->pageParams();

        $total = (clone $builder)->countAllResults();
        $pages = max(1, (int) ceil($total / $perPage));
        $page  = min($page, $pages);
        $rows  = $builder->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();

        return [$rows, [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => $pages,
        ]];
    }

    /**
     * Tri sécurisé : ?sort=-stock (préfixe "-" = décroissant), limité à une liste blanche.
     *
     * @param array<string, string> $allowed clé publique → colonne SQL
     */
    protected function applySort(BaseBuilder $builder, array $allowed, string $default): void
    {
        $sort = (string) ($this->request->getGet('sort') ?: $default);
        $desc = str_starts_with($sort, '-');
        $key  = ltrim($sort, '-');

        if (! isset($allowed[$key])) {
            $desc = str_starts_with($default, '-');
            $key  = ltrim($default, '-');
        }

        $builder->orderBy($allowed[$key], $desc ? 'DESC' : 'ASC');
    }

    // ------------------------------------------------------- Utilisateur

    protected function userSettings(): array
    {
        static $cache = [];
        $id = Auth::id();
        if (! $id) {
            return [];
        }

        return $cache[$id] ??= (db_connect()->table('user_settings')->where('user_id', $id)->get()->getRowArray() ?? []);
    }
}
