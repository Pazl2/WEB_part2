require('dotenv').config();

const express = require('express');
const cors = require('cors');

const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');
const { sequelize } = require('./models');

const app = express();

app.use(cors());
app.use(express.json());

const responseDelay = Number(process.env.RESPONSE_DELAY_MS) || 0;
if (responseDelay > 0) {
  app.use((req, res, next) => setTimeout(next, responseDelay));
}

app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const port = Number(process.env.PORT) || 3000;
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
