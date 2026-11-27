const L = require('../config/limits');

const INT32_MAX = 2147483647; // INTEGER в PostgreSQL

// Проверки данных, пришедших по сокету. Возвращают { value } или { error }.
// Как и в REST-API, слишком длинный текст отклоняется, а не обрезается молча.

function parseRoom(room) {
  if (typeof room !== 'string' || !L.CHAT_ROOMS.includes(room)) {
    return { error: `Комната должна быть одной из: ${L.CHAT_ROOMS.join(', ')}` };
  }
  return { value: room };
}

function parseChatText(text) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) return { error: 'Сообщение не может быть пустым' };
  // length, как и maxlength в схеме Mongoose, считает единицы UTF-16
  if (clean.length > L.CHAT_MESSAGE_MAX) {
    return { error: `Сообщение слишком длинное: максимум ${L.CHAT_MESSAGE_MAX} символов` };
  }
  return { value: clean };
}

// id пользователя — целое от 1 до int32 (как в PostgreSQL)
function parseUserId(value) {
  if (!Number.isInteger(value) || value < 1 || value > INT32_MAX) {
    return { error: 'Некорректный идентификатор пользователя' };
  }
  return { value };
}

module.exports = { parseRoom, parseChatText, parseUserId };
