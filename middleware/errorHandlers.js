const { writeLog } = require('../utils/logger');

// запросы к JSON API по-прежнему получают ошибки в формате JSON
function isApiRequest(req) {
  return req.originalUrl.startsWith('/posts') || req.originalUrl.startsWith('/auth');
}

// 404: рендерит страницу 404.ejs
function notFoundHandler(req, res, next) {
  if (isApiRequest(req)) {
    return res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
  }
  res.status(404).render('404', { title: 'Страница не найдена', url: req.originalUrl });
}

// 500: логирует ошибку в консоль и файл, рендерит страницу 500.ejs
function serverErrorHandler(err, req, res, next) {
  writeLog('ERROR', `${req.method} ${req.originalUrl} ${err.stack || err}`);
  if (res.headersSent) {
    return next(err);
  }
  if (isApiRequest(req)) {
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
  res.status(500).render('500', { title: 'Ошибка сервера' });
}

module.exports = { notFoundHandler, serverErrorHandler };
