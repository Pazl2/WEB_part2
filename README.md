# Платформа для обмена опытом между дальнобойщиками

Лабораторная работа №6. Интеграция с NoSQL базой данных MongoDB. Ветка репозитория: `lab26`.

Сервер: Node.js + Express + JWT (с двухфакторным подтверждением входа). Две базы данных:

- **PostgreSQL (Sequelize)** — пользователи;
- **MongoDB (Mongoose)** — посты (с тегами и вложенными комментариями).
Клиент: React + Vite + axios (папка `euroTruck`): теги постов (фильтр по клику), комментарии с лайками, добавлением и удалением.

В этой ветке посты перенесены из PostgreSQL в MongoDB, а пользователи остаются в PostgreSQL (ветка `lab25` с полностью PostgreSQL остаётся без изменений).

## Требования

- Node.js 20+
- PostgreSQL (пользователи)
- MongoDB Atlas (бесплатный кластер M0) или локальный MongoDB Community Edition (посты)

## Запуск сервера

```bash
npm install
cp .env.example .env     # затем впишите MONGO_URI и данные PostgreSQL
npx sequelize-cli db:migrate   # создаёт таблицу Users в PostgreSQL
npm run seed             # (необязательно) демо-посты с тегами и комментариями в MongoDB
npm run dev
```

В `.env`:

- `MONGO_URI` — строка подключения (Atlas: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/euroTruck?...`,
  локально: `mongodb://127.0.0.1:27017/euroTruck`). Если в пароле есть спецсимволы, закодируйте их (`@` → `%40`).
  В Atlas: Network Access → добавить свой IP (или `0.0.0.0/0` для учебных целей).
- `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_DIALECT` — подключение к PostgreSQL (пользователи).
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `RESPONSE_DELAY_MS` — как в предыдущих работах.

Сервер доступен по адресу `http://localhost:3000`, API — по префиксу `/api`.

## Модель данных

**PostgreSQL**, таблица `Users`: `id` (integer, автоинкремент), `email` (уникальный), `password` (bcrypt), `role`, `twoFactorCode`, `twoFactorExpires`, `createdAt`, `updatedAt`.

**MongoDB**, коллекция `posts` (документ):

```js
{
  _id, title, content, author, category,
  tags: ['граница', 'важный'],                       // массив строк
  comments: [{ _id, author, text, likes, createdAt }], // вложенные документы
  userId: 1,                                         // id пользователя из PostgreSQL (Users.id)
  createdAt, updatedAt
}
```

Между базами нет внешнего ключа, поэтому связь `posts.userId → Users.id` поддерживается в коде:

- при выдаче постов `email` автора подтягивается одним запросом к PostgreSQL (аналог `populate`) и добавляется в ответ как `user: { id, email }`;
- при удалении пользователя (`DELETE /api/users/:id`) его посты в MongoDB удаляются вручную; удаление пользователя выполняется в транзакции PostgreSQL, и если удаление постов не удалось, транзакция откатывается.

В реляционной версии комментарии и теги потребовали бы отдельных таблиц и JOIN; здесь это один документ.

## Эндпоинты API

| Метод | URL | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/posts?search=текст&tag=важный` | открытый | Список постов, поиск по заголовку/тексту/автору, фильтр по тегу |
| GET | `/api/posts/:id` | открытый | Один пост (с комментариями) |
| POST | `/api/posts` | JWT | Добавление поста (`title`, `content`, `author`, `category`, `tags`) |
| PUT | `/api/posts/:id` | JWT | Редактирование поста |
| DELETE | `/api/posts/:id` | JWT | Удаление поста, в ответе — удалённый документ |
| POST | `/api/posts/:id/comments` | JWT | Добавить комментарий во вложенный массив (`{ "text": "..." }`) |
| PATCH | `/api/posts/:id/comments/:commentId/like` | JWT | Увеличить `likes` комментария внутри массива (`$inc` + `$`) |
| DELETE | `/api/posts/:id/comments/:commentId` | JWT | Удалить комментарий из массива (`$pull`) |
| DELETE | `/api/users/:id` | JWT + admin | Удалить пользователя (PostgreSQL) и каскадно все его посты (MongoDB) |
| POST | `/api/auth/register` | открытый | Регистрация |
| POST | `/api/auth/login` | открытый | Проверка пароля, генерация кода подтверждения |
| POST | `/api/auth/verify-2fa` | открытый | Проверка кода, выдача JWT-токена |
| GET | `/api/auth/me` | JWT | Данные текущего пользователя |

Чтобы получить права admin, в PostgreSQL выполните `UPDATE "Users" SET role = 'admin' WHERE email = 'ваш@email';` и заново войдите.

## Вход в приложение

1. Нажмите «Регистрация», введите email и пароль.
2. Введите те же email и пароль, нажмите «Получить код».
3. Скопируйте шестизначный код из консоли сервера (`[2FA] Код подтверждения ...`), введите его и подтвердите.
4. JWT-токен сохраняется в `localStorage` и подставляется в запросы через axios interceptor.

## Запуск клиента

```bash
cd euroTruck
npm install
cp .env.example .env
npm run dev
```

Клиент открывается по адресу `http://localhost:5173` (`VITE_API_URL=http://localhost:3000/api`).

## Что добавлено в клиент (лаб. 6)

- В форме поста — поле «Теги через запятую»; теги выводятся под текстом поста, клик по тегу фильтрует ленту (`GET /api/posts?tag=...`), фильтр сбрасывается крестиком.
- Под каждым постом — раскрывающийся блок комментариев: список, лайк (`PATCH .../like`), добавление и удаление своего комментария. Писать и лайкать могут только авторизованные пользователи.
