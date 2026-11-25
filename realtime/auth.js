const { resolveUser } = require('../middleware/authMiddleware');
const L = require('../config/limits');

// Ошибка для клиента. data.code клиент читает в connect_error: AUTH_FAILED означает,
// что токен недействителен и нужно войти заново, а не переподключаться.
function authError(message, code) {
  const err = new Error(message);
  err.data = { code };
  return err;
}

// Middleware Socket.IO: выполняется один раз при подключении, до события `connection`.
// Токен передаётся в handshake.auth (а не в URL, чтобы он не попадал в логи).
// Как и REST-API, пользователя берём из PostgreSQL: удалённый пользователь не подключится.
function createSocketAuth(presence) {
  return async function socketAuth(socket, next) {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (typeof token !== 'string' || !token) {
        return next(authError('Токен не предоставлен', 'AUTH_FAILED'));
      }

      const result = await resolveUser(token);
      if (!result.user) {
        return next(authError(result.error, 'AUTH_FAILED'));
      }
      if (presence.connectionCount(result.user.id) >= L.SOCKET_MAX_PER_USER) {
        return next(authError('Слишком много открытых вкладок чата', 'TOO_MANY_CONNECTIONS'));
      }

      // socket.data — место для данных соединения, доступно во всех обработчиках
      socket.data.user = result.user;
      socket.data.expiresAt = result.expiresAt;
      next();
    } catch (err) {
      console.error('[ws] ошибка авторизации:', err);
      next(authError('Ошибка сервера', 'SERVER_ERROR'));
    }
  };
}

module.exports = { createSocketAuth };
