import { io } from 'socket.io-client';

// Адрес сервера Socket.IO: тот же сервер, что и у REST-API (VITE_API_URL без префикса /api).
// При необходимости можно задать отдельно через VITE_SOCKET_URL.
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || new URL(apiUrl, window.location.href).origin;

// Названия событий (тот же список, что в realtime/events.js на сервере)
export const EVENTS = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  CHAT_MESSAGE: 'chat:message',
  CHAT_PRIVATE: 'chat:private',
  CHAT_TYPING: 'chat:typing',
  PRIVATE_HISTORY: 'private:history',
  CHAT_DIALOGS: 'chat:dialogs',
  PRESENCE_INIT: 'presence:init',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  ROOM_USER_JOINED: 'room:user-joined',
  ROOM_USER_LEFT: 'room:user-left',
};

const ACK_TIMEOUT_MS = 5000;

// Небольшое внешнее хранилище: одно соединение на всё приложение. Компоненты читают его
// через useSyncExternalStore (см. hooks/useSocket.js), поэтому им не нужен setState в эффектах.
// status: connecting | online | reconnecting | offline
let state = { socket: null, status: 'offline' };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getState = () => state;

export function disconnect() {
  const { socket } = state;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  setState({ socket: null, status: 'offline' });
}

// Подключение с токеном в handshake.auth. onAuthLost вызывается, если сервер отказал
// из-за токена (просрочен, пользователь удалён): нужно выйти из аккаунта.
export function connect(token, onAuthLost) {
  disconnect();
  // forceNew: у каждого подключения свой Manager. Иначе при смене пользователя
  // Socket.IO вернул бы старый сокет со старым токеном.
  const socket = io(SOCKET_URL, { auth: { token }, forceNew: true, reconnectionDelayMax: 5000 });
  const isCurrent = () => state.socket === socket;

  socket.on('connect', () => {
    if (isCurrent()) setState({ status: 'online' });
  });

  socket.on('disconnect', (reason) => {
    if (!isCurrent()) return;
    setState({ status: 'reconnecting' });
    // Если сервер сам закрыл соединение (истёк токен, удалён аккаунт), клиент
    // автоматически не переподключается. Пробуем вручную: при плохом токене сервер
    // ответит AUTH_FAILED, и мы выйдем из аккаунта.
    if (reason === 'io server disconnect') {
      setTimeout(() => isCurrent() && socket.connect(), 1000);
    }
  });

  socket.on('connect_error', (err) => {
    if (!isCurrent()) return;
    const code = err.data && err.data.code;
    if (code === 'AUTH_FAILED') onAuthLost();
    else if (code === 'TOO_MANY_CONNECTIONS') setState({ status: 'offline' });
    else setState({ status: 'reconnecting' }); // сервер недоступен: Socket.IO будет пробовать снова
  });

  setState({ socket, status: 'connecting' });
}

// Запрос с подтверждением (acknowledgement) и таймаутом. Всегда возвращает { ok, ... }.
export function request(socket, event, payload) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ ok: false, error: 'Нет соединения с сервером' });
      return;
    }
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, response) => {
      resolve(err ? { ok: false, error: 'Сервер не ответил. Попробуйте ещё раз' } : response);
    });
  });
}
