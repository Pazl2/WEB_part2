const { Post } = require('../models');
const L = require('../config/limits');
const { canModify } = require('../utils/permissions');
const { serializePost, serializePosts } = require('../utils/serializePost');
const { parsePostInput } = require('../utils/postInput');
const publisher = require('../realtime/publisher');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Целый параметр запроса в диапазоне [1, max]. undefined → значение по умолчанию,
// всё остальное (не число, дробь, выход за диапазон) → null.
function parseIntParam(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const n = Number(value);
  return n <= max ? n : null;
}

// GET /api/posts?search=&tag=&category=&sort=new|old&page=1&limit=10
// Ответ: { items, total, page, limit, totalPages, categoryCounts }.
// categoryCounts — число постов по категориям при текущих search и tag (без учёта category),
// клиент показывает по ним счётчики. total — число постов с учётом category.
async function getAllPosts(req, res, next) {
  try {
    const { search = '', tag = '', category, sort = 'new' } = req.query;
    if (typeof search !== 'string' || typeof tag !== 'string') {
      return res.status(400).json({ error: 'Некорректные параметры поиска' });
    }
    const searchText = search.trim();
    const tagText = tag.trim();
    if (searchText.length > L.SEARCH_MAX || tagText.length > L.SEARCH_MAX) {
      return res.status(400).json({ error: `Запрос слишком длинный: максимум ${L.SEARCH_MAX} символов` });
    }
    if (category !== undefined && !L.CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Категория должна быть одной из: ${L.CATEGORIES.join(', ')}` });
    }
    if (sort !== 'new' && sort !== 'old') {
      return res.status(400).json({ error: 'Параметр sort: new или old' });
    }
    const page = parseIntParam(req.query.page, 1, L.PAGE_MAX);
    const limit = parseIntParam(req.query.limit, L.PAGE_SIZE_DEFAULT, L.PAGE_SIZE_MAX);
    if (page === null) return res.status(400).json({ error: 'Некорректный параметр page' });
    if (limit === null) {
      return res.status(400).json({ error: `Параметр limit: целое от 1 до ${L.PAGE_SIZE_MAX}` });
    }

    // Фильтр без категории (по нему считаются счётчики) и тот же фильтр с категорией
    const base = {};
    if (tagText) base.tags = tagText;
    if (searchText) {
      const re = new RegExp(escapeRegExp(searchText), 'i');
      base.$or = [{ title: re }, { content: re }, { author: re }];
    }
    const filter = category ? { ...base, category } : base;

    const direction = sort === 'old' ? 1 : -1;
    const [posts, groups] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: direction, _id: direction }) // _id — чтобы порядок между страницами был стабильным
        .skip((page - 1) * limit)
        .limit(limit),
      Post.aggregate([{ $match: base }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);

    const categoryCounts = Object.fromEntries(L.CATEGORIES.map((c) => [c, 0]));
    let all = 0;
    for (const g of groups) {
      all += g.count;
      if (g._id in categoryCounts) categoryCounts[g._id] = g.count;
    }
    const total = category ? categoryCounts[category] : all;

    res.status(200).json({
      items: await serializePosts(posts, req.user),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      categoryCounts,
    });
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
    const input = parsePostInput(req.body);
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }
    const { title, content, category, tags } = input.value;

    // Автор и владелец берутся из учётной записи (req.user проверен на сервере).
    // Поля author и userId из тела запроса игнорируются. Автор — публичное имя
    // (username), а не email.
    const newPost = await Post.create({
      title,
      content,
      author: req.user.username,
      category,
      tags,
      userId: req.user.id,
    });
    const body = await serializePost(newPost, req.user);
    publisher.postCreated(body, req.user); // уведомляем подключённых по WebSocket
    res.status(201).json(body);
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

    const input = parsePostInput(req.body);
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }
    const { title, content, category, tags } = input.value;

    // author и userId не меняются никогда
    post.title = title;
    post.content = content;
    if (category !== undefined) post.category = category;
    if (tags !== undefined) post.tags = tags;
    await post.save();

    const body = await serializePost(post, req.user);
    publisher.postUpdated(body, req.user);
    res.status(200).json(body);
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
    const body = await serializePost(post, req.user);
    publisher.postDeleted(body, req.user);
    res.status(200).json({ message: 'Пост удалён', post: body });
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
