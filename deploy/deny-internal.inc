# ==========================================================================
# Запрет доступа к внутренним файлам проекта.
#
# Фрагмент подключается через include внутри каждого server — директива
# location допустима только в контексте server.
#
# Расширение .inc (а не .conf) обязательно: nginx.conf подключает все файлы
# /etc/nginx/conf.d/*.conf на уровне http, где location запрещён.
# Файл монтируется в /etc/nginx/snippets/deny-internal.inc
#
# Про (?!\.well-known): без этого отрицательного просмотра первое правило
# перебило бы location /.well-known/acme-challenge/ и сломал бы выпуск
# сертификата Let's Encrypt.
# ==========================================================================

# Скрытые файлы и папки: /.env, /.git/, /.htaccess и т.п.
location ~ /\.(?!well-known) {
    deny all;
    access_log off;
    log_not_found off;
}

# Служебные каталоги
location ~ ^/(backend|deploy|node_modules)(/|$) {
    deny all;
    access_log off;
}

# Служебные файлы в корне
location ~ ^/(README\.md|docker-compose\.yml|docker-compose\.yaml|\.gitignore)$ {
    deny all;
    access_log off;
}
