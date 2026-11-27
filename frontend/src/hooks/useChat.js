import { useCallback, useEffect, useReducer, useRef } from 'react';
import { EVENTS, request } from '../socket';

export const ROOMS = ['Общее', 'Границы', 'Стоянки', 'Дороги'];
const DEFAULT_ROOM = ROOMS[0];
const MAX_MESSAGES = 200; // сколько сообщений одного диалога держим в памяти
const TYPING_TTL_MS = 4000; // «печатает» гаснет само, если новых событий нет

export const roomKey = (room) => `room:${room}`;
export const pmKey = (userId) => `pm:${userId}`;
const isPm = (key) => key.startsWith('pm:');
const pmId = (key) => Number(key.slice(3));

const initialState = {
  open: false,
  room: DEFAULT_ROOM, // комната, в которой мы состоим
  active: roomKey(DEFAULT_ROOM), // что показано в окне: комната или личный диалог
  members: [], // участники текущей комнаты
  online: [], // все, кто сейчас в сети
  dialogs: [], // личные диалоги: [{ id, username }]
  conversations: {}, // key → сообщения
  unread: {}, // key → число непрочитанных
  typing: {}, // key → { userId: username }
  loaded: {}, // key → история диалога уже загружена
};

// Объединяет сообщения по id (история после входа в комнату + пришедшие за это время)
function merge(existing, incoming) {
  const byId = new Map();
  for (const m of [...existing, ...incoming]) byId.set(m.id, m);
  return [...byId.values()]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-MAX_MESSAGES);
}

const byUsername = (a, b) => a.username.localeCompare(b.username);
const withoutKey = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

function reducer(state, action) {
  switch (action.type) {
    case 'open':
      return { ...state, open: action.open, unread: action.open ? withoutKey(state.unread, state.active) : state.unread };
    case 'active':
      return { ...state, active: action.key, unread: withoutKey(state.unread, action.key) };
    case 'room':
      return { ...state, room: action.room, members: action.members };
    case 'online':
      return { ...state, online: action.users };
    case 'userOnline':
      return state.online.some((u) => u.id === action.user.id)
        ? state
        : { ...state, online: [...state.online, action.user].sort(byUsername) };
    case 'userOffline':
      return {
        ...state,
        online: state.online.filter((u) => u.id !== action.user.id),
        members: state.members.filter((u) => u.id !== action.user.id),
      };
    case 'memberAdd':
      return state.members.some((u) => u.id === action.user.id)
        ? state
        : { ...state, members: [...state.members, action.user].sort(byUsername) };
    case 'memberRemove':
      return { ...state, members: state.members.filter((u) => u.id !== action.user.id) };
    case 'history':
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.key]: merge(state.conversations[action.key] || [], action.messages),
        },
        loaded: { ...state.loaded, [action.key]: true },
      };
    case 'message': {
      const list = state.conversations[action.key] || [];
      if (list.some((m) => m.id === action.message.id)) return state;
      const seen = state.open && action.key === state.active;
      return {
        ...state,
        conversations: { ...state.conversations, [action.key]: merge(list, [action.message]) },
        unread:
          seen || action.own
            ? state.unread
            : { ...state.unread, [action.key]: (state.unread[action.key] || 0) + 1 },
      };
    }
    case 'system': {
      const message = {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        system: true,
        text: action.text,
        createdAt: new Date().toISOString(),
      };
      const list = state.conversations[action.key] || [];
      return { ...state, conversations: { ...state.conversations, [action.key]: merge(list, [message]) } };
    }
    case 'dialogs': {
      const known = new Map(state.dialogs.map((d) => [d.id, d]));
      for (const d of action.list) if (!known.has(d.id)) known.set(d.id, d);
      return { ...state, dialogs: [...known.values()] };
    }
    case 'dialogAdd':
      return state.dialogs.some((d) => d.id === action.id)
        ? state
        : { ...state, dialogs: [{ id: action.id, username: action.username }, ...state.dialogs] };
    case 'typing': {
      const current = { ...(state.typing[action.key] || {}) };
      if (action.on) current[action.userId] = action.username;
      else delete current[action.userId];
      return { ...state, typing: { ...state.typing, [action.key]: current } };
    }
    case 'resetLoaded': // после разрыва связи личные диалоги нужно загрузить заново
      return { ...state, loaded: {} };
    default:
      return state;
  }
}

