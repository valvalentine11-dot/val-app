const User = require('../models/User');
const Follow = require('../models/Follow');
const { getPagination, buildPaginatedResponse } = require('../utils/paginate');

// POST /api/users/:id/follow
async function followUser(req, res, next) {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself.' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    try {
      await Follow.create({ follower: req.user._id, following: target._id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: 'You already follow this user.' });
      }
      throw err;
    }

    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $inc: { following_count: 1 } }),
      User.findByIdAndUpdate(target._id, { $inc: { followers_count: 1 } }),
    ]);

    return res.status(201).json({ message: `You are now following ${target.username}.` });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/users/:id/follow
async function unfollowUser(req, res, next) {
  try {
    const targetId = req.params.id;

    const deleted = await Follow.findOneAndDelete({ follower: req.user._id, following: targetId });
    if (!deleted) {
      return res.status(409).json({ message: 'You do not follow this user.' });
    }

    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $inc: { following_count: -1 } }),
      User.findByIdAndUpdate(targetId, { $inc: { followers_count: -1 } }),
    ]);

    return res.status(200).json({ message: 'Unfollowed successfully.' });
  } catch (err) {
    return next(err);
  }
}

// GET /api/users/:id/following - users that :id follows
async function getFollowing(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query, 20);
    const filter = { follower: req.params.id };

    const [rows, total] = await Promise.all([
      Follow.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'first_name last_name username bio followers_count following_count'),
      Follow.countDocuments(filter),
    ]);

    const data = rows.map((r) => r.following);
    return res.status(200).json(buildPaginatedResponse({ data, total, page, limit }));
  } catch (err) {
    return next(err);
  }
}

// GET /api/users/:id/followers - users that follow :id
async function getFollowers(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query, 20);
    const filter = { following: req.params.id };

    const [rows, total] = await Promise.all([
      Follow.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'first_name last_name username bio followers_count following_count'),
      Follow.countDocuments(filter),
    ]);

    const data = rows.map((r) => r.follower);
    return res.status(200).json(buildPaginatedResponse({ data, total, page, limit }));
  } catch (err) {
    return next(err);
  }
}

// GET /api/users/:id - basic public profile
async function getUserProfile(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ user: user.toPublicJSON() });
  } catch (err) {
    return next(err);
  }
}

module.exports = { followUser, unfollowUser, getFollowing, getFollowers, getUserProfile };
