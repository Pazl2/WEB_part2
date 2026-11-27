const crypto = require('crypto');
const { jwtSecret } = require('../config/env');

// Ключ для хеширования кодов выводится из JWT_SECRET, но не равен ему.
const hmacKey = crypto.createHash('sha256').update(`2fa-code:${jwtSecret}`).digest();

// Шестизначный код из криптостойкого генератора (Math.random для этого не годится).
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

// В БД хранится не сам код, а HMAC от него. Одного SHA-256 мало: кодов всего миллион,
// и их перебрали бы за секунды, а ключа сервера у того, кто получил дамп БД, нет.
function hashCode(userId, code) {
  return crypto.createHmac('sha256', hmacKey).update(`${userId}:${code}`).digest('hex');
}

// Сравнение за постоянное время. Если в БД остался старый код открытым текстом,
// длины не совпадут и проверка просто не пройдёт.
function codeMatches(userId, code, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const actual = Buffer.from(hashCode(userId, code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { generateCode, hashCode, codeMatches };
