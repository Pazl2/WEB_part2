const mongoose = require('mongoose');
const toJSONOptions = require('./toJSONOptions');
const L = require('../config/limits');

// История чата в MongoDB. Один документ — одно сообщение двух видов:
//   сообщение комнаты — заполнено room, recipientId нет;
//   личное сообщение  — заполнен recipientId, room нет.
// Пользователи лежат в PostgreSQL, поэтому на них ссылаются числовые id (Users.id),
// а имя автора сохраняется в самом сообщении (оно не меняется: смены username пока нет).
const chatMessageSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      enum: { values: L.CHAT_ROOMS, message: 'Недопустимая комната: {VALUE}' },
    },
    userId: { type: Number, required: true },
    author: { type: String, required: true, trim: true },
    recipientId: { type: Number },
    recipientName: { type: String, trim: true },
    text: { type: String, required: true, trim: true, maxlength: L.CHAT_MESSAGE_MAX },
  },
  // updatedAt не нужен: сообщения не редактируются
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: toJSONOptions }
);

// Выборка истории комнаты и диалога — по этим индексам
chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ userId: 1, recipientId: 1, createdAt: -1 });
chatMessageSchema.index({ recipientId: 1, createdAt: -1 });

// Последние `limit` сообщений в хронологическом порядке (старые сверху)
function newestFirstThenReverse(query, limit) {
  return query
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .then((docs) => docs.reverse());
}

chatMessageSchema.statics.roomHistory = function (room, limit = L.CHAT_HISTORY_LIMIT) {
  return newestFirstThenReverse(this.find({ room }), limit);
};

// Переписка двух пользователей (в обе стороны)
chatMessageSchema.statics.privateHistory = function (userA, userB, limit = L.CHAT_HISTORY_LIMIT) {
  const query = this.find({
    $or: [
      { userId: userA, recipientId: userB },
      { userId: userB, recipientId: userA },
    ],
  });
  return newestFirstThenReverse(query, limit);
};

// Собеседники пользователя, от самых свежих к старым: [{ userId, username, lastAt }].
// Смотрим только последние `scanLimit` личных сообщений: этого достаточно для списка диалогов.
chatMessageSchema.statics.dialogsOf = async function (userId, scanLimit = 500) {
  const docs = await this.find({
    $or: [{ userId, recipientId: { $exists: true } }, { recipientId: userId }],
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(scanLimit);

  const peers = new Map();
  for (const doc of docs) {
    const sentByMe = doc.userId === userId;
    const peerId = sentByMe ? doc.recipientId : doc.userId;
    if (!peers.has(peerId)) {
      peers.set(peerId, {
        userId: peerId,
        username: sentByMe ? doc.recipientName : doc.author,
        lastAt: doc.createdAt,
      });
    }
  }
  return [...peers.values()];
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
