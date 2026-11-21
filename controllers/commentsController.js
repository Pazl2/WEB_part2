const { Post } = require('../models');

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

    post.addComment(req.user.email, text);
    await post.save();

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/posts/:id/comments/:commentId/like — обновить элемент внутри массива
// (позиционный оператор $ + $inc: комментарий ищется в массиве и обновляется на месте)
async function likeComment(req, res, next) {
  try {
    const { id, commentId } = req.params;

    const post = await Post.findOneAndUpdate(
      { _id: id, 'comments._id': commentId },
      { $inc: { 'comments.$.likes': 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Пост или комментарий не найден' });
    }
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id/comments/:commentId — удалить элемент из массива ($pull)
async function deleteComment(req, res, next) {
  try {
    const { id, commentId } = req.params;

    const post = await Post.findOneAndUpdate(
      { _id: id, 'comments._id': commentId },
      { $pull: { comments: { _id: commentId } } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Пост или комментарий не найден' });
    }
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

module.exports = { addComment, likeComment, deleteComment };
