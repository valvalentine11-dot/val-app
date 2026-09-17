const express = require('express');
const { body } = require('express-validator');
const { sendMessage, getConversation, listConversations } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', listConversations);
router.get('/:id', getConversation);
router.post(
  '/:id/send',
  [body('text').trim().notEmpty().withMessage('Message cannot be empty')],
  sendMessage
);

module.exports = router;
