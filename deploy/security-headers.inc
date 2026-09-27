# Заголовки безопасности. Подключается через include в каждом блоке location,
# который использует add_header: в nginx директивы add_header не наследуются
# вниз, если выше уровнем они уже заданы.
#
# Файл монтируется в /etc/nginx/snippets/security-headers.inc
# Расширение .inc — чтобы nginx не подхватил его как конфиг на уровне http.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), interest-cohort=()" always;
