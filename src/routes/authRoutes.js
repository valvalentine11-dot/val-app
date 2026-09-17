const express = require('express');
const { body } = require('express-validator');
const { signup, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/signup',
  [
    body('first_name').trim().notEmpty().withMessage('first_name is required'),
    body('last_name').trim().notEmpty().withMessage('last_name is required'),
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('username must be at least 3 characters')
      .matches(/^[a-zA-Z0-9_.]+$/)
      .withMessage('username may only contain letters, numbers, underscores and dots'),
    body('email').isEmail().withMessage('a valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
  ],
  signup
);

router.post(
  '/login',
  [
    body('identifier').trim().notEmpty().withMessage('email or username is required'),
    body('password').notEmpty().withMessage('password is required'),
  ],
  login
);

router.get('/me', requireAuth, me);

module.exports = router;
