const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