// Вся логика чата: подписки на события сокета и действия пользователя.
export default function useChat(socket, user) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const roomRef = useRef(state.room);
  const activeRef = useRef(state.active);
  const typingTimers = useRef(new Map()); // чужие «печатает»: гасим по таймеру
  const myTyping = useRef({ on: false, last: 0, timer: null, target: null }); // наше «печатает»

  useEffect(() => {
    roomRef.current = state.room;
    activeRef.current = state.active;
  });

  const joinRoom = useCallback(
    async (room) => {
      const res = await request(socket, EVENTS.ROOM_JOIN, { room });
      if (res.ok) {
        dispatch({ type: 'history', key: roomKey(room), messages: res.history });
        dispatch({ type: 'room', room, members: res.members });
      }
      return res;
    },
    [socket]
  );

  const loadPrivate = useCallback(
    async (id) => {
      const res = await request(socket, EVENTS.PRIVATE_HISTORY, { withUserId: id });
      if (res.ok) dispatch({ type: 'history', key: pmKey(id), messages: res.messages });
      return res;
    },
    [socket]
  );

  // --- подписки на события сервера ---
  useEffect(() => {
    if (!socket) return undefined;
    const me = user.id;
    const say = (text) => dispatch({ type: 'system', key: roomKey(roomRef.current), text });

    // Выполняется при каждом (пере)подключении: заново входим в комнату и тянем диалоги
    const onConnect = async () => {
      joinRoom(roomRef.current);
      const res = await request(socket, EVENTS.CHAT_DIALOGS, {});
      if (res.ok) dispatch({ type: 'dialogs', list: res.dialogs });
      if (isPm(activeRef.current)) loadPrivate(pmId(activeRef.current));
    };

    const showTyping = (key, userId, username, on) => {
      const timerKey = `${key}|${userId}`;
      clearTimeout(typingTimers.current.get(timerKey));
      dispatch({ type: 'typing', key, userId, username, on });
      if (on) {
        const timer = setTimeout(
          () => dispatch({ type: 'typing', key, userId, username, on: false }),
          TYPING_TTL_MS
        );
        typingTimers.current.set(timerKey, timer);
      }
    };

    const handlers = {
      connect: onConnect,
      disconnect: () => dispatch({ type: 'resetLoaded' }),
      [EVENTS.PRESENCE_INIT]: ({ users }) => dispatch({ type: 'online', users }),
      [EVENTS.USER_ONLINE]: ({ user: u }) => {
        dispatch({ type: 'userOnline', user: u });
        say(`${u.username} подключился`);
      },
      [EVENTS.USER_OFFLINE]: ({ user: u }) => {
        dispatch({ type: 'userOffline', user: u });
        say(`${u.username} отключился`);
      },
      [EVENTS.ROOM_USER_JOINED]: ({ room, user: u }) => {
        if (room !== roomRef.current) return;
        dispatch({ type: 'memberAdd', user: u });
        dispatch({ type: 'system', key: roomKey(room), text: `${u.username} вошёл в комнату` });
      },
      [EVENTS.ROOM_USER_LEFT]: ({ room, user: u, disconnected }) => {
        if (room !== roomRef.current) return;
        dispatch({ type: 'memberRemove', user: u });
        // при отключении строку «отключился» уже показывает USER_OFFLINE
        if (!disconnected) dispatch({ type: 'system', key: roomKey(room), text: `${u.username} вышел из комнаты` });
      },
      [EVENTS.CHAT_MESSAGE]: (message) => {
        const key = roomKey(message.room);
        showTyping(key, message.userId, message.author, false);
        dispatch({ type: 'message', key, message, own: message.userId === me });
      },
      [EVENTS.CHAT_PRIVATE]: (message) => {
        const mine = message.userId === me;
        const peerId = mine ? message.recipientId : message.userId;
        const peerName = mine ? message.recipientName : message.author;
        dispatch({ type: 'dialogAdd', id: peerId, username: peerName });
        showTyping(pmKey(peerId), peerId, peerName, false);
        dispatch({ type: 'message', key: pmKey(peerId), message, own: mine });
      },
      [EVENTS.CHAT_TYPING]: ({ room, userId, username, isTyping }) => {
        showTyping(room ? roomKey(room) : pmKey(userId), userId, username, isTyping);
      },
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    if (socket.connected) onConnect();

    const timers = typingTimers.current;
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [socket, user.id, joinRoom, loadPrivate]);

  // --- наше «печатает» ---
  const sendTyping = useCallback(
    (target, isTyping) => {
      if (socket && socket.connected) socket.emit(EVENTS.CHAT_TYPING, { ...target, isTyping });
    },
    [socket]
  );

  const stopTyping = useCallback(() => {
    const t = myTyping.current;
    clearTimeout(t.timer);
    if (t.on) sendTyping(t.target, false);
    t.on = false;
  }, [sendTyping]);

  // Вызывается при вводе текста. Событие уходит не чаще раза в 2 с; через 3 с без ввода
  // отправляется «перестал печатать». Сами сообщения при этом не передаются.
  const notifyTyping = useCallback(() => {
    const t = myTyping.current;
    const key = activeRef.current;
    const target = isPm(key) ? { toUserId: pmId(key) } : { room: roomRef.current };
    const now = Date.now();
    if (!t.on || now - t.last > 2000) {
      sendTyping(target, true);
      t.last = now;
    }
    t.on = true;
    t.target = target;
    clearTimeout(t.timer);
    t.timer = setTimeout(stopTyping, 3000);
  }, [sendTyping, stopTyping]);

  useEffect(() => () => clearTimeout(myTyping.current.timer), []);

  // --- действия ---
  const setOpen = useCallback((open) => dispatch({ type: 'open', open }), []);

  const selectRoom = useCallback(
    async (room) => {
      stopTyping();
      if (room === roomRef.current) {
        dispatch({ type: 'active', key: roomKey(room) });
        return { ok: true };
      }
      const previous = roomRef.current;
      // Сначала входим в новую комнату, потом выходим из старой: при ошибке остаёмся где были
      const res = await joinRoom(room);
      if (!res.ok) return res;
      dispatch({ type: 'active', key: roomKey(room) });
      await request(socket, EVENTS.ROOM_LEAVE, { room: previous });
      return res;
    },
    [socket, joinRoom, stopTyping]
  );

  const openDialog = useCallback(
    (id, username) => {
      stopTyping();
      dispatch({ type: 'dialogAdd', id, username });
      dispatch({ type: 'active', key: pmKey(id) });
      if (!state.loaded[pmKey(id)]) loadPrivate(id);
    },
    [state.loaded, loadPrivate, stopTyping]
  );

  // Возвращает { ok, error?, delivered? }. Сообщение появится в списке по событию от сервера.
  const send = useCallback(
    (text) => {
      stopTyping();
      if (isPm(state.active)) {
        return request(socket, EVENTS.CHAT_PRIVATE, { toUserId: pmId(state.active), text });
      }
      return request(socket, EVENTS.CHAT_MESSAGE, { room: state.room, text });
    },
    [socket, state.active, state.room, stopTyping]
  );

  return { ...state, setOpen, selectRoom, openDialog, send, notifyTyping, stopTyping };
}
