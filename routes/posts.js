const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postsController');

// GET /posts 
router.get('/', postsController.getAllPosts);

// GET /posts/:id 
router.get('/:id', postsController.getPostById);

// POST /posts 
router.post('/', postsController.createPost);

// PUT /posts/:id
router.put('/:id', postsController.updatePost);

// DELETE /posts/:id
router.delete('/:id', postsController.deletePost);

module.exports = router;
