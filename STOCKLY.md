# Stockly — gestion de stock (CodeIgniter 4)

Application monopage (front en JavaScript natif, sans build) qui s'appuie sur une API REST JSON.

## Démarrage

Prérequis : PHP 8.1+ avec `intl` et `mbstring` (WAMP : `C:\wamp64\bin\php\php8.3.28\php.exe`), MySQL démarré.

```bash
php spark db:create stockly        # crée la base (paramètres dans .env)
php spark migrate                  # crée les tables
php spark db:seed DemoSeeder       # données de démo : 5 comptes, 18 produits, ~850 mouvements sur 120 jours
php spark serve                    # http://localhost:8080
```

Comptes de démo (mot de passe `password`) : `admin@stockly.app` (administrateur),
`marie.dupont@entreprise.com`, `pierre.martin@…`, `sophie.bernard@…`, `luc.durand@…` (employés).

Pour passer par Apache/WAMP plutôt que `spark serve`, faites pointer le VirtualHost sur le dossier `public/`
et mettez à jour `app.baseURL` dans `.env`. Les assets et l'API utilisent des URL relatives à la page,
l'application fonctionne donc aussi dans un sous-dossier.

## Organisation

| Dossier | Rôle |
|---|---|
| `app/Controllers/Api/` | Contrôleurs REST (`ApiController` = enveloppe JSON, validation, pagination, tri) |
| `app/Services/StockService.php` | **Seul point d'écriture du stock** : mise à jour atomique et transactionnelle |
| `app/Services/StatsService.php` | Agrégats du tableau de bord et des statistiques (SQL compatible MySQL et SQLite) |
| `app/Libraries/Auth.php` | Jetons Bearer (seule l'empreinte SHA-256 est stockée), révocation |
| `app/Libraries/Presenter.php` | Sérialisation JSON typée (nombres, booléens, dates ISO 8601) |
| `app/Filters/` | `apiauth` (connexion, `apiauth:admin`), `apiheaders` |
| `app/Views/app.php` | Page unique de l'application |
| `public/assets/` | CSS (design system clair/sombre), modules JS, logo |

## API v1 — `/api/v1`

Authentification : `Authorization: Bearer <token>` (obtenu via `POST /auth/login`).

Réponses : `{ "data": …, "meta": … }` · erreurs : `{ "error": { "status", "code", "message", "details" } }`.

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État de l'API et de la base |
| POST | `/auth/login` | `{identifier, password, remember}` → jeton (24 h, 30 j avec `remember`). 8 essais/min/IP |
| POST | `/auth/register` | Inscription (rôle employé) |
| GET / POST | `/auth/me`, `/auth/logout` | Session courante / révocation du jeton |
| PUT | `/me`, `/me/password`, `/me/settings` | Profil, mot de passe (déconnecte les autres appareils), préférences |
| GET / DELETE | `/me/sessions` | Appareils connectés / déconnecter les autres |
| GET | `/dashboard` | KPI, séries 30 j, catégories, alertes, top ventes, activité |
| GET | `/stats?days=7\|30\|90\|365&category=` | Analyse détaillée comparée à la période précédente |
| GET | `/notifications` | Produits sous le seuil d'alerte |
| GET | `/products?q=&category=&status=ok\|low\|out\|alert&sort=-stock&page=&per_page=` | Catalogue paginé |
| GET | `/products/{id}` | Fiche complète + historique du stock sur 30 jours |
| POST / PUT / PATCH | `/products`, `/products/{id}` | Création (avec `initial_stock` tracé en mouvement) / modification |
| DELETE | `/products/{id}` | Archivage — **admin** (l'historique est conservé) |
| GET | `/products/categories`, `/products/export` | Autocomplétion / export CSV compatible Excel |
| GET / POST | `/movements` | Historique filtrable / `{product_id, type: in\|out\|adjust, quantity, note}` |
| GET / POST / PATCH / DELETE | `/users…` | Gestion de l'équipe — **admin** |

Règles métier : une sortie ne peut jamais rendre le stock négatif (409 `insufficient_stock`), même avec
des saisies simultanées. Un inventaire (`adjust`) prend le stock compté et enregistre l'écart signé.
Il reste toujours au moins un administrateur actif. Désactiver un compte coupe immédiatement ses sessions.

## Front

Tableau de bord animé, catalogue filtrable avec fiche produit en tiroir, saisie de mouvement avec aperçu
du stock résultant, statistiques, équipe, paramètres (thème clair / sombre / système enregistré côté serveur).

Raccourcis : `Ctrl K` ou `/` pour la palette de commandes, `N` pour un nouveau mouvement, `Échap` pour fermer.

## Déploiement (Docker / Render)

Le `Dockerfile` fournit une image PHP 8.3 + Apache autonome, avec une base **SQLite** de démonstration :
au démarrage, `docker/entrypoint.sh` génère le `.env`, crée la base, lance les migrations et `DemoSeeder`.

```bash
docker build -t stockly .
docker run -p 8080:10000 -e APP_URL=http://localhost:8080/ stockly
```

Sur Render : service web « Docker », variable `APP_URL` = URL publique du service. Le disque étant éphémère,
les données de démo sont régénérées à chaque redémarrage.