const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Поля email и password обязательны' });
    }

    const existing = await User.findOne({ email });
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
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Поля email и password обязательны' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const code = generateCode();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 5 * 60 * 1000);
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

async function verifyTwoFactor(req, res, next) {
  try {
    const { email, code } = req.body;

    if (typeof email !== 'string' || !email || !code) {
      return res.status(400).json({ error: 'Поля email и code обязательны' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.twoFactorCode) {
      return res.status(400).json({ error: 'Сначала выполните вход через /auth/login' });
    }

    if (user.twoFactorExpires < new Date()) {
      return res.status(400).json({ error: 'Код истёк, запросите новый через /auth/login' });
    }

    if (user.twoFactorCode !== code) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    user.twoFactorCode = null;
    user.twoFactorExpires = null;
    await user.save();

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('email role createdAt');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, verifyTwoFactor, getMe };