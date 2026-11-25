const { rateLimit } = require('express-rate-limit');

// Ограничение частоты запросов по IP. Счётчики хранятся в памяти процесса
// и сбрасываются при перезапуске сервера; для одного сервера этого достаточно.
// За reverse proxy включите TRUST_PROXY (см. server.js), иначе все запросы
// будут выглядеть как приходящие с одного IP, адреса прокси.
function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true, // RateLimit-* и Retry-After в ответе
    legacyHeaders: false,
    message: { error: message },
  });
}

const MINUTE = 60 * 1000;

const registerLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 10,
  message: 'Слишком много регистраций с этого адреса. Попробуйте позже',
});

const loginLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Слишком много попыток входа. Попробуйте через 15 минут',
});

const verifyLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Слишком много попыток ввода кода. Попробуйте через 15 минут',
});

module.exports = { registerLimiter, loginLimiter, verifyLimiter };
