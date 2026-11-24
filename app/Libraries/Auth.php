<?php

namespace App\Libraries;

use CodeIgniter\I18n\Time;

/**
 * Authentification par jeton "Bearer".
 *
 * Le jeton en clair n'est jamais stocké : seule son empreinte SHA-256 l'est.
 * Le contexte de la requête courante (utilisateur + jeton) est conservé ici
 * par le filtre ApiAuth.
 */
final class Auth
{
    public const SESSION_DAYS  = 1;
    public const REMEMBER_DAYS = 30;

    private static ?array $user       = null;
    private static ?string $tokenHash = null;

    public static function user(): ?array
    {
        return self::$user;
    }

    public static function id(): ?int
    {
        return self::$user ? (int) self::$user['id'] : null;
    }

    public static function isAdmin(): bool
    {
        return (self::$user['role'] ?? null) === 'admin';
    }

    /** Compte de démonstration aux identifiants publics (protégé). */
    public static function isDemo(?array $user = null): bool
    {
        $user ??= self::$user;

        return (bool) ($user['is_demo'] ?? false);
    }

    /**
     * L'utilisateur courant agit depuis le « bac à sable » de démo
     * (compte de démo ou compte créé depuis un compte de démo) :
     * il ne voit et ne gère que les comptes du bac à sable.
     */
    public static function inDemoSandbox(): bool
    {
        return self::isDemo() || (bool) (self::$user['demo_sandbox'] ?? false);
    }

    /** Le compte $target est-il hors de portée de l'utilisateur courant ? */
    public static function cannotManage(array $target): bool
    {
        return self::inDemoSandbox() && ! ($target['demo_sandbox'] ?? false) && ! ($target['is_demo'] ?? false);
    }

    public static function tokenHash(): ?string
    {
        return self::$tokenHash;
    }

    public static function setContext(?array $user, ?string $tokenHash = null): void
    {
        self::$user      = $user;
        self::$tokenHash = $tokenHash;
    }

    /**
     * Crée un jeton pour l'utilisateur et renvoie [jeton en clair, date d'expiration].
     *
     * @return array{0: string, 1: string}
     */
    public static function issueToken(int $userId, ?string $userAgent, bool $remember = false): array
    {
        $plain   = bin2hex(random_bytes(32));
        $now     = Time::now();
        $expires = $now->addDays($remember ? self::REMEMBER_DAYS : self::SESSION_DAYS)->toDateTimeString();

        db_connect()->table('api_tokens')->insert([
            'user_id'      => $userId,
            'token_hash'   => hash('sha256', $plain),
            'user_agent'   => $userAgent ? mb_substr($userAgent, 0, 255) : null,
            'last_used_at' => $now->toDateTimeString(),
            'expires_at'   => $expires,
            'created_at'   => $now->toDateTimeString(),
        ]);

        // Ménage opportuniste des jetons expirés.
        db_connect()->table('api_tokens')->where('expires_at <', $now->toDateTimeString())->delete();

        return [$plain, $expires];
    }

    /**
     * Retrouve l'utilisateur actif associé à un jeton valide.
     *
     * @return array{0: array, 1: string}|null [utilisateur, empreinte]
     */
    public static function resolve(string $plain): ?array
    {
        if (! preg_match('/^[a-f0-9]{64}$/', $plain)) {
            return null;
        }

        $hash = hash('sha256', $plain);
        $now  = Time::now()->toDateTimeString();
        $db   = db_connect();

        $row = $db->table('api_tokens t')
            ->select('u.*, t.id AS token_id, t.last_used_at AS token_last_used_at')
            ->join('users u', 'u.id = t.user_id')
            ->where('t.token_hash', $hash)
            ->where('t.expires_at >', $now)
            ->where('u.is_active', 1)
            ->get()
            ->getRowArray();

        if (! $row) {
            return null;
        }

        // Évite une écriture à chaque requête.
        if (! $row['token_last_used_at'] || strtotime($row['token_last_used_at']) < time() - 60) {
            $db->table('api_tokens')->where('id', $row['token_id'])->update(['last_used_at' => $now]);
        }

        unset($row['token_id'], $row['token_last_used_at']);

        return [$row, $hash];
    }

    public static function revokeCurrent(): void
    {
        if (self::$tokenHash) {
            db_connect()->table('api_tokens')->where('token_hash', self::$tokenHash)->delete();
        }
    }

    /** Révoque toutes les sessions d'un utilisateur, sauf éventuellement la courante. */
    public static function revokeAll(int $userId, bool $keepCurrent = false): void
    {
        $builder = db_connect()->table('api_tokens')->where('user_id', $userId);
        if ($keepCurrent && self::$tokenHash) {
            $builder->where('token_hash !=', self::$tokenHash);
        }
        $builder->delete();
    }
}
