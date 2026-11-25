// Проверки входных данных регистрации. Возвращают текст ошибки или null.

const EMAIL_MAX_LENGTH = 254; // предел по RFC 5321; столбец в БД — VARCHAR(255)
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt молча отбрасывает всё, что дальше 72 байт
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (email.length > EMAIL_MAX_LENGTH) {
    return `Email слишком длинный (максимум ${EMAIL_MAX_LENGTH} символов)`;
  }
  if (!EMAIL_RE.test(email)) {
    return 'Некорректный email';
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

module.exports = { validateEmail, validatePassword, EMAIL_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES };
