# Stockly — image de démonstration (PHP 8.3 + Apache + SQLite)
# La base SQLite est créée et remplie avec les données de démo au démarrage du conteneur.
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libicu-dev \
 && docker-php-ext-install intl \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/security.conf /etc/apache2/conf-available/security.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-stockly.ini
COPY docker/entrypoint.sh /usr/local/bin/stockly-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/stockly-entrypoint && chmod +x /usr/local/bin/stockly-entrypoint

WORKDIR /var/www/html
COPY . .
RUN mkdir -p writable/database && chown -R www-data:www-data writable

ENV PORT=10000
EXPOSE 10000
CMD ["stockly-entrypoint"]
