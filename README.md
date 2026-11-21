# Платформа для обмена опытом между дальнобойщиками

Лабораторная работа №6. Интеграция с NoSQL базой данных MongoDB. Ветка репозитория: `lab26`.

Сервер: Node.js + Express + **MongoDB (Mongoose)** + JWT (с двухфакторным подтверждением входа).
Клиент: React + Vite + axios (папка `euroTruck`): теги постов (фильтр по клику), комментарии с лайками, добавлением и удалением.

В этой ветке PostgreSQL/Sequelize заменены на MongoDB/Mongoose (ветка `lab25` с PostgreSQL остаётся без изменений).

## Требования

- Node.js 20+
- MongoDB Atlas (бесплатный кластер M0) или локальный MongoDB Community Edition

## Запуск сервера

```bash
npm install
cp .env.example .env     # затем впишите MONGO_URI
npm run seed             # (необязательно) демо-посты с тегами и комментариями
npm run dev
```

В `.env`:

- `MONGO_URI` — строка подключения (Atlas: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/euroTruck?...`,
  локально: `mongodb://127.0.0.1:27017/euroTruck`). Если в пароле есть спецсимволы, закодируйте их (`@` → `%40`).
  В Atlas: Network Access → добавить свой IP (или `0.0.0.0/0` для учебных целей).
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `RESPONSE_DELAY_MS` — как в предыдущих работах.

Сервер доступен по адресу `http://localhost:3000`, API — по префиксу `/api`.

## Модель данных

Коллекция `posts` (документ):

```js
{
  _id, title, content, author, category,
  tags: ['граница', 'важный'],                       // массив строк
  comments: [{ _id, author, text, likes, createdAt }], // вложенные документы
  user: ObjectId -> users,                           // ссылка (populate)
  createdAt, updatedAt
}
```

Коллекция `users`: `email` (уникальный индекс), `password` (bcrypt), `role`, `twoFactorCode`, `twoFactorExpires`.

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
| DELETE | `/api/users/:id` | JWT + admin | Удалить пользователя и каскадно все его посты |
| POST | `/api/auth/register` | открытый | Регистрация |
| POST | `/api/auth/login` | открытый | Проверка пароля, генерация кода подтверждения |
| POST | `/api/auth/verify-2fa` | открытый | Проверка кода, выдача JWT-токена |
| GET | `/api/auth/me` | JWT | Данные текущего пользователя |

Чтобы получить права admin, в MongoDB Compass измените у пользователя поле `role` на `admin` и заново войдите.

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
