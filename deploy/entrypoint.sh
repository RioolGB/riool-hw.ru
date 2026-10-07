#!/bin/sh
# ==========================================================================
# Entrypoint одноразового контейнера: nginx (фон) + node (главный процесс).
# Плюс супервизор для CycleTracker (menstr) на порту 3110: если процесс
# упал — перезапускаем, чтобы поддомен не отваливался.
# Файл: deploy/entrypoint.sh
# ==========================================================================
set -e

echo "[entrypoint] nginx -> :80, node(form) -> ${PORT:-3000}, node(menstr) -> ${MENSTR_PORT:-3110}"

# nginx работает на переднем плане демона, но отдельным процессом:
# -g 'daemon off;' не даёт ему разветвиться и завершиться
nginx -g 'daemon off;' &

# Даём nginx секунду поднять сокеты, чтобы /healthcheck не мигал
sleep 1

# Супервизор CycleTracker. Менстр не является главным процессом, поэтому
# не должен ронять контейнер при редком сбое — крутим его в цикле.
while true; do
    PORT=${MENSTR_PORT:-3110} node /app/menstr/backend/dist/index.js  2>&1 &
    MENSTR_PID=$!
    echo "[entrypoint] menstr pid=$MENSTR_PID"
    wait $MENSTR_PID
    echo "[entrypoint] menstr завершился, перезапуск через 2с"
    sleep 2
done &
SUPERVISOR_PID=$!

trap 'kill $SUPERVISOR_PID 2>/dev/null || true' TERM INT

# exec — node становится главным процессом (под tini), поэтому Docker видит
# его завершение и перезапускает контейнер по restart policy
exec node /app/server.js