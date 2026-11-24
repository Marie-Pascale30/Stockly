#!/bin/sh
# Démarrage du conteneur Stockly : configuration, base SQLite de démo, puis Apache.
set -e
cd /var/www/html

PORT="${PORT:-10000}"
APP_URL="${APP_URL:-http://localhost:${PORT}/}"
DB_FILE=/var/www/html/writable/database/stockly.db

cat > .env <<EOF
CI_ENVIRONMENT = ${CI_ENVIRONMENT:-production}
app.baseURL = '${APP_URL}'
database.default.DSN =
database.default.hostname =
database.default.username =
database.default.password =
database.default.database = ${DB_FILE}
database.default.DBDriver = SQLite3
database.default.DBPrefix =
database.default.foreignKeys = true
EOF
# Fichier de configuration : lisible par Apache/PHP (groupe www-data) mais non modifiable par lui.
chown root:www-data .env
chmod 640 .env

# Apache écoute sur le port imposé par l'hébergeur (Render : PORT)
echo "Listen ${PORT}" > /etc/apache2/ports.conf
export PORT

# ServerName d'Apache : schéma + hôte + port publics tirés de APP_URL
# (ex. https://stockly-fpaw.onrender.com/ → https://stockly-fpaw.onrender.com:443).
SERVER_URL=$(printf '%s' "$APP_URL" | sed -E 's#^(https?://[^/]+).*#\1#')
case "$SERVER_URL" in
  *://*:*) ;;
  https://*) SERVER_URL="${SERVER_URL}:443" ;;
  *) SERVER_URL="${SERVER_URL}:80" ;;
esac
export SERVER_URL

if [ ! -f "$DB_FILE" ]; then
  echo "Création de la base SQLite de démonstration…"
  su -s /bin/sh www-data -c "php spark migrate --all && php spark db:seed DemoSeeder"
fi

exec apache2-foreground
