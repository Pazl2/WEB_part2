require('dotenv').config();

const express = require('express');
const cors = require('cors');

const connectDB = require('./db');
const { sequelize } = require('./models');
const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

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

const port = Number(process.env.PORT) || 3000;
const ip = 'localhost';

// Перед стартом проверяем подключение к обеим базам
Promise.all([
  sequelize.authenticate().then(() => console.log('PostgreSQL connected')),
  connectDB(),
])
  .then(() => {
    app.listen(port, () => console.log(`Server running on http://${ip}:${port}`));
  })
  .catch((err) => {
    console.error('Не удалось подключиться к базам данных:', err.message);
    process.exit(1);
  });
