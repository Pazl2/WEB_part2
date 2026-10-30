const { writeLog, getLogStatus } = require('../utils/logger');

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

// 503: если с файлом лога что-то не так (удалён, нет прав, ошибка записи),
// сервер не принимает запросы и рендерит страницу 503.ejs
function logAvailabilityGuard(req, res, next) {
  const status = getLogStatus();
  if (status.ok) {
    return next();
  }
  // в файл писать нельзя, поэтому причина выводится только в консоль
  console.error(
    `[${new Date().toISOString()}] [ERROR] 503 ${req.method} ${req.originalUrl}: файл лога недоступен (${status.error.code || status.error.message})`
  );
  res.set('Retry-After', '30');
  if (isApiRequest(req)) {
    return res.status(503).json({ error: 'Сервис временно недоступен: проблема с файлом лога' });
  }
  res.status(503).render('503', { title: 'Сервис недоступен' });
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

module.exports = { notFoundHandler, serverErrorHandler, logAvailabilityGuard };
