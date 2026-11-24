<?php

namespace App\Controllers\Api;

use App\Libraries\Auth;
use App\Libraries\Presenter;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\I18n\Time;

/** Gestion des comptes (administrateurs uniquement, cf. Routes). */
class UsersController extends ApiController
{
    /** GET /users?q=&role= */
    public function index(): ResponseInterface
    {
        $builder = db_connect()->table('users u')
            ->select('u.*, COUNT(m.id) AS movements_count, MAX(m.movement_date) AS last_movement_at')
            ->join('stock_movements m', 'm.user_id = u.id', 'left')
            ->groupBy('u.id, u.username, u.email, u.password_hash, u.role, u.is_active, u.is_demo, u.demo_sandbox, u.last_login_at, u.created_at, u.updated_at')
            ->orderBy('u.role', 'ASC')
            ->orderBy('u.username', 'ASC');

        // Admin de démo (identifiants publics) : seuls les comptes du bac à sable de démo sont visibles,
        // jamais les comptes créés par de vrais visiteurs.
        if (Auth::inDemoSandbox()) {
            $builder->groupStart()->where('u.is_demo', 1)->orWhere('u.demo_sandbox', 1)->groupEnd();
        }

        if ($q = trim((string) $this->request->getGet('q'))) {
            $builder->groupStart()->like('u.username', $q)->orLike('u.email', $q)->groupEnd();
        }
        if (in_array($role = $this->request->getGet('role'), ['admin', 'employee'], true)) {
            $builder->where('u.role', $role);
        }

        $rows = $builder->get()->getResultArray();

        return $this->ok(array_map([Presenter::class, 'user'], $rows), [
            'total'  => count($rows),
            'admins' => count(array_filter($rows, static fn ($r) => $r['role'] === 'admin')),
            'active' => count(array_filter($rows, static fn ($r) => (bool) $r['is_active'])),
        ]);
    }

    /** POST /users  { username, email, password, role } */
    public function create(): ResponseInterface
    {
        $data = $this->payload();
        if (isset($data['email'])) {
            $data['email'] = mb_strtolower($data['email']);
        }

        if ($fail = $this->check($data, $this->rules(null, passwordRequired: true))) {
            return $fail;
        }

        $db  = db_connect();
        $now = Time::now()->toDateTimeString();

        $db->transStart();
        $db->table('users')->insert([
            'username'      => $data['username'],
            'email'         => $data['email'],
            'password_hash' => password_hash((string) $data['password'], PASSWORD_DEFAULT),
            'role'          => $data['role'],
            'is_active'     => 1,
            // Créé depuis un compte de démo : reste dans le bac à sable de démo (visible par l'admin de démo).
            'demo_sandbox'  => Auth::inDemoSandbox() ? 1 : 0,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
        $id = (int) $db->insertID();
        $db->table('user_settings')->insert(['user_id' => $id, 'updated_at' => $now]);
        $db->transComplete();

        return $this->created(Presenter::user($db->table('users')->where('id', $id)->get()->getRowArray()));
    }

    /** PUT|PATCH /users/{id}  { username, email, role, is_active, password? } */
    public function update(int $id): ResponseInterface
    {
        $db   = db_connect();
        $user = $db->table('users')->where('id', $id)->get()->getRowArray();
        if (! $user || Auth::cannotManage($user)) {
            return $this->notFound('Utilisateur introuvable.');
        }
        if (Auth::isDemo($user)) {
            return $this->demoLocked();
        }

        $data = $this->payload() + ['username' => $user['username'], 'email' => $user['email'], 'role' => $user['role'], 'is_active' => $user['is_active']];
        $data['email']     = mb_strtolower((string) $data['email']);
        $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOL) ? 1 : 0;

        if ($fail = $this->check($data, $this->rules($id, passwordRequired: false))) {
            return $fail;
        }

        // Garde-fous : on ne se rétrograde / désactive pas soi-même, et il reste toujours un admin actif.
        $losesAdmin = $user['role'] === 'admin' && ($data['role'] !== 'admin' || ! $data['is_active']);
        if ($id === Auth::id() && $losesAdmin) {
            return $this->conflict('Vous ne pouvez pas retirer vos propres droits d\'administrateur ni désactiver votre compte.');
        }
        if ($losesAdmin && $this->activeAdmins() <= 1) {
            return $this->conflict('Il doit rester au moins un administrateur actif.');
        }

        $update = [
            'username'   => $data['username'],
            'email'      => $data['email'],
            'role'       => $data['role'],
            'is_active'  => $data['is_active'],
            'updated_at' => Time::now()->toDateTimeString(),
        ];
        if (! empty($data['password'])) {
            $update['password_hash'] = password_hash((string) $data['password'], PASSWORD_DEFAULT);
        }

        $db->table('users')->where('id', $id)->update($update);

        // Compte désactivé ou mot de passe réinitialisé : on coupe ses sessions.
        if (! $data['is_active'] || ! empty($data['password'])) {
            Auth::revokeAll($id, keepCurrent: $id === Auth::id());
        }

        return $this->ok(Presenter::user($db->table('users')->where('id', $id)->get()->getRowArray()));
    }

    /** DELETE /users/{id} — ses mouvements sont conservés (auteur anonymisé). */
    public function delete(int $id): ResponseInterface
    {
        $db   = db_connect();
        $user = $db->table('users')->where('id', $id)->get()->getRowArray();
        if (! $user || Auth::cannotManage($user)) {
            return $this->notFound('Utilisateur introuvable.');
        }
        if (Auth::isDemo($user)) {
            return $this->demoLocked();
        }
        if ($id === Auth::id()) {
            return $this->conflict('Vous ne pouvez pas supprimer votre propre compte.');
        }
        if ($user['role'] === 'admin' && $user['is_active'] && $this->activeAdmins() <= 1) {
            return $this->conflict('Impossible de supprimer le dernier administrateur.');
        }

        $db->transStart();
        $db->table('stock_movements')->where('user_id', $id)->update(['user_id' => null]);
        $db->table('users')->where('id', $id)->delete();
        $db->transComplete();

        return $this->noContent();
    }

    // ------------------------------------------------------------------

    private function rules(?int $id, bool $passwordRequired): array
    {
        $ignore = $id ? ",id,{$id}" : '';

        return [
            'username' => ['label' => 'Nom d\'utilisateur', 'rules' => "required|min_length[3]|max_length[100]|regex_match[/^[\\p{L}0-9._-]+$/u]|is_unique[users.username{$ignore}]"],
            'email'    => ['label' => 'Email', 'rules' => "required|valid_email|max_length[190]|is_unique[users.email{$ignore}]"],
            'password' => ['label' => 'Mot de passe', 'rules' => ($passwordRequired ? 'required' : 'permit_empty') . '|min_length[8]|max_length[255]'],
            'role'     => ['label' => 'Rôle', 'rules' => 'required|in_list[admin,employee]'],
        ];
    }

    private function demoLocked(): ResponseInterface
    {
        return $this->error(403, 'demo_account_locked', 'Les comptes de démonstration sont protégés : ils ne peuvent être ni modifiés, ni désactivés, ni supprimés.');
    }

    private function activeAdmins(): int
    {
        return db_connect()->table('users')->where('role', 'admin')->where('is_active', 1)->countAllResults();
    }
}
