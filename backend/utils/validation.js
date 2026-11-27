const { USERNAME_MIN, USERNAME_MAX } = require('../config/limits');

// Проверки входных данных регистрации. Возвращают текст ошибки или null.

const EMAIL_MAX_LENGTH = 254; // предел по RFC 5321; столбец в БД — VARCHAR(255)
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt молча отбрасывает всё, что дальше 72 байт
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Буквы любых алфавитов (в том числе кириллица), цифры, _ и -. Символа @ нет,
// поэтому имя нельзя выдать за email.
const USERNAME_RE = /^[\p{L}\p{N}_-]+$/u;
// Имена, которыми можно выдать себя за администрацию
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'moderator', 'root', 'system', 'support',
  'админ', 'администратор', 'модератор', 'система', 'поддержка',
]);

function validateEmail(email) {
  if (email.length > EMAIL_MAX_LENGTH) {
    return `Email слишком длинный (максимум ${EMAIL_MAX_LENGTH} символов)`;
  }
  if (!EMAIL_RE.test(email)) {
    return 'Некорректный email';
  }
  return null;
}

function validateUsername(username) {
  const length = [...username].length;
  if (length < USERNAME_MIN || length > USERNAME_MAX) {
    return `Имя пользователя должно быть от ${USERNAME_MIN} до ${USERNAME_MAX} символов`;
  }
  if (!USERNAME_RE.test(username)) {
    return 'Имя пользователя может содержать только буквы, цифры, _ и -';
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return 'Это имя зарезервировано, выберите другое';
  }
  return null;
}

function validatePassword(password) {
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    return `Пароль слишком короткий: минимум ${PASSWORD_MIN_LENGTH} символов`;
  }
  if (password.trim().length === 0) {
    return 'Пароль не может состоять только из пробелов';
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `Пароль слишком длинный: максимум ${PASSWORD_MAX_BYTES} байт (кириллица занимает по 2 байта, то есть около 36 букв)`;
  }
  return null;
}

module.exports = { validateEmail, validateUsername, validatePassword, EMAIL_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES };
