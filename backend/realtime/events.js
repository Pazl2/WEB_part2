// Названия событий Socket.IO. Клиент хранит такой же список в euroTruck/src/socket.js.
module.exports = {
  // --- клиент → сервер ---
  ROOM_JOIN: 'room:join', //           { room }                  → ack { ok, room, history, members }
  ROOM_LEAVE: 'room:leave', //         { room }                  → ack { ok }
  CHAT_MESSAGE: 'chat:message', //     { room, text }            → ack { ok, message }
  CHAT_PRIVATE: 'chat:private', //     { toUserId, text }        → ack { ok, message, delivered }
  CHAT_TYPING: 'chat:typing', //       { room | toUserId, isTyping } (без ack)
  PRIVATE_HISTORY: 'private:history', // { withUserId }          → ack { ok, messages }
  CHAT_DIALOGS: 'chat:dialogs', //     {}                        → ack { ok, dialogs }

  // --- сервер → клиент ---
  PRESENCE_INIT: 'presence:init', //   { users }   кто сейчас онлайн (сразу после подключения)
  USER_ONLINE: 'user:online', //       { user }    пользователь подключился
  USER_OFFLINE: 'user:offline', //     { user }    пользователь отключился (закрыл последнюю вкладку)
  ROOM_USER_JOINED: 'room:user-joined', // { room, user }
  ROOM_USER_LEFT: 'room:user-left', //     { room, user, disconnected }

  // сервер → клиент, остальные события чата идут под теми же именами, что и запросы
  // (CHAT_MESSAGE, CHAT_PRIVATE, CHAT_TYPING)

  // --- уведомления форума (их рассылает REST-API после изменения данных) ---
  POST_CREATED: 'post:created',
  POST_UPDATED: 'post:updated',
  POST_DELETED: 'post:deleted',
  COMMENT_ADDED: 'comment:added',
  COMMENT_DELETED: 'comment:deleted',
  COMMENT_LIKED: 'comment:liked',
  CONTENT_REFRESH: 'content:refresh',
};
