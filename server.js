require('dotenv').config();

const express = require('express');
const app = express();

const postsRouter = require('./routes/posts');
const { sequelize } = require('./models');

const authRouter = require('./routes/auth');


// для парсинга JSON
app.use(express.json());

// подключение маршрутов
app.use('/posts', postsRouter);

app.use('/auth', authRouter);

// обработка отсутствующего маршрута — 404
app.use((req, res, next) => {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

// глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// порт, айпи и запуск сервера
const port = 3000;
const ip = 'localhost';

sequelize
  .authenticate()
  .then(() => {
    console.log('Подключение к базе данных установлено');
    app.listen(port, () => console.log(`Server running on http://${ip}:${port}`));
  })
  .catch((err) => {
    console.error('Не удалось подключиться к базе данных:', err);
    process.exit(1);
  });
