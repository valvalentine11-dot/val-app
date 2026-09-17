const request = require('supertest');
const app = require('../src/app');

async function registerUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const payload = {
    first_name: 'Test',
    last_name: 'User',
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/signup').send(payload);
  return { res, payload, token: res.body.token, user: res.body.user };
}

module.exports = { registerUser, request, app };
