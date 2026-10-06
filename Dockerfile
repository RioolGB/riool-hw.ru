# ==========================================================================
# Одноразовый образ для Coolify: статика лендинга + API формы в одном контейнере
#
#   docker build -t riool-hw .
#   docker run -d -p 8080:80 -p 3000:3000 --env-file backend/.env riool-hw
#
# Coolify/Traefik проксирует трафик на порт 80 контейнера.
# ==========================================================================

# ---------- Stage 1: зависимости бэкенда ----------
FROM node:20-alpine AS deps

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund


# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime

# nginx — раздача статики и проксирование /api на node внутри контейнера
# tini — корректная обработка сигналов от Docker
RUN apk add --no-cache nginx tini curl

# --- Файлы бэкенда ---
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/server.js ./server.js

# --- Статика лендинга ---
COPY index.html portfolio.html useful.html site.webmanifest /var/www/html/
COPY css /var/www/html/css
COPY js /var/www/html/js
COPY images /var/www/html/images

# --- Конфигурация nginx для контейнера ---
# Заменяем основной nginx.conf целиком: /etc/nginx/http.d/ подключается
# внутри блока http, где директивы user/events/worker_processes запрещены
COPY deploy/nginx-container.conf /etc/nginx/nginx.conf
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /var/lib/nginx/tmp \
 && chown -R nginx:nginx /var/lib/nginx

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 80

# nginx слушает 80 (жёстко зашито в deploy/nginx-container.conf: переменные
# окружения в конфиг nginx не подставляются). Traefik проксирует на этот порт.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:80/healthz" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
