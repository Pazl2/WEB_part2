const { Post } = require('../models');
const L = require('../config/limits');
const { canModify } = require('../utils/permissions');
const { serializePost } = require('../utils/serializePost');
const { parseCommentText } = require('../utils/postInput');
const publisher = require('../realtime/publisher');

// POST /api/posts/:id/comments — добавить элемент во вложенный массив comments.
// Лимит числа комментариев проверяется в условии того же атомарного запроса
// (элемента с индексом MAX-1 ещё нет), поэтому параллельными запросами его не обойти.
async function addComment(req, res, next) {
  try {
    const input = parseCommentText(req.body);
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }

    // автор комментария — всегда текущий пользователь (публичное имя, не email)
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, [`comments.${L.COMMENTS_MAX_PER_POST - 1}`]: { $exists: false } },
      { $push: { comments: { author: req.user.username, userId: req.user.id, text: input.value } } },
      { new: true, runValidators: true }
    );

    if (!post) {
      // поста нет либо в нём уже максимум комментариев
      const exists = await Post.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ error: `Пост с id=${req.params.id} не найден` });
      }
      return res
        .status(409)
        .json({ error: `В посте уже максимум комментариев (${L.COMMENTS_MAX_PER_POST})` });
    }

    const body = await serializePost(post, req.user);
    // новый комментарий — последний элемент массива
    publisher.commentAdded(body, body.comments[body.comments.length - 1], req.user);
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

// Рассылает новое число лайков комментария (список лайкнувших наружу не уходит)
function publishLikes(post, commentId, actor) {
  const comment = post.comments.id(commentId);
  if (comment) publisher.commentLiked(post.id, commentId, comment.likes, actor);
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
    const changed = Boolean(post);

    if (!post) {
      // либо поста/комментария нет, либо лайк уже стоит (тогда ничего не меняем)
      post = await Post.findOne({ _id: id, 'comments._id': commentId });
      if (!post) {
        return res.status(404).json({ error: 'Пост или комментарий не найден' });
      }
    }
    if (changed) publishLikes(post, commentId, req.user);
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
    const changed = Boolean(post);

    if (!post) {
      post = await Post.findOne({ _id: id, 'comments._id': commentId });
      if (!post) {
        return res.status(404).json({ error: 'Пост или комментарий не найден' });
      }
    }
    if (changed) publishLikes(post, commentId, req.user);
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
    publisher.commentDeleted(post.id, commentId, req.user);
    res.status(200).json(await serializePost(post, req.user));
  } catch (err) {
    next(err);
  }
}

module.exports = { addComment, likeComment, unlikeComment, deleteComment };
