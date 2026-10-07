# ==========================================================================
# Одноразовый образ для Coolify: статика лендинга + API формы + CycleTracker
# (menstr) в одном контейнере.
#
#   docker build -t riool-hw .
#   docker run -d -p 8080:80 -p 3000:3000 --env-file backend/.env riool-hw
#
# Coolify/Traefik проксирует трафик на порт 80 контейнера.
# Внутри: nginx (80) + форма (3000) + menstr/CycleTracker (3110).
# ==========================================================================

# ---------- Stage 1: зависимости бэкенда формы ----------
FROM node:22-alpine AS deps

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund


# ---------- Stage 2: сборка CycleTracker (menstr) ----------
FROM node:22-alpine AS menstr-build

WORKDIR /app/menstr
COPY menstr/package*.json ./
COPY menstr/backend/package*.json ./backend/
COPY menstr/frontend/package*.json ./frontend/
RUN npm --prefix backend ci --no-audit --no-fund \
 && npm --prefix frontend ci --no-audit --no-fund

COPY menstr ./
# Билдим: tsc -> backend/dist, vite -> frontend/dist
RUN npm --prefix backend run build && npm --prefix frontend run build


# ---------- Stage 3: runtime (node 22 — menstr использует node:sqlite) ----------
FROM node:22-alpine AS runtime

# nginx — раздача статики и проксирование /api на node внутри контейнера
# tini — корректная обработка сигналов от Docker
RUN apk add --no-cache nginx tini curl

# --- Файлы бэкенда формы ---
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/server.js ./server.js

# --- CycleTracker (menstr): собранный backend + node_modules + сборочный dist ---
COPY --from=menstr-build /app/menstr/backend/dist      ./menstr/backend/dist
COPY --from=menstr-build /app/menstr/backend/node_modules ./menstr/backend/node_modules
COPY --from=menstr-build /app/menstr/backend/package.json ./menstr/backend/package.json
COPY --from=menstr-build /app/menstr/frontend/dist     ./menstr/frontend/dist
RUN mkdir -p ./menstr/backend/data ./menstr/uploads

# --- Статика лендинга ---
COPY index.html portfolio.html useful.html site.webmanifest /var/www/html/
COPY css /var/www/html/css
COPY js /var/www/html/js
COPY images /var/www/html/images
COPY lendings /var/www/html/lendings

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
