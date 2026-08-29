// подключение Express
const express = require('express');
const app = express();

const postsRouter = require('./routes/posts');

// для парсинга JSON
app.use(express.json());

// подключение маршрутов
app.use('/posts', postsRouter);

// обработка отсутствующего маршрута — 404
app.use((req, res, next) => {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

// глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// порт, айпи и запуск сервервака
const port = 3000;
const ip = 'localhost'
app.listen(port, () => console.log(`Server running on http://${ip}:${port}`));
