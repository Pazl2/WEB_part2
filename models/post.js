const mongoose = require('mongoose');
const toJSONOptions = require('./toJSONOptions');

// Вложенный документ (subdocument): комментарий хранится внутри поста,
// отдельной коллекции для него нет.
const commentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true, trim: true },
    // id автора из PostgreSQL. Не required: у старых и демо-комментариев его нет
    // (такие комментарии может удалять только админ).
    userId: { type: Number },
    text: { type: String, required: true, trim: true },
    likes: { type: Number, default: 0, min: 0 },
    // id пользователей, лайкнувших комментарий (один пользователь — один лайк).
    // likes всегда равен длине этого массива, оба поля меняются одним атомарным апдейтом.
    likedBy: { type: [Number], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { toJSON: toJSONOptions }
);

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    // Имя автора выставляет сервер (из учётной записи), клиент его не передаёт
    author: { type: String, required: true, trim: true },
    category: { type: String, default: 'Общее' },
    // массив строк
    tags: { type: [String], default: [] },
    // массив вложенных документов
    comments: { type: [commentSchema], default: [] },
    // Пользователи лежат в PostgreSQL, поэтому ссылка на них — это обычное число
    // (Users.id), а не ObjectId. Внешнего ключа между базами нет, связь
    // поддерживается в коде (см. postsController и usersController).
    userId: { type: Number },
  },
  { timestamps: true, toJSON: toJSONOptions }
);

// Индексы: сортировка по дате, поиск по тегам, фильтр по автору-пользователю
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ userId: 1 });

// Метод экземпляра: добавить комментарий в массив comments
postSchema.methods.addComment = function (author, text, userId) {
  this.comments.push({ author, text, userId });
  return this.comments[this.comments.length - 1];
};

// Статический метод модели: посты, у которых массив tags содержит значение
postSchema.statics.findByTag = function (tag) {
  return this.find({ tags: tag });
};

module.exports = mongoose.model('Post', postSchema);
