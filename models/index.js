'use strict';

// Две базы данных:
//   PostgreSQL (Sequelize) — пользователи (User)
//   MongoDB (Mongoose)     — посты (Post) с вложенными комментариями и тегами
const Sequelize = require('sequelize');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.js')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: false,
});

const User = require('./user')(sequelize, Sequelize.DataTypes);
const Post = require('./post');

module.exports = { sequelize, Sequelize, User, Post };
