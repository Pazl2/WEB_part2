const { writeLog } = require('../utils/logger');

// логирует метод, URL и время каждого запроса
function requestLogger(req, res, next) {
  writeLog('REQUEST', `${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { requestLogger };
