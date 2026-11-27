// Интеграционный тест WebSocket. Запускает сервер на отдельном порту, создаёт двух
// временных пользователей напрямую в БД, подключает их через socket.io-client,
// проверяет события и в конце удаляет за собой все данные.
// Нужны запущенные PostgreSQL и MongoDB из .env.  Запуск: npm test
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const { jwtSecret } = require('../config/env');
const connectDB = require('../db');
const mongoose = require('mongoose');
const { User, Post, ChatMessage } = require('../models');
const E = require('../realtime/events');

const PORT = 3199;
const URL = `http://localhost:${PORT}`;
const suffix = Math.random().toString(36).slice(2, 8);

let server;
const users = {};
const sockets = [];

const tokenFor = (user) => jwt.sign({ id: user.id }, jwtSecret, { algorithm: 'HS256', expiresIn: '10m' });

function connectAs(user, token = tokenFor(user)) {
  const socket = io(URL, { auth: { token }, forceNew: true, reconnection: false });
  sockets.push(socket);
  return socket;
}
const connected = (socket) =>
  new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
const nextEvent = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Не дождались события ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
const ask = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

before(async () => {
  await connectDB();
  for (const name of ['a', 'b']) {
    users[name] = await User.create({
      email: `wstest_${name}_${suffix}@example.com`,
      username: `wstest_${name}_${suffix}`,
      password: 'not-a-real-hash',
    });
  }
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Сервер не запустился')), 15000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Server running')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once('exit', () => reject(new Error('Сервер завершился при запуске')));
  });
});

after(async () => {
  sockets.forEach((s) => s.disconnect());
  if (server) server.kill();
  const ids = Object.values(users).map((u) => u.id);
  await ChatMessage.deleteMany({ $or: [{ userId: { $in: ids } }, { recipientId: { $in: ids } }] });
  await Post.deleteMany({ userId: { $in: ids } });
  await User.destroy({ where: { id: ids } });
  await mongoose.disconnect();
});

test('соединение без токена и с плохим токеном отклоняется', async () => {
  await assert.rejects(connected(connectAs(users.a, '')), (err) => err.data.code === 'AUTH_FAILED');
  await assert.rejects(connected(connectAs(users.a, 'bad.token')), (err) => err.data.code === 'AUTH_FAILED');
});

test('подключение и отключение пользователя, комнаты, сообщения, история, «печатает»', async () => {
  const a = connectAs(users.a);
  await connected(a);
  const b = connectAs(users.b);
  const online = nextEvent(a, E.USER_ONLINE);
  await connected(b);
  assert.equal((await online).user.id, users.b.id); // broadcast: A узнал о подключении B

  const joined = nextEvent(a, E.ROOM_USER_JOINED);
  assert.equal((await ask(a, E.ROOM_JOIN, { room: 'Дороги' })).ok, true);
  await ask(b, E.ROOM_JOIN, { room: 'Дороги' });
  assert.equal((await joined).user.id, users.b.id);

  const typing = nextEvent(a, E.CHAT_TYPING);
  b.emit(E.CHAT_TYPING, { room: 'Дороги', isTyping: true });
  assert.equal((await typing).username, users.b.username);

  const incoming = nextEvent(a, E.CHAT_MESSAGE);
  const ack = await ask(b, E.CHAT_MESSAGE, { room: 'Дороги', text: '  Привет, дальнобойщики!  ' });
  assert.equal(ack.ok, true);
  assert.equal((await incoming).text, 'Привет, дальнобойщики!');

  // комната, в которую не входили, пустое и слишком длинное сообщение отклоняются
  assert.equal((await ask(b, E.CHAT_MESSAGE, { room: 'Границы', text: 'x' })).ok, false);
  assert.equal((await ask(b, E.CHAT_MESSAGE, { room: 'Дороги', text: '   ' })).ok, false);
  assert.equal((await ask(b, E.CHAT_MESSAGE, { room: 'Дороги', text: 'я'.repeat(501) })).ok, false);

  // история приходит из MongoDB при входе в комнату
  const again = await ask(a, E.ROOM_JOIN, { room: 'Дороги' });
  assert.ok(again.history.some((m) => m.text === 'Привет, дальнобойщики!'));

  const offline = nextEvent(a, E.USER_OFFLINE);
  b.disconnect();
  assert.equal((await offline).user.id, users.b.id);
  a.disconnect();
});

test('личные сообщения доставляются получателю и попадают в историю', async () => {
  const a = connectAs(users.a);
  const b = connectAs(users.b);
  await Promise.all([connected(a), connected(b)]);

  const received = nextEvent(b, E.CHAT_PRIVATE);
  const ack = await ask(a, E.CHAT_PRIVATE, { toUserId: users.b.id, text: 'Как граница?' });
  assert.equal(ack.ok, true);
  assert.equal(ack.delivered, true);
  assert.equal((await received).text, 'Как граница?');

  assert.equal((await ask(a, E.CHAT_PRIVATE, { toUserId: users.a.id, text: 'себе' })).ok, false);
  assert.equal((await ask(a, E.CHAT_PRIVATE, { toUserId: 2147483000, text: 'никому' })).ok, false);

  const history = await ask(b, E.PRIVATE_HISTORY, { withUserId: users.a.id });
  assert.equal(history.messages.length, 1);
  const dialogs = await ask(b, E.CHAT_DIALOGS, {});
  assert.equal(dialogs.dialogs[0].id, users.a.id);
  a.disconnect();
  b.disconnect();
});

test('лимит частоты сообщений', async () => {
  const a = connectAs(users.a);
  await connected(a);
  await ask(a, E.ROOM_JOIN, { room: 'Стоянки' });
  const results = [];
  for (let i = 0; i < 12; i++) results.push(await ask(a, E.CHAT_MESSAGE, { room: 'Стоянки', text: `m${i}` }));
  assert.ok(results.some((r) => r.ok === false && r.retryAfterMs > 0));
  a.disconnect();
});

test('уведомления форума приходят по WebSocket после REST-запросов', async () => {
  const b = connectAs(users.b);
  await connected(b);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(users.a)}` };

  const created = nextEvent(b, E.POST_CREATED);
  const res = await fetch(`${URL}/api/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Тест WebSocket', content: 'Текст поста' }),
  });
  const post = await res.json();
  assert.equal((await created).id, post.id);

  const commented = nextEvent(b, E.COMMENT_ADDED);
  const withComment = await (
    await fetch(`${URL}/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Комментарий' }),
    })
  ).json();
  const event = await commented;
  assert.equal(event.comment.text, 'Комментарий');

  const liked = nextEvent(b, E.COMMENT_LIKED);
  await fetch(`${URL}/api/posts/${post.id}/comments/${withComment.comments[0].id}/like`, { method: 'PUT', headers });
  assert.equal((await liked).likes, 1);
});

test('слишком большой пакет закрывает соединение', async () => {
  const a = connectAs(users.a);
  await connected(a);
  const closed = new Promise((resolve) => a.once('disconnect', resolve));
  a.emit(E.CHAT_MESSAGE, { room: 'Общее', text: 'x'.repeat(20000) });
  await closed;
});
