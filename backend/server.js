require('dotenv').config();

// Сначала проверяем конфигурацию: без нормального JWT_SECRET сервер не стартует
const { clientOrigins } = require('./config/env');

const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');

const connectDB = require('./db');
const { sequelize } = require('./models');
const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const { initRealtime } = require('./realtime');

const app = express();

// Если сервер стоит за reverse proxy (nginx и т.п.), укажите число прокси в TRUST_PROXY,
// иначе rate limit будет считать все запросы с одного IP
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(helmet());
// CORS только для адреса(ов) клиента из CLIENT_ORIGIN; токен передаётся в заголовке
// Authorization, а не в cookie, поэтому credentials не нужны
app.use(
  cors({
    origin: clientOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '100kb' }));

// Эндпоинт для healthcheck контейнера (docker-compose): 200, только если доступны обе базы
app.get('/health', async (req, res) => {
  const mongodb = mongoose.connection.readyState === 1;
  let postgres = true;
  try {
    await sequelize.authenticate();
  } catch {
    postgres = false;
  }
  const ok = mongodb && postgres;
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable', postgres, mongodb });
});

const responseDelay = Number(process.env.RESPONSE_DELAY_MS) || 0;
if (responseDelay > 0) {
  app.use((req, res, next) => setTimeout(next, responseDelay));
}

app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

app.use((err, req, res, next) => {
  // Ошибки разбора тела запроса (битый JSON, слишком большое тело)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Тело запроса слишком большое' });
  }
  // Ошибки Sequelize (PostgreSQL — пользователи)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map((e) => e.message).join('; ');
    return res.status(400).json({ error: message });
  }
  // Ошибки Mongoose (MongoDB — посты)
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join('; ');
    return res.status(400).json({ error: message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Некорректное значение поля ${err.path}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Express и Socket.IO работают на одном HTTP-сервере и одном порту:
// REST-запросы обрабатывает app, а соединения WebSocket — Socket.IO.
const server = http.createServer(app);
initRealtime(server);

const port = Number(process.env.PORT) || 3000;
const ip = 'localhost';

// Перед стартом проверяем подключение к обеим базам
Promise.all([
  sequelize.authenticate().then(() => console.log('PostgreSQL connected')),
  connectDB(),
])
  .then(() => {
    server.listen(port, () => console.log(`Server running on http://${ip}:${port}`));
  })
  .catch((err) => {
    console.error('Не удалось подключиться к базам данных:', err.message);
    process.exit(1);
  });
