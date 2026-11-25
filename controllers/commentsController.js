const { Post } = require('../models');
const { canModify } = require('../utils/permissions');
const { serializePost } = require('../utils/serializePost');

// POST /api/posts/:id/comments — добавить элемент во вложенный массив comments
async function addComment(req, res, next) {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'Поле text обязательно' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
    }

    // автор комментария — всегда текущий пользователь
    post.addComment(req.user.email, text, req.user.id);
    await post.save();

    res.status(201).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

// PUT /api/posts/:id/comments/:commentId/like — поставить лайк.
// Один пользователь — один лайк: условие $elemMatch + $ne и обновление выполняются
// одним атомарным запросом, поэтому повторные и параллельные запросы лайк не накручивают.
async function likeComment(req, res, next) {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    let post = await Post.findOneAndUpdate(
      { _id: id, comments: { $elemMatch: { _id: commentId, likedBy: { $ne: userId } } } },
      { $addToSet: { 'comments.$.likedBy': userId }, $inc: { 'comments.$.likes': 1 } },
      { new: true }
    );

    if (!post) {
      // либо поста/комментария нет, либо лайк уже стоит (тогда ничего не меняем)
      post = await Post.findOne({ _id: id, 'comments._id': commentId });
      if (!post) {
        return res.status(404).json({ error: 'Пост или комментарий не найден' });
      }
    }
    res.status(200).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id/comments/:commentId/like — снять свой лайк
async function unlikeComment(req, res, next) {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    let post = await Post.findOneAndUpdate(
      { _id: id, comments: { $elemMatch: { _id: commentId, likedBy: userId } } },
      { $pull: { 'comments.$.likedBy': userId }, $inc: { 'comments.$.likes': -1 } },
      { new: true }
    );

    if (!post) {
      post = await Post.findOne({ _id: id, 'comments._id': commentId });
      if (!post) {
        return res.status(404).json({ error: 'Пост или комментарий не найден' });
      }
    }
    res.status(200).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id/comments/:commentId — удалить элемент из массива ($pull).
// Удалять может автор комментария или админ.
async function deleteComment(req, res, next) {
  try {
    const { id, commentId } = req.params;

    const existing = await Post.findById(id);
    const comment = existing && existing.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Пост или комментарий не найден' });
    }
    if (!canModify(req.user, comment)) {
      return res.status(403).json({ error: 'Удалить комментарий может только его автор или админ' });
    }

    const post = await Post.findOneAndUpdate(
      { _id: id, 'comments._id': commentId },
      { $pull: { comments: { _id: commentId } } },
      { new: true }
    );
    if (!post) {
      // комментарий успели удалить между проверкой и обновлением
      return res.status(404).json({ error: 'Пост или комментарий не найден' });
    }
    res.status(200).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

module.exports = { addComment, likeComment, unlikeComment, deleteComment };
