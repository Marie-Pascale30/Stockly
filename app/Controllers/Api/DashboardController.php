<?php

namespace App\Controllers\Api;

use App\Services\StatsService;
use CodeIgniter\HTTP\ResponseInterface;

class DashboardController extends ApiController
{
    /** GET /dashboard — tout le tableau de bord en un seul appel. */
    public function index(): ResponseInterface
    {
        return $this->ok((new StatsService())->dashboard());
    }

    /** GET /stats?days=7|30|90|365&category= */
    public function stats(): ResponseInterface
    {
        $days = (int) ($this->request->getGet('days') ?? 30);
        if (! in_array($days, [7, 30, 90, 365], true)) {
            return $this->validationFailed(['days' => 'La période doit valoir 7, 30, 90 ou 365 jours.']);
        }

        $category = trim((string) $this->request->getGet('category')) ?: null;

        return $this->ok((new StatsService())->stats($days, $category));
    }

    /** GET /notifications — alertes de stock (cloche de l'en-tête). */
    public function notifications(): ResponseInterface
    {
        $settings = $this->userSettings();
        if (isset($settings['notifications']) && ! $settings['notifications']) {
            return $this->ok([], ['enabled' => false]);
        }

        $alerts = (new StatsService())->critical(20);

        return $this->ok($alerts, ['enabled' => true, 'count' => count($alerts)]);
    }
}
