const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { jwtSecret } = require('../config/env');

function extractToken(req) {
  const authHeader = req.headers['authorization'];
  return authHeader && authHeader.split(' ')[1];
}

// Проверяет подпись токена и подгружает пользователя из PostgreSQL.
// Права (id, email, role) берутся из БД, а не из токена: если пользователя удалили
// или сменили ему роль, это действует сразу, не дожидаясь истечения токена.
// Возвращает { user } либо { status, error }.
async function resolveUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    const error = err.name === 'TokenExpiredError' ? 'Токен истёк, войдите заново' : 'Недействительный токен';
    return { status: 401, error };
  }

  const user = await User.findByPk(decoded.id, { attributes: ['id', 'email', 'role'] });
  if (!user) {
    return { status: 401, error: 'Пользователь не найден, войдите заново' };
  }
  return { user: { id: user.id, email: user.email, role: user.role } };
}

// Обязательная авторизация. 401 — нет/просрочен/недействителен токен (клиент должен
// разлогиниться), 403 в middleware не используется: «нет прав» отвечают контроллеры.
async function authenticateToken(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const result = await resolveUser(token);
    if (!result.user) {
      return res.status(result.status).json({ error: result.error });
    }

    req.user = result.user;
    next();
  } catch (err) {
    next(err);
  }
}

// Необязательная авторизация для публичных маршрутов (нужна, чтобы отметить,
// какие комментарии лайкнул текущий пользователь). Нет токена или он плохой —
// просто считаем посетителя анонимным.
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const result = await resolveUser(token);
      if (result.user) req.user = result.user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateToken, optionalAuth };
