require('dotenv').config();

const express = require('express');
const app = express();

const postsRouter = require('./routes/posts');
const { sequelize } = require('./models');

const authRouter = require('./routes/auth');
const pagesRouter = require('./routes/pages');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, serverErrorHandler } = require('./middleware/errorHandlers');


// настройка шаблонизатора EJS
app.set('view engine', 'ejs');
app.set('views', './views');

// логирование должно быть первым, чтобы фиксировать все запросы
app.use(requestLogger);

// для парсинга JSON
app.use(express.json());
// для парсинга данных HTML-форм
app.use(express.urlencoded({ extended: true }));
// статические файлы (CSS)
app.use(express.static('public'));

// подключение маршрутов
app.use('/posts', postsRouter);

app.use('/auth', authRouter);

// страницы, генерируемые через EJS
app.use('/', pagesRouter);

// обработчики ошибок подключаются после всех маршрутов
app.use(notFoundHandler);

app.use(serverErrorHandler);

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
