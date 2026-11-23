<?php

namespace App\Filters;

use App\Libraries\Auth;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Protège les routes API.
 *
 *   'filter' => 'apiauth'        → utilisateur connecté
 *   'filter' => 'apiauth:admin'  → administrateur uniquement
 */
class ApiAuth implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');

        if (! preg_match('/^Bearer\s+(\S+)$/i', $header, $m) || ! ($resolved = Auth::resolve($m[1]))) {
            return self::deny(401, 'unauthenticated', 'Session expirée ou invalide. Merci de vous reconnecter.');
        }

        [$user, $hash] = $resolved;
        Auth::setContext($user, $hash);

        if (in_array('admin', (array) $arguments, true) && ! Auth::isAdmin()) {
            return self::deny(403, 'forbidden', 'Cette action est réservée aux administrateurs.');
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return null;
    }

    private static function deny(int $status, string $code, string $message): ResponseInterface
    {
        return service('response')
            ->setStatusCode($status)
            ->setJSON(['error' => ['status' => $status, 'code' => $code, 'message' => $message]]);
    }
}
