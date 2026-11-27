# Платформа для обмена опытом между дальнобойщиками

Лабораторная работа №8. Контейнеризация приложения с Docker. Ветка репозитория: `28`.

## Структура репозитория

```
backend/             Node.js + Express + Socket.IO (PostgreSQL — пользователи, MongoDB — посты и чат)
frontend/            React + Vite (euroTruck); в образе раздаётся через Nginx
docker-compose.yml   backend, frontend, PostgreSQL, MongoDB (+ одноразовый сервис migrate)
.env.example         шаблон переменных окружения для docker-compose
```

Описание самого приложения (API, модель данных, запуск без Docker) — в [backend/README.md](backend/README.md).

## Запуск в Docker

Нужны Docker и Docker Compose v2.

```bash
cp .env.example .env     # впишите JWT_SECRET и пароли БД (см. комментарии в файле)
docker-compose up --build
```

Что произойдёт при запуске:

1. Поднимутся PostgreSQL (`postgres:15-alpine`) и MongoDB (`mongo:7`), дождёмся их healthcheck.
2. Сервис `migrate` применит миграции Sequelize (таблица `Users`) и завершится.
3. Запустится backend, его healthcheck опрашивает `/health` (проверяет обе БД).
4. После этого стартует frontend (Nginx).

Проверка:

- `http://localhost` — frontend (Nginx);
- `http://localhost:5000/health` — backend, ответ `{"status":"ok",...}`; API также доступно через Nginx по `http://localhost/api`;
- `docker ps` — все контейнеры в состоянии `Up`, у backend и баз `healthy`;
- (необязательно) демо-посты: `docker-compose exec backend npm run seed`.

Остановка: `docker-compose down` (данные БД сохраняются в томах `pgdata` и `mongodata`); `docker-compose down -v` удалит и тома.

## Дополнительные требования (реализовано)

- **Переменные окружения** — секреты и строки подключения берутся из `.env` (в git не попадает, шаблон — `.env.example`).
- **Healthcheck для backend** — эндпоинт `/health`, проверка в `docker-compose.yml`.
- **Healthcheck для БД** — `pg_isready` и `mongosh ping`; `depends_on` с `condition: service_healthy`.
- **Изоляция сетей** — сеть `internal` (`internal: true`) для БД, `external` для frontend; backend в обеих. Порты БД на хост не публикуются.
- **Reverse-proxy (Nginx)** — раздаёт frontend и проксирует `/api` и `/socket.io` (WebSocket) на backend (`frontend/nginx.conf`).

## Доступ к образам из Республики Беларусь

Docker Hub может быть недоступен. Чтобы собрать проект, добавьте зеркала в `/etc/docker/daemon.json` (Docker Desktop: Settings → Docker Engine) и перезапустите Docker:

```json
{
  "registry-mirrors": ["https://mirror.gcr.io", "https://dockerhub.timeweb.cloud"]
}
```

Использованные образы: `node:22-alpine`, `nginx:alpine`, `postgres:15-alpine`, `mongo:7`. При необходимости их можно скачать из альтернативных реестров (`quay.io`, `registry.gitlab.com`).

## Ветка 28

```bash
git checkout -b 28
git add -A
git commit -m "lab8: Docker, docker-compose"
git push -u origin 28
```
