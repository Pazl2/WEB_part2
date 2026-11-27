require('dotenv').config();

// Проверка переменных окружения при старте сервера. Если что-то настроено
// небезопасно или не задано, сервер не запускается и объясняет почему.

const MIN_SECRET_LENGTH = 32;
const MIN_SECRET_UNIQUE_CHARS = 10;
const MAX_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

// Секреты, которые лежали в публичных примерах репозитория, считаются скомпрометированными.
const KNOWN_PUBLIC_SECRETS = new Set(['pelmeshki_trebuyut_tvoi_jwt_secret']);
const PLACEHOLDER_RE = /change[-_ ]?me|your[-_ ]|example|placeholder|<.*>/i;

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };

const SECRET_HINT =
  'Сгенерируйте секрет: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"';

function readJwtSecret(env) {
  const secret = (env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error(`JWT_SECRET не задан в .env. ${SECRET_HINT}`);
  }
  if (KNOWN_PUBLIC_SECRETS.has(secret) || PLACEHOLDER_RE.test(secret)) {
    throw new Error(
      `JWT_SECRET совпадает с примером из репозитория, по нему можно подделать токен. ${SECRET_HINT}`
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET слишком короткий: нужно минимум ${MIN_SECRET_LENGTH} символов. ${SECRET_HINT}`);
  }
  if (new Set(secret).size < MIN_SECRET_UNIQUE_CHARS) {
    throw new Error(`JWT_SECRET слишком предсказуемый (мало разных символов). ${SECRET_HINT}`);
  }
  return secret;
}

// Принимает '900', '15m', '1h', '7d'. Возвращает срок в секундах.
function parseLifetime(value) {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] ? UNIT_SECONDS[match[2].toLowerCase()] : 1;
  return amount * unit;
}

function readJwtExpiresIn(env) {
  const raw = (env.JWT_EXPIRES_IN || '1h').trim();
  const seconds = parseLifetime(raw);
  if (seconds === null || seconds <= 0) {
    throw new Error(`JWT_EXPIRES_IN="${raw}" не распознан. Примеры: 15m, 1h, 12h`);
  }
  if (seconds > MAX_TOKEN_LIFETIME_SECONDS) {
    throw new Error(
      `JWT_EXPIRES_IN="${raw}" слишком большой: токен нельзя отозвать до истечения, максимум 24h`
    );
  }
  return raw;
}

// CLIENT_ORIGIN — адрес(а) фронтенда через запятую, например http://localhost:5173
function readClientOrigins(env, isProduction) {
  const raw = (env.CLIENT_ORIGIN || '').trim();
  if (!raw) {
    if (isProduction) {
      throw new Error('CLIENT_ORIGIN не задан: укажите адрес клиента, которому разрешён доступ к API (CORS)');
    }
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return raw.split(',').map((item) => {
    const origin = item.trim().replace(/\/+$/, '');
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CLIENT_ORIGIN содержит некорректный адрес: "${item.trim()}"`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(
        `CLIENT_ORIGIN: "${item.trim()}" должен быть вида http(s)://хост[:порт] без пути`
      );
    }
    return origin;
  });
}

function loadEnv(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  return {
    isProduction,
    jwtSecret: readJwtSecret(env),
    jwtExpiresIn: readJwtExpiresIn(env),
    clientOrigins: readClientOrigins(env, isProduction),
  };
}

try {
  module.exports = loadEnv();
} catch (err) {
  console.error(`Ошибка конфигурации (.env): ${err.message}`);
  process.exit(1);
}

module.exports.loadEnv = loadEnv;
