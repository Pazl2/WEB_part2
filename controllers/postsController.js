const postsModel = require('../models/posts');

// GET /posts
function getAllPosts(req, res) {
  res.status(200).json(postsModel.getAll());
}

// GET /posts/:id
function getPostById(req, res) {
  const id = Number(req.params.id);
  const post = postsModel.getById(id);

  if (!post) {
    return res.status(404).json({ error: `Пост с id=${id} не найден` });
  }
  res.status(200).json(post);
}

// POST /posts
function createPost(req, res) {
  const { title, content, author } = req.body;

  if (!title || !content || !author) {
    return res
      .status(400)
      .json({ error: 'Поля title, content и author обязательны' });
  }

  const newPost = postsModel.create({ title, content, author });
  res.status(201).json(newPost);
}

// PUT /posts/:id
function updatePost(req, res) {
  const id = Number(req.params.id);
  const { title, content, author } = req.body;

  if (!title || !content || !author) {
    return res
      .status(400)
      .json({ error: 'Поля title, content и author обязательны' });
  }

  const updated = postsModel.update(id, { title, content, author });

  if (!updated) {
    return res.status(404).json({ error: `Пост с id=${id} не найден` });
  }
  res.status(200).json(updated);
}

// DELETE /posts/:id
function deletePost(req, res) {
  const id = Number(req.params.id);
  const deleted = postsModel.remove(id);

  if (!deleted) {
    return res.status(404).json({ error: `Пост с id=${id} не найден` });
  }
  res.status(204).send();
}

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
