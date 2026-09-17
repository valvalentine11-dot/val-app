const { validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const { getPagination, buildPaginatedResponse } = require('../utils/paginate');

// POST /api/chat/:id/send - send a message
async function sendMessage(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const receiver = await User.findById(req.params.id);
    if (!receiver) return res.status(404).json({ message: 'User not found.' });

    if (receiver._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot send a message to yourself.' });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiver._id,
      text: req.body.text,
    }).populate('sender', 'first_name last_name username').populate('receiver', 'first_name last_name username');

    return res.status(201).json({ message });
  } catch (err) {
    return next(err);
  }
}

// GET /api/chat/:id - get conversation with a user (paginated)
async function getConversation(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query, 20);
    const otherUserId = req.params.id;

    const filter = {
      $or: [
        { sender: req.user._id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user._id },
      ],
    };

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'first_name last_name username')
        .populate('receiver', 'first_name last_name username'),
      Message.countDocuments(filter),
    ]);

    // Mark messages as read
    await Message.updateMany(
      { ...filter, receiver: req.user._id, read: false },
      { read: true }
    );

    return res.status(200).json(buildPaginatedResponse({ data: messages.reverse(), total, page, limit }));
  } catch (err) {
    return next(err);
  }
}

// GET /api/chat - list all conversations
async function listConversations(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query, 20);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender',
            ],
          },
          lastMessage: { $last: '$text' },
          lastMessageTime: { $last: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', req.user._id] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageTime: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]);

    const total = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender',
            ],
          },
        },
      },
      { $count: 'total' },
    ]);

    const totalCount = total[0]?.total || 0;

    return res.status(200).json(
      buildPaginatedResponse({
        data: conversations.map((c) => ({
          user: c.user,
          lastMessage: c.lastMessage,
          lastMessageTime: c.lastMessageTime,
          unreadCount: c.unreadCount,
        })),
        total: totalCount,
        page,
        limit,
      })
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = { sendMessage, getConversation, listConversations };
