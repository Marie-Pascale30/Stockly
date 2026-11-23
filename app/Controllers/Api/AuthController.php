<?php

namespace App\Controllers\Api;

use App\Libraries\Auth;
use App\Libraries\Presenter;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\I18n\Time;

class AuthController extends ApiController
{
    /** POST /auth/login  { identifier (email ou nom d'utilisateur), password, remember } */
    public function login(): ResponseInterface
    {
        if ($limited = $this->throttle('login', 8)) {
            return $limited;
        }

        $data = $this->payload();
        if ($fail = $this->check($data, [
            'identifier' => ['label' => 'Email ou identifiant', 'rules' => 'required|max_length[190]'],
            'password'   => ['label' => 'Mot de passe', 'rules' => 'required|max_length[255]'],
        ])) {
            return $fail;
        }

        $db   = db_connect();
        $user = $db->table('users')
            ->groupStart()->where('email', mb_strtolower($data['identifier']))->orWhere('username', $data['identifier'])->groupEnd()
            ->get()->getRowArray();

        // Même message dans les deux cas : on ne révèle pas quels comptes existent.
        if (! $user || ! password_verify((string) $data['password'], $user['password_hash'])) {
            return $this->error(401, 'invalid_credentials', 'Identifiants incorrects.');
        }

        if (! $user['is_active']) {
            return $this->error(403, 'account_disabled', 'Ce compte a été désactivé. Contactez un administrateur.');
        }

        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $db->table('users')->where('id', $user['id'])->update(['password_hash' => password_hash((string) $data['password'], PASSWORD_DEFAULT)]);
        }

        $now = Time::now()->toDateTimeString();
        $db->table('users')->where('id', $user['id'])->update(['last_login_at' => $now]);
        $user['last_login_at'] = $now;

        return $this->ok($this->session($user, ! empty($data['remember'])));
    }

    /** POST /auth/register  { username, email, password, password_confirm } */
    public function register(): ResponseInterface
    {
        if ($limited = $this->throttle('register', 5)) {
            return $limited;
        }

        $data = $this->payload();
        if (isset($data['email'])) {
            $data['email'] = mb_strtolower($data['email']);
        }

        if ($fail = $this->check($data, [
            'username'         => ['label' => 'Nom d\'utilisateur', 'rules' => 'required|min_length[3]|max_length[100]|regex_match[/^[\p{L}0-9._-]+$/u]|is_unique[users.username]'],
            'email'            => ['label' => 'Email', 'rules' => 'required|valid_email|max_length[190]|is_unique[users.email]'],
            'password'         => ['label' => 'Mot de passe', 'rules' => 'required|min_length[8]|max_length[255]'],
            'password_confirm' => ['label' => 'Confirmation', 'rules' => 'required|matches[password]'],
        ])) {
            return $fail;
        }

        $db  = db_connect();
        $now = Time::now()->toDateTimeString();

        $db->transStart();
        $db->table('users')->insert([
            'username'      => $data['username'],
            'email'         => $data['email'],
            'password_hash' => password_hash((string) $data['password'], PASSWORD_DEFAULT),
            'role'          => 'employee',
            'is_active'     => 1,
            'last_login_at' => $now,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
        $id = (int) $db->insertID();
        $db->table('user_settings')->insert(['user_id' => $id, 'updated_at' => $now]);
        $db->transComplete();

        $user = $db->table('users')->where('id', $id)->get()->getRowArray();

        return $this->created($this->session($user, false));
    }

    /** GET /auth/me */
    public function me(): ResponseInterface
    {
        return $this->ok([
            'user'     => Presenter::user(Auth::user()),
            'settings' => Presenter::settings($this->userSettings()),
        ]);
    }

    /** POST /auth/logout */
    public function logout(): ResponseInterface
    {
        Auth::revokeCurrent();

        return $this->noContent();
    }

    // ------------------------------------------------------------------

    private function session(array $user, bool $remember): array
    {
        [$token, $expires] = Auth::issueToken((int) $user['id'], $this->request->getUserAgent()->getAgentString(), $remember);

        $settings = db_connect()->table('user_settings')->where('user_id', $user['id'])->get()->getRowArray();

        return [
            'token'      => $token,
            'token_type' => 'Bearer',
            'expires_at' => Presenter::date($expires),
            'user'       => Presenter::user($user),
            'settings'   => Presenter::settings($settings),
        ];
    }

    /** Limite les tentatives par IP (anti force brute). */
    private function throttle(string $action, int $perMinute): ?ResponseInterface
    {
        $throttler = service('throttler');
        $key       = 'auth-' . $action . '-' . md5($this->request->getIPAddress());

        if ($throttler->check($key, $perMinute, MINUTE) === false) {
            return $this->error(429, 'too_many_attempts', sprintf(
                'Trop de tentatives. Réessayez dans %d secondes.',
                max(1, $throttler->getTokenTime())
            ))->setHeader('Retry-After', (string) max(1, $throttler->getTokenTime()));
        }

        return null;
    }
}
