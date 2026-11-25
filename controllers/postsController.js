const { Post, User } = require('../models');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// tags может прийти массивом или строкой "важный, границы"
function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))];
}

// Аналог populate('user', 'email'): посты лежат в MongoDB, а пользователи — в PostgreSQL,
// поэтому populate работать не может. Берём все userId одним запросом к PostgreSQL
// и подставляем в каждый пост поле user: { id, email } (или null, если пользователя нет).
async function attachUsers(posts) {
  const ids = [...new Set(posts.map((p) => p.userId).filter((id) => id != null))];
  const users = ids.length
    ? await User.findAll({ where: { id: ids }, attributes: ['id', 'email'] })
    : [];
  const byId = new Map(users.map((u) => [u.id, { id: u.id, email: u.email }]));

  return posts.map((p) => ({ ...p.toJSON(), user: byId.get(p.userId) || null }));
}

async function getAllPosts(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';

    // Model.find() возвращает Query — к нему можно цеплять .or().sort()
    const query = tag ? Post.findByTag(tag) : Post.find();

    if (search) {
      const re = new RegExp(escapeRegExp(search), 'i');
      query.or([{ title: re }, { content: re }, { author: re }]);
    }

    const posts = await query.sort({ createdAt: -1 });
    res.status(200).json(await attachUsers(posts));
  } catch (err) {
    next(err);
  }
}

async function getPostById(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
    }
    const [result] = await attachUsers([post]);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const { title, content, author, category, tags } = req.body;

    if (!title || !content || !author) {
      return res
        .status(400)
        .json({ error: 'Поля title, content и author обязательны' });
    }

    const newPost = await Post.create({
      title,
      content,
      author,
      category,
      tags: normalizeTags(tags),
      userId: req.user.id, // id пользователя из PostgreSQL (берётся из JWT)
    });
    res.status(201).json(newPost);
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const { title, content, author, category, tags } = req.body;

    if (!title || !content || !author) {
      return res
        .status(400)
        .json({ error: 'Поля title, content и author обязательны' });
    }

    const update = { title, content, author };
    if (category !== undefined) update.category = category;
    if (tags !== undefined) update.tags = normalizeTags(tags);

    const post = await Post.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
    }
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
    }
    // возвращаем удалённый документ в ответе
    res.status(200).json({ message: 'Пост удалён', post });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
