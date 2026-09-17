const { validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

async function signup(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { first_name, last_name, username, email, password, bio } = req.body;

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });
    if (existing) {
      return res.status(409).json({ message: 'A user with that email or username already exists.' });
    }

    const user = await User.create({ first_name, last_name, username, email, password, bio });
    const token = generateToken(user);

    return res.status(201).json({ user: user.toPublicJSON(), token });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { identifier, password } = req.body; // identifier = email or username

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    return res.status(200).json({ user: user.toPublicJSON(), token });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res) {
  return res.status(200).json({ user: req.user.toPublicJSON() });
}

module.exports = { signup, login, me };
