const { request, app, registerUser } = require('./helpers');

describe('Chat / Messaging', () => {
  test('A user can send a message to another user', async () => {
    const { token: token1, user: user1 } = await registerUser();
    const { user: user2 } = await registerUser();

    const res = await request(app)
      .post(`/api/chat/${user2.id}/send`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ text: 'Hey, how are you?' });

    expect(res.status).toBe(201);
    expect(res.body.message.text).toBe('Hey, how are you?');
    expect(res.body.message.sender.id).toBe(user1.id);
    expect(res.body.message.receiver.id).toBe(user2.id);
    expect(res.body.message.read).toBe(false);
  });

  test('Sending a message requires authentication', async () => {
    const { user } = await registerUser();
    const res = await request(app).post(`/api/chat/${user.id}/send`).send({ text: 'Hi' });
    expect(res.status).toBe(401);
  });

  test('A user cannot send a message to themselves', async () => {
    const { token, user } = await registerUser();
    const res = await request(app)
      .post(`/api/chat/${user.id}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Talking to myself' });
    expect(res.status).toBe(400);
  });

  test('GET /api/chat/:id retrieves conversation between two users', async () => {
    const { token: token1 } = await registerUser();
    const { token: token2, user: user2 } = await registerUser();

    await request(app)
      .post(`/api/chat/${user2.id}/send`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ text: 'First message' });

    await request(app)
      .post(`/api/chat/${user2.id}/send`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ text: 'Reply' });

    const res = await request(app).get(`/api/chat/${user2.id}`).set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(2);
  });

  test('GET /api/chat/:id marks messages as read', async () => {
    const { token: token1, user: user1 } = await registerUser();
    const { token: token2, user: user2 } = await registerUser();

    await request(app)
      .post(`/api/chat/${user2.id}/send`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ text: 'Unread message' });

    const res = await request(app).get(`/api/chat/${user1.id}`).set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(200);
    // After fetching, messages should be marked as read
    // Re-fetch to verify
    const recheck = await request(app).get(`/api/chat/${user1.id}`).set('Authorization', `Bearer ${token2}`);
    expect(recheck.body.data[0].read).toBe(true);
  });

  test('GET /api/chat lists all conversations', async () => {
    const { token: token1 } = await registerUser();
    const { user: user2 } = await registerUser();
    const { user: user3 } = await registerUser();

    await request(app)
      .post(`/api/chat/${user2.id}/send`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ text: 'Message 1' });

    await request(app)
      .post(`/api/chat/${user3.id}/send`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ text: 'Message 2' });

    const res = await request(app).get('/api/chat').set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(2);
  });

  test('GET /api/chat is paginated', async () => {
    const { token: token1 } = await registerUser();

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { user } = await registerUser();
      // eslint-disable-next-line no-await-in-loop
      await request(app)
        .post(`/api/chat/${user.id}/send`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ text: `Message to user ${i}` });
    }

    const res = await request(app).get('/api/chat?limit=2').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(5);
  });

  test('Messages require non-empty text', async () => {
    const { token } = await registerUser();
    const { user } = await registerUser();

    const res = await request(app)
      .post(`/api/chat/${user.id}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '' });

    expect(res.status).toBe(400);
  });
});
