'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    // Проверка пароля
    comparePassword(plain) {
      return bcrypt.compare(plain, this.password);
    }

    // Наружу не отдаём пароль и данные 2FA
    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      delete values.twoFactorCode;
      delete values.twoFactorExpires;
      delete values.twoFactorAttempts;
      delete values.twoFactorLockedUntil;
      return values;
    }
  }

  User.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: { msg: 'Некорректный email' } },
        // email хранится в нижнем регистре и без пробелов по краям
        set(value) {
          this.setDataValue(
            'email',
            typeof value === 'string' ? value.trim().toLowerCase() : value
          );
        },
      },
      // Публичное имя: именно оно показывается как автор постов и комментариев,
      // email наружу не отдаётся. Уникальность без учёта регистра обеспечивает
      // индекс users_username_lower_key (см. миграцию).
      username: {
        type: DataTypes.STRING(24),
        allowNull: false,
        validate: { len: { args: [3, 24], msg: 'Имя пользователя: от 3 до 24 символов' } },
        set(value) {
          this.setDataValue('username', typeof value === 'string' ? value.trim() : value);
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'user',
      },
      twoFactorCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twoFactorExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // число неверных вводов кода и время, до которого вход по коду заблокирован
      twoFactorAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      twoFactorLockedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
    }
  );

  return User;
};
