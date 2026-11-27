// Одноразовая миграция данных MongoDB после появления username.
// Раньше в author постов и комментариев мог лежать email автора, а GET /posts открыт всем.
// Скрипт заменяет такие значения на username. Запускать ПОСЛЕ `npx sequelize-cli db:migrate`:
//   npm run migrate:authors -- --dry-run   # только показать, что изменится
//   npm run migrate:authors                # применить
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const { sequelize, User, Post } = require('../models');

const DELETED_AUTHOR = 'Удалённый пользователь';
const dryRun = process.argv.includes('--dry-run');

// kind 'comment': автор комментария всегда выставлялся сервером из токена, поэтому по email
//   можно восстановить и userId (старые комментарии без userId смогут удалять свои авторы).
// kind 'post': у старых постов author приходил из тела запроса и мог быть подделан, поэтому
//   userId по нему не восстанавливаем: меняем только отображаемое имя.
function resolve(entity, kind, byId, byEmail) {
  const author = String(entity.author || '');

  if (entity.userId != null) {
    const user = byId.get(entity.userId);
    return { author: user ? user.username : DELETED_AUTHOR };
  }

  const user = byEmail.get(author.trim().toLowerCase());
  if (user) {
    return kind === 'comment' ? { author: user.username, userId: user.id } : { author: user.username };
  }
  // Похоже на email, но такого пользователя нет (удалён): адрес всё равно не показываем
  if (author.includes('@')) return { author: DELETED_AUTHOR };
  return null; // демо-данные с обычным именем автора не трогаем
}

function apply(entity, change) {
  let changed = false;
  if (change.author !== undefined && entity.author !== change.author) {
    entity.author = change.author;
    changed = true;
  }
  if (change.userId !== undefined && entity.userId !== change.userId) {
    entity.userId = change.userId;
    changed = true;
  }
  return changed;
}

async function run() {
  await Promise.all([sequelize.authenticate(), connectDB()]);

  const users = await User.findAll({ attributes: ['id', 'email', 'username'] });
  const byId = new Map(users.map((u) => [u.id, u]));
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  let posts = 0;
  let comments = 0;
  let touchedDocs = 0;

  for await (const post of Post.find().cursor()) {
    let docChanged = false;

    const postChange = resolve(post, 'post', byId, byEmail);
    if (postChange && apply(post, postChange)) {
      posts += 1;
      docChanged = true;
    }
    for (const comment of post.comments) {
      const change = resolve(comment, 'comment', byId, byEmail);
      if (change && apply(comment, change)) {
        comments += 1;
        docChanged = true;
      }
    }

    if (docChanged) {
      touchedDocs += 1;
      if (!dryRun) await post.save({ timestamps: false, validateBeforeSave: false });
    }
  }

  console.log(
    `${dryRun ? '[dry-run] Было бы изменено' : 'Изменено'}: постов ${posts}, комментариев ${comments} (документов: ${touchedDocs})`
  );
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
      await sequelize.close();
    });
}

module.exports = { resolve, apply };
