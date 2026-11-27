import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || new URL(apiUrl, window.location.href).origin;

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

export function connect(token, onAuthLost) {
  disconnect();
  const socket = io(SOCKET_URL, { auth: { token }, forceNew: true, reconnectionDelayMax: 5000 });
  const isCurrent = () => state.socket === socket;

  socket.on('connect', () => {
    if (isCurrent()) setState({ status: 'online' });
  });

  socket.on('disconnect', (reason) => {
    if (!isCurrent()) return;
    setState({ status: 'reconnecting' });

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
