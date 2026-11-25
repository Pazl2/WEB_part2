const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, sequelize } = require('../models');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { generateCode, hashCode, codeMatches } = require('../utils/twoFactor');
const { validateEmail, validatePassword } = require('../utils/validation');

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5; // неверных вводов подряд, после чего вход по коду блокируется
const LOCK_MS = 15 * 60 * 1000;

// В БД email хранится в нижнем регистре (см. сеттер в модели User),
// поэтому при поиске приводим его к тому же виду.
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function lockedMessage(lockedUntil) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `Слишком много неверных попыток. Повторите вход через ${minutes} мин`;
}

async function register(req, res, next) {
  try {
    const { email: rawEmail, password } = req.body || {};

    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail || !password) {
      return res.status(400).json({ error: 'Поля email и password обязательны' });
    }
    const email = normalizeEmail(rawEmail);

    const problem = validateEmail(email) || validatePassword(password);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });

    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email: rawEmail, password } = req.body || {};

    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail || !password) {
      return res.status(400).json({ error: 'Поля email и password обязательны' });
    }
    const email = normalizeEmail(rawEmail);

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Блокировку показываем только после проверки пароля, чтобы по ответу
    // нельзя было узнать состояние чужого аккаунта.
    if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > new Date()) {
      return res.status(429).json({ error: lockedMessage(user.twoFactorLockedUntil) });
    }

    const code = generateCode();
    user.twoFactorCode = hashCode(user.id, code);
    user.twoFactorExpires = new Date(Date.now() + CODE_TTL_MS);
    user.twoFactorAttempts = 0;
    user.twoFactorLockedUntil = null;
    await user.save();

    console.log(`[2FA] Код подтверждения для ${user.email}: ${code}`);

    res.status(200).json({
      message: 'Пароль верный. Код подтверждения отправлен на email',
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
}

// Проверяет код и ведёт счётчик неверных попыток. Всё происходит в одной транзакции
// с блокировкой строки пользователя: иначе, отправив сотню запросов одновременно,
// можно было бы пройти мимо счётчика. Возвращает { user } или { status, error }.
function checkTwoFactorCode(email, code) {
  return sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const now = new Date();

    if (!user || !user.twoFactorCode) {
      return { status: 400, error: 'Сначала выполните вход через /auth/login' };
    }

    if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > now) {
      return { status: 429, error: lockedMessage(user.twoFactorLockedUntil) };
    }

    if (user.twoFactorExpires < now) {
      user.twoFactorCode = null;
      user.twoFactorExpires = null;
      user.twoFactorAttempts = 0;
      await user.save({ transaction });
      return { status: 400, error: 'Код истёк, запросите новый через /auth/login' };
    }

    if (!codeMatches(user.id, code, user.twoFactorCode)) {
      user.twoFactorAttempts += 1;

      if (user.twoFactorAttempts >= MAX_CODE_ATTEMPTS) {
        // Код сжигаем: чтобы попробовать снова, нужно заново ввести пароль.
        user.twoFactorCode = null;
        user.twoFactorExpires = null;
        user.twoFactorAttempts = 0;
        user.twoFactorLockedUntil = new Date(now.getTime() + LOCK_MS);
        await user.save({ transaction });
        return { status: 429, error: lockedMessage(user.twoFactorLockedUntil) };
      }

      await user.save({ transaction });
      const left = MAX_CODE_ATTEMPTS - user.twoFactorAttempts;
      return { status: 400, error: `Неверный код подтверждения. Осталось попыток: ${left}` };
    }

    // Успех: код одноразовый
    user.twoFactorCode = null;
    user.twoFactorExpires = null;
    user.twoFactorAttempts = 0;
    user.twoFactorLockedUntil = null;
    await user.save({ transaction });
    return { user };
  });
}

async function verifyTwoFactor(req, res, next) {
  try {
    const { email: rawEmail, code } = req.body || {};

    if (typeof rawEmail !== 'string' || !rawEmail || (typeof code !== 'string' && typeof code !== 'number')) {
      return res.status(400).json({ error: 'Поля email и code обязательны' });
    }
    const email = normalizeEmail(rawEmail);

    // Код неверного формата — не попытка подбора, в счётчик он не попадает
    const codeText = String(code).trim();
    if (!/^\d{6}$/.test(codeText)) {
      return res.status(400).json({ error: 'Код должен состоять из 6 цифр' });
    }

    const result = await checkTwoFactorCode(email, codeText);
    if (!result.user) {
      return res.status(result.status).json({ error: result.error });
    }
    const { user } = result;

    // В токене только id: роль и email берутся из БД при каждом запросе (authMiddleware)
    const token = jwt.sign({ id: user.id }, jwtSecret, {
      algorithm: 'HS256',
      expiresIn: jwtExpiresIn,
    });

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'role', 'createdAt'],
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, verifyTwoFactor, getMe };
