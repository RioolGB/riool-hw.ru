# ==========================================================================
# Backend формы обратной связи riool-hw.ru
# Соберите:  docker build -t riool-backend ./backend
# Запустите: docker run --env-file ./backend/.env -p 3000:3000 riool-backend
# ==========================================================================

FROM node:20-alpine

# Устанавливаем tini для корректной обработки сигналов (SIGTERM от Docker)
RUN apk add --no-cache tini

WORKDIR /app

# Сначала манифест — чтобы слой с зависимостями кэшировался отдельно от кода
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./

# Запускаем от непривилегированного пользователя (уже есть в образе node)
USER node

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
