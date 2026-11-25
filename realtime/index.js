const { Server } = require('socket.io');
const { clientOrigins } = require('../config/env');
const L = require('../config/limits');
const E = require('./events');
const { Presence } = require('./presence');
const { createRateLimiter } = require('./rateLimiter');
const { createSocketAuth } = require('./auth');
const { registerChatHandlers, roomKey, publicUser } = require('./chatHandlers');
const { setRealtime } = require('./publisher');

// Подключает Socket.IO к HTTP-серверу Express. Соединение устанавливается так:
// клиент делает HTTP-запрос (handshake), сервер переключает его на WebSocket (Upgrade);
// если WebSocket недоступен, Socket.IO продолжает работать через long polling.
function initRealtime(httpServer) {
  const presence = new Presence();

  const io = new Server(httpServer, {
    // CORS для запросов long polling. Токен лежит не в cookie, а в handshake.auth,
    // поэтому чужой сайт не может подключиться от имени пользователя.
    cors: { origin: clientOrigins, methods: ['GET', 'POST'] },
    // WebSocket не подчиняется CORS, поэтому Origin проверяем сами: запросы из браузера
    // с чужого сайта отклоняются (клиенты без заголовка Origin, например скрипты, допускаются).
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || clientOrigins.includes(origin));
    },
    // Слишком большой пакет закрывает соединение
    maxHttpBufferSize: L.SOCKET_MAX_PAYLOAD_BYTES,
  });

  const limiters = {
    messageLimiter: createRateLimiter(L.CHAT_RATE),
    typingLimiter: createRateLimiter(L.TYPING_RATE),
  };

  // Без действительного токена соединение не устанавливается
  io.use(createSocketAuth(presence));

  io.on('connection', (socket) => {
    const { user } = socket.data;
    const isFirstConnection = presence.connect(socket.id, user);
    console.log(`[ws] ${user.username} подключился (${socket.id}), онлайн: ${presence.online().length}`);

    // Токен нельзя отозвать, поэтому соединение живёт не дольше токена. Клиент после
    // разрыва переподключится, получит отказ (токен истёк) и попросит войти заново.
    const MAX_TIMER_MS = 2 ** 31 - 1;
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.min(Math.max(socket.data.expiresAt - Date.now(), 0), MAX_TIMER_MS)
    );

    // socket.emit — только этому клиенту: кто сейчас онлайн
    socket.emit(E.PRESENCE_INIT, { users: presence.online() });
    // socket.broadcast.emit — всем, кроме этого клиента: «пользователь подключился».
    // Если у пользователя уже была открыта другая вкладка, повторно не сообщаем.
    if (isFirstConnection) socket.broadcast.emit(E.USER_ONLINE, { user: publicUser(user) });

    registerChatHandlers(io, socket, { presence, ...limiters });

    // К моменту события disconnect сокет уже вышел из всех комнат Socket.IO,
    // поэтому список комнат берём из presence.
    socket.on('disconnect', (reason) => {
      clearTimeout(expiryTimer);
      const { wentOffline, leftRooms } = presence.disconnect(socket.id, user.id);
      console.log(`[ws] ${user.username} отключился (${reason})`);

      for (const room of leftRooms) {
        io.to(roomKey(room)).emit(E.ROOM_USER_LEFT, { room, user: publicUser(user), disconnected: true });
      }
      // io.emit — всем подключённым клиентам
      if (wentOffline) io.emit(E.USER_OFFLINE, { user: publicUser(user) });
    });
  });

  setRealtime(io, presence);
  return io;
}

module.exports = { initRealtime };
