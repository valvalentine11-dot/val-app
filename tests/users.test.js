const { request, app, registerUser } = require('./helpers');

describe('Follow system', () => {
  test('A user can follow another user', async () => {
    const { token, user } = await registerUser();
    const { user: target } = await registerUser();

    const res = await request(app).post(`/api/users/${target.id}/follow`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);

    const following = await request(app).get(`/api/users/${user.id}/following`);
    expect(following.body.data.length).toBe(1);
    expect(following.body.data[0].id).toBe(target.id);

    const followers = await request(app).get(`/api/users/${target.id}/followers`);
    expect(followers.body.data.length).toBe(1);
    expect(followers.body.data[0].id).toBe(user.id);
  });

  test('A user cannot follow themselves', async () => {
    const { token, user } = await registerUser();
    const res = await request(app).post(`/api/users/${user.id}/follow`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('A user cannot follow the same user more than once', async () => {
    const { token } = await registerUser();
    const { user: target } = await registerUser();

    await request(app).post(`/api/users/${target.id}/follow`).set('Authorization', `Bearer ${token}`);
    const second = await request(app).post(`/api/users/${target.id}/follow`).set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(409);
  });

  test('Following requires authentication', async () => {
    const { user: target } = await registerUser();
    const res = await request(app).post(`/api/users/${target.id}/follow`);
    expect(res.status).toBe(401);
  });

  test('A user can unfollow a previously followed user', async () => {
    const { token, user } = await registerUser();
    const { user: target } = await registerUser();

    await request(app).post(`/api/users/${target.id}/follow`).set('Authorization', `Bearer ${token}`);
    const unfollow = await request(app)
      .delete(`/api/users/${target.id}/follow`)
      .set('Authorization', `Bearer ${token}`);
    expect(unfollow.status).toBe(200);

    const following = await request(app).get(`/api/users/${user.id}/following`);
    expect(following.body.data.length).toBe(0);
  });

  test('Unfollowing a user not followed returns a conflict', async () => {
    const { token } = await registerUser();
    const { user: target } = await registerUser();

    const res = await request(app).delete(`/api/users/${target.id}/follow`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  test('GET /api/users/:id/following is paginated', async () => {
    const { token, user } = await registerUser();
    for (let i = 0; i < 3; i += 1) {
     
      const { user: target } = await registerUser();
      
      await request(app).post(`/api/users/${target.id}/follow`).set('Authorization', `Bearer ${token}`);
    }

    const res = await request(app).get(`/api/users/${user.id}/following?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(3);
  });
});
