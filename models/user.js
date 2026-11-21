const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const toJSONOptions = require('./toJSONOptions');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // уникальный индекс по email
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Некорректный email'],
    },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    twoFactorCode: { type: String, default: null },
    twoFactorExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSONOptions,
      transform(doc, ret) {
        delete ret._id;
        delete ret.password;
        delete ret.twoFactorCode;
        delete ret.twoFactorExpires;
        return ret;
      },
    },
  }
);

// Метод экземпляра: проверка пароля
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Каскадное удаление: при удалении пользователя удаляем все его посты
// (комментарии лежат внутри постов и удаляются вместе с ними).
userSchema.pre('deleteOne', { document: true, query: false }, async function () {
  await mongoose.model('Post').deleteMany({ user: this._id });
});

module.exports = mongoose.model('User', userSchema);
