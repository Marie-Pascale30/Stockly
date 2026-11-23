<?php

namespace App\Controllers;

class Home extends BaseController
{
    /** Coquille de l'application monopage : le reste se passe côté client via l'API. */
    public function index(): string
    {
        return view('app');
    }
}
