# Платформа для обмена опытом между дальнобойщиками

Лабораторная работа №5. Взаимодействие React-приложения с сервером. Ветка репозитория: `25`.

Сервер: Node.js + Express + PostgreSQL + Sequelize + JWT (с двухфакторным подтверждением входа).
Клиент: React + Vite + axios (папка `euroTruck`).

## Требования

- Node.js 20+
- PostgreSQL

## Запуск сервера

```bash
npm install
cp .env.example .env
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
npm run dev
```

В `.env` укажите свои данные подключения к PostgreSQL (`DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`).
Сервер доступен по адресу `http://localhost:3000`, API находится по префиксу `/api`.

Параметры в `.env`:

- `RESPONSE_DELAY_MS` — искусственная задержка ответа сервера в миллисекундах (для демонстрации состояния загрузки), `0` отключает задержку.
- `PORT` — порт сервера.

## Запуск клиента

```bash
cd euroTruck
npm install
cp .env.example .env
npm run dev
```

Клиент открывается по адресу `http://localhost:5173`.
В `euroTruck/.env` задаётся адрес API: `VITE_API_URL=http://localhost:3000/api`.

## Эндпоинты API

| Метод | URL | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/posts?search=текст` | открытый | Список постов, поиск по заголовку, тексту и автору |
| GET | `/api/posts/:id` | открытый | Один пост |
| POST | `/api/posts` | JWT | Добавление поста |
| PUT | `/api/posts/:id` | JWT | Редактирование поста |
| DELETE | `/api/posts/:id` | JWT | Удаление поста |
| POST | `/api/auth/register` | открытый | Регистрация |
| POST | `/api/auth/login` | открытый | Проверка пароля, генерация кода подтверждения |
| POST | `/api/auth/verify-2fa` | открытый | Проверка кода, выдача JWT-токена |
| GET | `/api/auth/me` | JWT | Данные текущего пользователя |

## Вход в приложение

1. Нажмите «Регистрация», введите email и пароль, нажмите «Зарегистрироваться».
2. Введите те же email и пароль, нажмите «Получить код».
3. Скопируйте шестизначный код из консоли сервера (строка `[2FA] Код подтверждения ...`), введите его и нажмите «Подтвердить».
4. JWT-токен сохраняется в `localStorage` и автоматически подставляется в запросы через axios interceptor.

## Структура клиента

- `src/api.js` — axios-клиент, interceptor с токеном, функции запросов, обработка ошибок.
- `src/components/PostList.jsx` — список постов, CRUD с оптимистичным обновлением, поиск.
- `src/components/AuthPanel.jsx` — регистрация и вход с кодом подтверждения.
- `src/components/Spinner.jsx`, `src/components/Notification.jsx` — индикатор загрузки и уведомления.
- `src/hooks/useDebounce.js` — debounce для поискового ввода.
