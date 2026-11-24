<?php

namespace App\Controllers\Api;

use App\Libraries\Auth;
use App\Libraries\Presenter;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\I18n\Time;

/** Profil, mot de passe et préférences de l'utilisateur connecté. */
class MeController extends ApiController
{
    /** PUT /me  { username, email } */
    public function update(): ResponseInterface
    {
        if (Auth::isDemo()) {
            return $this->demoLocked();
        }

        $id   = Auth::id();
        $data = $this->payload();
        if (isset($data['email'])) {
            $data['email'] = mb_strtolower($data['email']);
        }

        if ($fail = $this->check($data, [
            'username' => ['label' => 'Nom d\'utilisateur', 'rules' => "required|min_length[3]|max_length[100]|regex_match[/^[\\p{L}0-9._-]+$/u]|is_unique[users.username,id,{$id}]"],
            'email'    => ['label' => 'Email', 'rules' => "required|valid_email|max_length[190]|is_unique[users.email,id,{$id}]"],
        ])) {
            return $fail;
        }

        $db = db_connect();
        $db->table('users')->where('id', $id)->update([
            'username'   => $data['username'],
            'email'      => $data['email'],
            'updated_at' => Time::now()->toDateTimeString(),
        ]);

        return $this->ok(Presenter::user($db->table('users')->where('id', $id)->get()->getRowArray()));
    }

    /** PUT /me/password  { current_password, password, password_confirm } — déconnecte les autres appareils. */
    public function password(): ResponseInterface
    {
        if (Auth::isDemo()) {
            return $this->demoLocked();
        }

        $data = $this->payload();

        if ($fail = $this->check($data, [
            'current_password' => ['label' => 'Mot de passe actuel', 'rules' => 'required'],
            'password'         => ['label' => 'Nouveau mot de passe', 'rules' => 'required|min_length[8]|max_length[255]|differs[current_password]'],
            'password_confirm' => ['label' => 'Confirmation', 'rules' => 'required|matches[password]'],
        ])) {
            return $fail;
        }

        if (! password_verify((string) $data['current_password'], Auth::user()['password_hash'])) {
            return $this->validationFailed(['current_password' => 'Le mot de passe actuel est incorrect.']);
        }

        db_connect()->table('users')->where('id', Auth::id())->update([
            'password_hash' => password_hash((string) $data['password'], PASSWORD_DEFAULT),
            'updated_at'    => Time::now()->toDateTimeString(),
        ]);
        Auth::revokeAll(Auth::id(), keepCurrent: true);

        return $this->ok(['message' => 'Mot de passe mis à jour. Vos autres sessions ont été déconnectées.']);
    }

    /**
     * DELETE /me  { password } — suppression définitive de son propre compte (droit à l'effacement).
     * Les mouvements saisis restent dans l'historique, sans auteur.
     */
    public function destroy(): ResponseInterface
    {
        if (Auth::isDemo()) {
            return $this->demoLocked();
        }

        $data = $this->payload();
        if ($fail = $this->check($data, [
            'password' => ['label' => 'Mot de passe', 'rules' => 'required|max_length[255]'],
        ])) {
            return $fail;
        }
        if (! password_verify((string) $data['password'], Auth::user()['password_hash'])) {
            return $this->validationFailed(['password' => 'Mot de passe incorrect.']);
        }

        $id = Auth::id();
        $db = db_connect();
        if (Auth::isAdmin() && $db->table('users')->where('role', 'admin')->where('is_active', 1)->countAllResults() <= 1) {
            return $this->conflict('Vous êtes le dernier administrateur actif : nommez-en un autre avant de supprimer votre compte.');
        }

        $db->transStart();
        $db->table('stock_movements')->where('user_id', $id)->update(['user_id' => null]);
        $db->table('api_tokens')->where('user_id', $id)->delete();
        $db->table('user_settings')->where('user_id', $id)->delete();
        $db->table('users')->where('id', $id)->delete();
        $db->transComplete();

        return $this->noContent();
    }

    /** PUT /me/settings  { theme, items_per_page, notifications, display_charts } (partiel accepté) */
    public function settings(): ResponseInterface
    {
        $data = $this->payload() + Presenter::settings($this->userSettings());
        foreach (['notifications', 'display_charts'] as $flag) {
            $data[$flag] = filter_var($data[$flag], FILTER_VALIDATE_BOOL) ? 1 : 0;
        }

        if ($fail = $this->check($data, [
            'theme'          => ['label' => 'Thème', 'rules' => 'required|in_list[light,dark,system]'],
            'items_per_page' => ['label' => 'Éléments par page', 'rules' => 'required|is_natural_no_zero|less_than_equal_to[100]'],
            'notifications'  => ['label' => 'Notifications', 'rules' => 'in_list[0,1]'],
            'display_charts' => ['label' => 'Graphiques', 'rules' => 'in_list[0,1]'],
        ])) {
            return $fail;
        }

        $row = [
            'theme'          => $data['theme'],
            'items_per_page' => (int) $data['items_per_page'],
            'notifications'  => $data['notifications'],
            'display_charts' => $data['display_charts'],
            'updated_at'     => Time::now()->toDateTimeString(),
        ];

        $db     = db_connect();
        $exists = $db->table('user_settings')->where('user_id', Auth::id())->countAllResults();
        $exists
            ? $db->table('user_settings')->where('user_id', Auth::id())->update($row)
            : $db->table('user_settings')->insert($row + ['user_id' => Auth::id()]);

        return $this->ok(Presenter::settings($row));
    }

    /** GET /me/sessions — appareils connectés. */
    public function sessions(): ResponseInterface
    {
        $rows = db_connect()->table('api_tokens')
            ->where('user_id', Auth::id())
            ->where('expires_at >', Time::now()->toDateTimeString())
            ->orderBy('last_used_at', 'DESC')
            ->get()->getResultArray();

        return $this->ok(array_map(static fn ($t) => [
            'id'           => (int) $t['id'],
            'user_agent'   => $t['user_agent'],
            'current'      => $t['token_hash'] === Auth::tokenHash(),
            'last_used_at' => Presenter::date($t['last_used_at']),
            'expires_at'   => Presenter::date($t['expires_at']),
        ], $rows));
    }

    /** DELETE /me/sessions — déconnecte tous les autres appareils. */
    public function revokeSessions(): ResponseInterface
    {
        Auth::revokeAll(Auth::id(), keepCurrent: true);

        return $this->noContent();
    }

    private function demoLocked(): ResponseInterface
    {
        return $this->error(403, 'demo_account_locked', 'Compte de démonstration : l’identifiant, l’email et le mot de passe ne peuvent pas être modifiés, et le compte ne peut pas être supprimé. Créez votre propre compte pour tester ces fonctions.');
    }
}
