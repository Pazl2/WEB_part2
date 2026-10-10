'use strict';
const { Model } = require('sequelize');
const { LIMITS } = require('../utils/validation');

module.exports = (sequelize, DataTypes) => {
  class Post extends Model {
    static associate(models) {}
  }

  Post.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { len: [1, LIMITS.title] },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: { len: [1, LIMITS.content] },
      },
      author: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { len: [1, LIMITS.author] },
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Общее',
      },
    },
    {
      sequelize,
      modelName: 'Post',
    }
  );

  return Post;
};
