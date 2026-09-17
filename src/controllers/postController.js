const { validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const Like = require('../models/Like');
const { getPagination, buildPaginatedResponse } = require('../utils/paginate');

const SORTABLE_FIELDS = {
  like_count: 'like_count',
  comment_count: 'comment_count',
  timestamp: 'createdAt',
};

function buildSort(sortParam) {
  if (!sortParam) return { createdAt: -1 };
  const sort = {};
  const parts = String(sortParam).split(',');
  parts.forEach((part) => {
    const desc = part.startsWith('-');
    const key = desc ? part.slice(1) : part;
    const field = SORTABLE_FIELDS[key];
    if (field) sort[field] = desc ? -1 : 1;
  });
  return Object.keys(sort).length ? sort : { createdAt: -1 };
}

async function buildSearchFilter(search) {
  if (!search) return {};
  const regex = new RegExp(search, 'i');
  const matchingAuthors = await User.find({ username: regex }).select('_id');
  const authorIds = matchingAuthors.map((u) => u._id);

  return {
    $or: [{ title: regex }, { tags: regex }, ...(authorIds.length ? [{ author: { $in: authorIds } }] : [])],
  };
}


async function listPublishedPosts(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query, 20);
    const searchFilter = await buildSearchFilter(req.query.search);
    const filter = { state: 'published', ...searchFilter };
    const sort = buildSort(req.query.sort);

    const [posts, total] = await Promise.all([
      Post.find(filter).sort(sort).skip(skip).limit(limit).populate('author', 'first_name last_name username'),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json(buildPaginatedResponse({ data: posts, total, page, limit }));
  } catch (err) {
    return next(err);
  }
}


async function getPost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id).populate(
      'author',
      'first_name last_name username email bio'
    );
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const isOwner = req.user && post.author._id.toString() === req.user._id.toString();
    if (post.state !== 'published' && !isOwner) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    let liked_by_me = false;
    if (req.user) {
      liked_by_me = !!(await Like.exists({ user: req.user._id, post: post._id }));
    }

    return res.status(200).json({ post, liked_by_me });
  } catch (err) {
    return next(err);
  }
}


async function getMyPosts(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query, 20);
    const filter = { author: req.user._id };
    if (req.query.state && ['draft', 'published'].includes(req.query.state)) {
      filter.state = req.query.state;
    }
    const sort = buildSort(req.query.sort);

    const [posts, total] = await Promise.all([
      Post.find(filter).sort(sort).skip(skip).limit(limit),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json(buildPaginatedResponse({ data: posts, total, page, limit }));
  } catch (err) {
    return next(err);
  }
}


async function getFeed(req, res, next) {
  try {
    const Follow = require('../models/Follow');
    const { page, limit, skip } = getPagination(req.query, 20);

    const follows = await Follow.find({ follower: req.user._id }).select('following');
    const followingIds = follows.map((f) => f.following);

    const filter = {
      $or: [
        { author: req.user._id },
        { author: { $in: followingIds }, state: 'published' },
      ],
    };
    const sort = buildSort(req.query.sort);

    const [posts, total] = await Promise.all([
      Post.find(filter).sort(sort).skip(skip).limit(limit).populate('author', 'first_name last_name username'),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json(buildPaginatedResponse({ data: posts, total, page, limit }));
  } catch (err) {
    return next(err);
  }
}


async function createPost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { title, content, tags } = req.body;
    const post = await Post.create({
      title,
      content,
      tags: Array.isArray(tags) ? tags : [],
      author: req.user._id,
      state: 'published',
    });

    return res.status(201).json({ post });
  } catch (err) {
    return next(err);
  }
}

async function findOwnedPost(req) {
  const post = await Post.findById(req.params.id);
  if (!post) return { error: 404, message: 'Post not found.' };
  if (post.author.toString() !== req.user._id.toString()) {
    return { error: 403, message: 'You do not have permission to modify this post.' };
  }
  return { post };
}


async function updatePost(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { post, error, message } = await findOwnedPost(req);
    if (error) return res.status(error).json({ message });

    const { title, content, tags } = req.body;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (tags !== undefined) post.tags = tags;

    await post.save();
    return res.status(200).json({ post });
  } catch (err) {
    return next(err);
  }
}


async function publishPost(req, res, next) {
  try {
    const { post, error, message } = await findOwnedPost(req);
    if (error) return res.status(error).json({ message });

    post.state = 'published';
    await post.save();
    return res.status(200).json({ post });
  } catch (err) {
    return next(err);
  }
}


async function deletePost(req, res, next) {
  try {
    const { post, error, message } = await findOwnedPost(req);
    if (error) return res.status(error).json({ message });

    await post.deleteOne();
    return res.status(200).json({ message: 'Post deleted.' });
  } catch (err) {
    return next(err);
  }
}


async function likePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.state !== 'published') {
      return res.status(404).json({ message: 'Post not found.' });
    }

    try {
      await Like.create({ user: req.user._id, post: post._id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: 'You have already liked this post.' });
      }
      throw err;
    }

    post.like_count += 1;
    await post.save();

    return res.status(200).json({ message: 'Post liked.', like_count: post.like_count });
  } catch (err) {
    return next(err);
  }
}


async function unlikePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const existing = await Like.findOneAndDelete({ user: req.user._id, post: post._id });
    if (!existing) {
      return res.status(409).json({ message: 'You have not liked this post.' });
    }

    post.like_count = Math.max(0, post.like_count - 1);
    await post.save();

    return res.status(200).json({ message: 'Post unliked.', like_count: post.like_count });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
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
};
