const E = require('./events');
const L = require('../config/limits');
const { User, ChatMessage } = require('../models');
const { parseRoom, parseChatText, parseUserId } = require('./validation');

// Имя Socket.IO-комнаты для комнаты чата. Префикс нужен, чтобы название комнаты
// не совпало с id какого-нибудь соединения: у каждого сокета есть своя комната с его id.
const roomKey = (room) => `room:${room}`;

const publicUser = ({ id, username }) => ({ id, username });
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

// Что уходит клиентам: только нужные поля (внутренних вроде __v нет)
function serializeMessage(doc) {
  const message = {
    id: String(doc._id),
    userId: doc.userId,
    author: doc.author,
    text: doc.text,
    createdAt: doc.createdAt,
  };
  if (doc.room) message.room = doc.room;
  if (doc.recipientId != null) {
    message.recipientId = doc.recipientId;
    message.recipientName = doc.recipientName;
  }
  return message;
}

// Обработчики чата одного соединения: комнаты, сообщения, личные сообщения, «печатает».
// Запросы с подтверждением (acknowledgement) принимают последним аргументом функцию
// и отвечают через неё { ok: true, ... } или { ok: false, error }.
function registerChatHandlers(io, socket, { presence, messageLimiter, typingLimiter }) {
  const user = socket.data.user;

  // Единая обёртка: проверяет, что пришёл объект, ловит ошибки и всегда отвечает на ack,
  // чтобы клиент не ждал ответа до таймаута.
  function onRequest(event, handler) {
    socket.on(event, async (payload, ack) => {
      if (typeof payload === 'function') {
        ack = payload; // клиент вызвал emit(event, callback) без данных
        payload = {};
      }
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          return reply(fail('Некорректные данные'));
        }
        reply(await handler(payload));
      } catch (err) {
        console.error(`[ws] ошибка в обработчике ${event}:`, err);
        reply(fail('Внутренняя ошибка сервера'));
      }
    });
  }

  // Лимит считается по пользователю: все его вкладки делят одну квоту.
  // Возвращает готовый ответ с ошибкой, если лимит исчерпан, иначе null.
  function checkMessageRate() {
    const { allowed, retryAfterMs } = messageLimiter.consume(`user:${user.id}`);
    if (allowed) return null;
    const seconds = Math.ceil(retryAfterMs / 1000);
    return fail(`Слишком много сообщений. Подождите ${seconds} с`, { retryAfterMs });
  }

  // --- вход в комнату ---------------------------------------------------------
  // Ответ содержит последние сообщения комнаты из MongoDB и список участников.
  onRequest(E.ROOM_JOIN, async ({ room: rawRoom }) => {
    const parsed = parseRoom(rawRoom);
    if (parsed.error) return fail(parsed.error);
    const room = parsed.value;
    const key = roomKey(room);

    if (!socket.rooms.has(key)) {
      await socket.join(key);
      // Остальным в комнате сообщаем только если пользователь пришёл не из другой вкладки
      if (presence.join(socket.id, user.id, room)) {
        socket.to(key).emit(E.ROOM_USER_JOINED, { room, user: publicUser(user) });
      }
    }

    const history = await ChatMessage.roomHistory(room);
    return { ok: true, room, history: history.map(serializeMessage), members: presence.members(room) };
  });

  // --- выход из комнаты -------------------------------------------------------
  onRequest(E.ROOM_LEAVE, async ({ room: rawRoom }) => {
    const parsed = parseRoom(rawRoom);
    if (parsed.error) return fail(parsed.error);
    const room = parsed.value;
    const key = roomKey(room);

    if (socket.rooms.has(key)) {
      await socket.leave(key);
      if (presence.leave(socket.id, user.id, room)) {
        socket.to(key).emit(E.ROOM_USER_LEFT, { room, user: publicUser(user), disconnected: false });
      }
    }
    return { ok: true };
  });

  // --- сообщение в комнату ----------------------------------------------------
  // Сообщение сохраняется в MongoDB, затем уходит ВСЕМ в комнате, включая отправителя:
  // так у всех одинаковый порядок и серверное время, а клиент не рисует «предположительное»
  // сообщение. Ответом на ack отправитель узнаёт, что сервер сообщение принял.
  onRequest(E.CHAT_MESSAGE, async ({ room: rawRoom, text: rawText }) => {
    const limited = checkMessageRate();
    if (limited) return limited;

    const parsedRoom = parseRoom(rawRoom);
    if (parsedRoom.error) return fail(parsedRoom.error);
    const parsedText = parseChatText(rawText);
    if (parsedText.error) return fail(parsedText.error);

    const room = parsedRoom.value;
    const key = roomKey(room);
    // Писать можно только в ту комнату, в которую вошло это соединение
    if (!socket.rooms.has(key)) return fail('Сначала войдите в комнату');

    const doc = await ChatMessage.create({
      room,
      userId: user.id,
      author: user.username, // автор берётся из учётной записи, а не из запроса
      text: parsedText.value,
    });
    const message = serializeMessage(doc);
    io.to(key).emit(E.CHAT_MESSAGE, message);
    return { ok: true, message };
  });

  // --- личное сообщение -------------------------------------------------------
  // Адресуем по socket.id: у каждого соединения есть своя комната с таким именем,
  // поэтому io.to(socketId) доставляет сообщение ровно в это соединение. Пользователь
  // может быть открыт в нескольких вкладках, поэтому доставляем во все его соединения
  // (и во все соединения отправителя, чтобы его вкладки показывали одно и то же).
  onRequest(E.CHAT_PRIVATE, async ({ toUserId, text: rawText }) => {
    const limited = checkMessageRate();
    if (limited) return limited;

    const parsedId = parseUserId(toUserId);
    if (parsedId.error) return fail(parsedId.error);
    if (parsedId.value === user.id) return fail('Нельзя написать самому себе');
    const parsedText = parseChatText(rawText);
    if (parsedText.error) return fail(parsedText.error);

    // Получатель мог быть не в сети, поэтому проверяем его по базе, а не по presence
    const recipient = await User.findByPk(parsedId.value, { attributes: ['id', 'username'] });
    if (!recipient) return fail('Пользователь не найден');

    const doc = await ChatMessage.create({
      userId: user.id,
      author: user.username,
      recipientId: recipient.id,
      recipientName: recipient.username,
      text: parsedText.value,
    });
    const message = serializeMessage(doc);

    const recipientSockets = presence.socketIds(recipient.id);
    for (const socketId of new Set([...recipientSockets, ...presence.socketIds(user.id)])) {
      io.to(socketId).emit(E.CHAT_PRIVATE, message);
    }
    // delivered: false — получатель не в сети, увидит сообщение в истории диалога
    return { ok: true, message, delivered: recipientSockets.length > 0 };
  });

  // --- история личной переписки и список диалогов -----------------------------
  // Сервер отдаёт только переписку самого пользователя: id собеседника берётся из запроса,
  // а id пользователя — из проверенной учётной записи.
  onRequest(E.PRIVATE_HISTORY, async ({ withUserId }) => {
    const parsedId = parseUserId(withUserId);
    if (parsedId.error) return fail(parsedId.error);
    const messages = await ChatMessage.privateHistory(user.id, parsedId.value);
    return { ok: true, messages: messages.map(serializeMessage) };
  });

  onRequest(E.CHAT_DIALOGS, async () => {
    const dialogs = await ChatMessage.dialogsOf(user.id);
    return { ok: true, dialogs: dialogs.map((d) => ({ id: d.userId, username: d.username })) };
  });

  // --- «печатает» -------------------------------------------------------------
  // Не сохраняется и без ack. Отправляется как volatile: событие устаревает за секунды,
  // поэтому если соединение получателя сейчас занято (медленная сеть), пакет можно
  // потерять, и в очередь на отправку он не встаёт. Так «печатает» не создаёт
  // нагрузку на медленных клиентах (backpressure).
  socket.on(E.CHAT_TYPING, (payload) => {
    if (payload === null || typeof payload !== 'object') return;
    if (!typingLimiter.consume(`user:${user.id}`).allowed) return; // лишнее молча отбрасываем

    const event = { userId: user.id, username: user.username, isTyping: payload.isTyping === true };

    if (payload.toUserId !== undefined) {
      const parsedId = parseUserId(payload.toUserId);
      if (parsedId.error || parsedId.value === user.id) return;
      for (const socketId of presence.socketIds(parsedId.value)) {
        io.to(socketId).volatile.emit(E.CHAT_TYPING, event);
      }
      return;
    }

    const parsedRoom = parseRoom(payload.room);
    if (parsedRoom.error) return;
    const key = roomKey(parsedRoom.value);
    if (!socket.rooms.has(key)) return;
    // socket.to(...) — всем в комнате, кроме самого отправителя
    socket.to(key).volatile.emit(E.CHAT_TYPING, { ...event, room: parsedRoom.value });
  });
}

module.exports = { registerChatHandlers, roomKey, publicUser, serializeMessage };
