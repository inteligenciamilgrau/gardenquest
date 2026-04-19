const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const createAuthRoutes = require('../../routes/auth');
const config = require('../../config');

function createApp({ remoteAddress = null } = {}) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  if (remoteAddress) {
    app.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', {
        value: remoteAddress,
        configurable: true,
      });
      next();
    });
  }
  app.use('/auth', createAuthRoutes());
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message });
  });
  return app;
}

test('GET /auth/google redirects to OAuth provider and sets state cookie', async () => {
  const app = createApp();

  const response = await request(app).get('/auth/google').query({ redirect: '/hub.html' });

  assert.equal(response.status, 302);
  assert.match(response.headers.location || '', /accounts\.google\.com/);

  const setCookie = response.headers['set-cookie'] || [];
  assert.ok(setCookie.some((entry) => String(entry).startsWith('oauth_state=')));
});

test('GET /auth/callback without code redirects with no_code error', async () => {
  const app = createApp();

  const response = await request(app).get('/auth/callback');

  assert.equal(response.status, 302);
  assert.match(response.headers.location || '', /error=no_code$/);
});

test('GET /auth/me without session returns 401', async () => {
  const app = createApp();

  const response = await request(app).get('/auth/me');

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Invalid, expired, or revoked session');
});

test('GET /auth/dev-mode returns local dev defaults only for loopback requests', async () => {
  const previousEnv = config.APP_ENV;
  config.APP_ENV = 'local';

  try {
    const app = createApp({ remoteAddress: '127.0.0.1' });
    const response = await request(app).get('/auth/dev-mode');

    assert.equal(response.status, 200);
    assert.equal(response.body.devLoginEnabled, true);
    assert.equal(response.body.defaultName, 'Dev User');
    assert.equal(response.body.defaultEmail, 'dev@localhost');
  } finally {
    config.APP_ENV = previousEnv;
  }
});

test('GET /auth/dev-mode returns 404 for non-loopback requests', async () => {
  const previousEnv = config.APP_ENV;
  config.APP_ENV = 'local';

  try {
    const app = createApp({ remoteAddress: '203.0.113.10' });
    const response = await request(app).get('/auth/dev-mode');
    assert.equal(response.status, 404);
  } finally {
    config.APP_ENV = previousEnv;
  }
});
