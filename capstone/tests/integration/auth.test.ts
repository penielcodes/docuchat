import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app'; // named import — matches how app.ts exports it
import { resetDatabase, createTestUser } from '../helpers/setup';

describe('POST /api/v1/auth/register', () => {
  // Clean database before every single test, so none of them can
  // accidentally depend on data left behind by a previous test.
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'SecurePass1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('new@example.com');
    // The password hash must NEVER be returned in an API response.
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Bad Email', email: 'not-an-email', password: 'SecurePass1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 for duplicate email', async () => {
    await createTestUser({ email: 'taken@example.com' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: 'taken@example.com', password: 'SecurePass1' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTestUser({ email: 'user@example.com' });
  });

  it('returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'TestPassword1!' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
  });
});

describe('Protected routes', () => {
  let accessToken: string;

  // Logs in fresh before each test to get a real, valid token to attach
  // to the requests below — this is testing the FULL chain: route ->
  // authenticate middleware -> handler, not a mock.
  beforeEach(async () => {
    await resetDatabase();
    await createTestUser({ email: 'user@example.com' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'TestPassword1!' });

    accessToken = login.body.data.accessToken;
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/protected-test');
    expect(res.status).toBe(401);
  });

  it('returns 200 with a valid token', async () => {
    const res = await request(app)
      .get('/api/protected-test')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });
});