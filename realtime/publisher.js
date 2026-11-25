// Мост между REST-контроллерами и сокетами. Контроллеры вызывают, например,
// publisher.postCreated(...), а не работают с io напрямую: так их можно запускать
// и без сокет-сервера (скрипты, тесты), тогда рассылка просто ничего не делает.
//
// Все события уходят через io.emit — всем подключённым (то есть вошедшим) пользователям.
// Данные в них публичные: те же, что отдаёт открытый GET /api/posts.
const E = require('./events');

let io = null;
let presence = null;

function setRealtime(instance, presenceInstance) {
  io = instance;
  presence = presenceInstance;
}

function emit(event, payload) {
  if (!io) return;
  try {
    io.emit(event, payload);
  } catch (err) {
    // Сбой рассылки не должен ломать успешный REST-запрос
    console.error(`[ws] не удалось разослать ${event}:`, err);
  }
}

// Краткое описание поста для уведомления (без текста и комментариев)
function postInfo(post) {
  return { id: post.id, title: post.title, category: post.category, author: post.author };
}

module.exports = {
  setRealtime,

  postCreated: (post, actor) => emit(E.POST_CREATED, { ...postInfo(post), actorId: actor.id }),
  postUpdated: (post, actor) => emit(E.POST_UPDATED, { ...postInfo(post), actorId: actor.id }),
  postDeleted: (post, actor) => emit(E.POST_DELETED, { ...postInfo(post), actorId: actor.id }),

  // comment — комментарий в том виде, в котором он отдаётся клиентам (с полем id)
  commentAdded: (post, comment, actor) =>
    emit(E.COMMENT_ADDED, {
      postId: post.id,
      postTitle: post.title,
      comment: { ...comment, likedByMe: false },
      actorId: actor.id,
    }),
  commentDeleted: (postId, commentId, actor) =>
    emit(E.COMMENT_DELETED, { postId, commentId, actorId: actor.id }),
  commentLiked: (postId, commentId, likes, actor) =>
    emit(E.COMMENT_LIKED, { postId, commentId, likes, actorId: actor.id }),

  // Данные изменились массово (например, удалён пользователь с его постами): клиентам
  // проще перечитать ленту
  contentRefresh: () => emit(E.CONTENT_REFRESH, {}),

  // Закрывает все соединения пользователя (удалён аккаунт). Пока токен жив, заново
  // подключиться он тоже не сможет: при подключении пользователь проверяется по БД.
  disconnectUser(userId) {
    if (!io || !presence) return;
    for (const socketId of presence.socketIds(userId)) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.disconnect(true);
    }
  },
};
