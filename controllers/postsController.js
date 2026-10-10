const { Post } = require('../models');
const { validatePostFields } = require('../utils/validation');

async function getAllPosts(req, res, next) {
  try {
    const posts = await Post.findAll();
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
}

async function getPostById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${id} не найден` });
    }
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const { title, content, author, category } = req.body;

    const error = validatePostFields({ title, content, author });
    if (error) {
      return res.status(400).json({ error });
    }

    const newPost = await Post.create({ title, content, author, category });
    res.status(201).json(newPost);
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { title, content, author, category } = req.body;

    const error = validatePostFields({ title, content, author });
    if (error) {
      return res.status(400).json({ error });
    }

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({ error: `Пост с id=${id} не найден` });
    }

    await post.update({ title, content, author, category });
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const id = Number(req.params.id);
    const deletedCount = await Post.destroy({ where: { id } });

    if (!deletedCount) {
      return res.status(404).json({ error: `Пост с id=${id} не найден` });
    }
    res.status(204).send();
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
