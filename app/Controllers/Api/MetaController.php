<?php

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;

class MetaController extends ApiController
{
    /** GET /health — état de l'API et de la base. */
    public function health(): ResponseInterface
    {
        try {
            db_connect()->query('SELECT 1');
            $database = 'ok';
        } catch (\Throwable) {
            $database = 'unreachable';
        }

        return $this->ok([
            'status'   => $database === 'ok' ? 'ok' : 'degraded',
            'version'  => 'v1',
            'database' => $database,
            'time'     => date(DATE_ATOM),
        ], [], $database === 'ok' ? 200 : 503);
    }

    /** Toute route /api/* inconnue. */
    public function notFoundRoute(): ResponseInterface
    {
        return $this->error(404, 'route_not_found', sprintf(
            'Aucune route %s %s.',
            $this->request->getMethod(),
            '/' . ltrim($this->request->getUri()->getPath(), '/')
        ));
    }
}
