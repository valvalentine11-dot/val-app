const { request, app, registerUser } = require('./helpers');

describe('Auth endpoints', () => {
  test('POST /api/auth/signup creates a user and returns a token', async () => {
    const { res } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  test('POST /api/auth/signup rejects duplicate email/username', async () => {
    const { payload } = await registerUser();
    const res = await request(app).post('/api/auth/signup').send({
      ...payload,
      username: `${payload.username}_2`,
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/signup validates required fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login succeeds with correct credentials', async () => {
    const { payload } = await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: payload.username, password: payload.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/login fails with wrong password', async () => {
    const { payload } = await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: payload.username, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me requires a valid token', async () => {
    const noAuth = await request(app).get('/api/auth/me');
    expect(noAuth.status).toBe(401);

    const { token } = await registerUser();
    const authed = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(authed.status).toBe(200);
    expect(authed.body.user).toBeDefined();
  });

  test('GET /api/auth/me rejects an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
