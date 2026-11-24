<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */

// Application (SPA) — tout le front est servi par cette page.
$routes->get('/', 'Home::index');

/*
 * --------------------------------------------------------------------
 * API REST v1
 * --------------------------------------------------------------------
 * Authentification : en-tête "Authorization: Bearer <token>"
 * obtenu via POST /api/v1/auth/login.
 */
$routes->group('api/v1', ['namespace' => 'App\Controllers\Api', 'filter' => 'apiheaders'], static function (RouteCollection $routes): void {
    // Public
    $routes->get('health', 'MetaController::health');
    $routes->post('auth/login', 'AuthController::login');
    $routes->post('auth/register', 'AuthController::register');

    // Utilisateur connecté
    $routes->group('', ['filter' => 'apiauth'], static function (RouteCollection $routes): void {
        $routes->get('auth/me', 'AuthController::me');
        $routes->post('auth/logout', 'AuthController::logout');

        $routes->put('me', 'MeController::update');
        $routes->delete('me', 'MeController::destroy');
        $routes->put('me/password', 'MeController::password');
        $routes->put('me/settings', 'MeController::settings');
        $routes->get('me/sessions', 'MeController::sessions');
        $routes->delete('me/sessions', 'MeController::revokeSessions');

        $routes->get('dashboard', 'DashboardController::index');
        $routes->get('stats', 'DashboardController::stats');
        $routes->get('notifications', 'DashboardController::notifications');

        $routes->get('products', 'ProductsController::index');
        $routes->get('products/categories', 'ProductsController::categories');
        $routes->get('products/export', 'ProductsController::export');
        $routes->get('products/(:num)', 'ProductsController::show/$1');
        $routes->post('products', 'ProductsController::create');
        $routes->match(['PUT', 'PATCH'], 'products/(:num)', 'ProductsController::update/$1');

        $routes->get('movements', 'MovementsController::index');
        $routes->post('movements', 'MovementsController::create');
    });

    // Administrateurs
    $routes->group('', ['filter' => 'apiauth:admin'], static function (RouteCollection $routes): void {
        $routes->delete('products/(:num)', 'ProductsController::delete/$1');

        $routes->get('users', 'UsersController::index');
        $routes->post('users', 'UsersController::create');
        $routes->match(['PUT', 'PATCH'], 'users/(:num)', 'UsersController::update/$1');
        $routes->delete('users/(:num)', 'UsersController::delete/$1');
    });

    // 404 JSON pour toute autre route de l'API
    $routes->match(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], '(:any)', 'MetaController::notFoundRoute');
});
