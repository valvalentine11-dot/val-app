const { request, app, registerUser } = require('./helpers');

async function createPost(token, overrides = {}) {
  const res = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'A great post', content: 'Some content here', tags: ['tech'], ...overrides });
  return res;
}

describe('Post creation & ownership', () => {
  test('POST /api/posts requires authentication', async () => {
    const res = await request(app).post('/api/posts').send({ title: 'x', content: 'y' });
    expect(res.status).toBe(401);
  });

  test('POST /api/posts creates a post in published state', async () => {
    const { token } = await registerUser();
    const res = await createPost(token);
    expect(res.status).toBe(201);
    expect(res.body.post.state).toBe('published');
    expect(res.body.post.like_count).toBe(0);
    expect(res.body.post.comment_count).toBe(0);
  });

  test('POST /api/posts validates required fields', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/posts').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test('Published posts are visible in the public list', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    const postId = created.body.post._id;

    const list = await request(app).get('/api/posts');
    expect(list.body.data.find((p) => p._id === postId)).toBeDefined();

    const single = await request(app).get(`/api/posts/${postId}`);
    expect(single.status).toBe(200);
  });

  test('Owner can edit a published post; non-owner cannot', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    const postId = created.body.post._id;

    const edit = await request(app)
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title' });
    expect(edit.status).toBe(200);
    expect(edit.body.post.title).toBe('Updated title');

    const editAgain = await request(app)
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Updated content' });
    expect(editAgain.status).toBe(200);
    expect(editAgain.body.post.content).toBe('Updated content');

    const { token: otherToken } = await registerUser();
    const forbidden = await request(app)
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hacked' });
    expect(forbidden.status).toBe(403);
  });

  test('Owner can delete a post in either state; non-owner cannot', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    const postId = created.body.post._id;

    const { token: otherToken } = await registerUser();
    const forbidden = await request(app).delete(`/api/posts/${postId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app).delete(`/api/posts/${postId}`).set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);

    const getDeleted = await request(app).get(`/api/posts/${postId}`);
    expect(getDeleted.status).toBe(404);
  });
});

describe('Public post listing', () => {
  test('GET /api/posts returns only published posts, paginated, default 20 per page', async () => {
    const { token } = await registerUser();
    for (let i = 0; i < 3; i += 1) {
      const created = await createPost(token, { title: `Post ${i}` });
      await request(app).patch(`/api/posts/${created.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);
    }
    await createPost(token, { title: 'Still a draft' });

    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(20);
    expect(res.body.data.length).toBe(3);
    expect(res.body.data.every((p) => p.state === 'published')).toBe(true);
  });

  test('GET /api/posts supports custom pagination', async () => {
    const { token } = await registerUser();
    for (let i = 0; i < 5; i += 1) {
      const created = await createPost(token, { title: `Post ${i}` });
      await request(app).patch(`/api/posts/${created.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);
    }

    const res = await request(app).get('/api/posts?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.total).toBe(5);
  });

  test('GET /api/posts is searchable by title, tags, and author username', async () => {
    const { token, user } = await registerUser();
    const p1 = await createPost(token, { title: 'Learning Node.js', tags: ['node', 'javascript'] });
    const p2 = await createPost(token, { title: 'Cooking pasta', tags: ['food'] });
    await request(app).patch(`/api/posts/${p1.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);
    await request(app).patch(`/api/posts/${p2.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);

    const byTitle = await request(app).get('/api/posts?search=Node');
    expect(byTitle.body.data.length).toBe(1);
    expect(byTitle.body.data[0].title).toMatch(/Node/i);

    const byTag = await request(app).get('/api/posts?search=food');
    expect(byTag.body.data.length).toBe(1);

    const byAuthor = await request(app).get(`/api/posts?search=${user.username}`);
    expect(byAuthor.body.data.length).toBe(2);
  });

  test('GET /api/posts is orderable by like_count, comment_count, and timestamp', async () => {
    const { token } = await registerUser();
    const p1 = await createPost(token, { title: 'First' });
    const p2 = await createPost(token, { title: 'Second' });
    await request(app).patch(`/api/posts/${p1.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);
    await request(app).patch(`/api/posts/${p2.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);

    const { token: liker } = await registerUser();
    await request(app).post(`/api/posts/${p2.body.post._id}/like`).set('Authorization', `Bearer ${liker}`);

    const res = await request(app).get('/api/posts?sort=-like_count');
    expect(res.body.data[0]._id).toBe(p2.body.post._id);
  });

  test('GET /api/posts/:id returns the post with author information', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    await request(app).patch(`/api/posts/${created.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get(`/api/posts/${created.body.post._id}`);
    expect(res.status).toBe(200);
    expect(res.body.post.author.username).toBeDefined();
  });

  test('GET /api/posts/me returns only the owner posts', async () => {
    const { token } = await registerUser();
    const post1 = await createPost(token, { title: 'First post' });
    const post2 = await createPost(token, { title: 'Second post' });

    const { token: otherToken } = await registerUser();
    await createPost(otherToken, { title: 'Someone else post' });

    const all = await request(app).get('/api/posts/me').set('Authorization', `Bearer ${token}`);
    expect(all.body.data.length).toBe(2);
    expect(all.body.data.map((p) => p._id)).toContain(post1.body.post._id);
    expect(all.body.data.map((p) => p._id)).toContain(post2.body.post._id);
  });
});

describe('Likes', () => {
  test('A user can like and unlike a published post', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    await request(app).patch(`/api/posts/${created.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);

    const { token: liker } = await registerUser();
    const like = await request(app)
      .post(`/api/posts/${created.body.post._id}/like`)
      .set('Authorization', `Bearer ${liker}`);
    expect(like.status).toBe(200);
    expect(like.body.like_count).toBe(1);

    const unlike = await request(app)
      .delete(`/api/posts/${created.body.post._id}/like`)
      .set('Authorization', `Bearer ${liker}`);
    expect(unlike.status).toBe(200);
    expect(unlike.body.like_count).toBe(0);
  });

  test('A user cannot like the same post more than once', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    await request(app).patch(`/api/posts/${created.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);

    const { token: liker } = await registerUser();
    await request(app).post(`/api/posts/${created.body.post._id}/like`).set('Authorization', `Bearer ${liker}`);
    const secondLike = await request(app)
      .post(`/api/posts/${created.body.post._id}/like`)
      .set('Authorization', `Bearer ${liker}`);
    expect(secondLike.status).toBe(409);
  });

  test('Liking requires authentication', async () => {
    const { token } = await registerUser();
    const created = await createPost(token);
    await request(app).patch(`/api/posts/${created.body.post._id}/publish`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).post(`/api/posts/${created.body.post._id}/like`);
    expect(res.status).toBe(401);
  });
});
