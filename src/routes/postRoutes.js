const express = require('express');
const { body } = require('express-validator');
const {
  listPublishedPosts,
  getFeed,
  getPost,
  getMyPosts,
  createPost,
  updatePost,
  publishPost,
  deletePost,
  likePost,
  unlikePost,
} = require('../controllers/postController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const postValidation = [
  body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
  body('content').trim().notEmpty().withMessage('content is required'),
  body('tags').optional().isArray().withMessage('tags must be an array of strings'),
];


router.get('/', optionalAuth, listPublishedPosts);
router.get('/feed', requireAuth, getFeed);
router.get('/me', requireAuth, getMyPosts);
router.get('/:id', optionalAuth, getPost);


router.post('/', requireAuth, postValidation, createPost);
router.patch('/:id', requireAuth, postValidation.map((v) => v.optional()), updatePost);
router.patch('/:id/publish', requireAuth, publishPost);
router.delete('/:id', requireAuth, deletePost);
router.post('/:id/like', requireAuth, likePost);
router.delete('/:id/like', requireAuth, unlikePost);

module.exports = router;
