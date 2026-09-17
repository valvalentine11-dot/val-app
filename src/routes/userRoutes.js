const express = require('express');
const {
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  getUserProfile,
} = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', getUserProfile);
router.get('/:id/following', getFollowing);
router.get('/:id/followers', getFollowers);

router.post('/:id/follow', requireAuth, followUser);
router.delete('/:id/follow', requireAuth, unfollowUser);

module.exports = router;
