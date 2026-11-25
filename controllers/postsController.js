const { Post } = require('../models');
const { canModify } = require('../utils/permissions');
const { serializePost, serializePosts } = require('../utils/serializePost');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// tags может прийти массивом или строкой "важный, границы"
function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))];
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
    res.status(200).json(await serializePosts(posts, req.user));
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
    res.status(200).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const { title, content, category, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Поля title и content обязательны' });
    }

    // Автор и владелец берутся из учётной записи (req.user проверен на сервере).
    // Поля author и userId из тела запроса игнорируются — подписаться чужим именем нельзя.
    const newPost = await Post.create({
      title,
      content,
      author: req.user.email,
      category,
      tags: normalizeTags(tags),
      userId: req.user.id,
    });
    res.status(201).json(await serializePost(newPost, req.user));
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
    }
    if (!canModify(req.user, post)) {
      return res.status(403).json({ error: 'Редактировать пост может только его автор или админ' });
    }

    const { title, content, category, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Поля title и content обязательны' });
    }

    // author и userId не меняются никогда
    post.title = title;
    post.content = content;
    if (category !== undefined) post.category = category;
    if (tags !== undefined) post.tags = normalizeTags(tags);
    await post.save();

    res.status(200).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
    }
    if (!canModify(req.user, post)) {
      return res.status(403).json({ error: 'Удалить пост может только его автор или админ' });
    }

    await post.deleteOne();
    // возвращаем удалённый документ в ответе
    res.status(200).json({ message: 'Пост удалён', post: await serializePost(post, req.user) });
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
