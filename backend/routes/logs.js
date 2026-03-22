const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const config = require('../config');
const { getDashboardData, insertLog } = require('../database/postgres');
const AUTH_COOKIE_NAME = 'auth_token';

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.socket.remoteAddress || '';
  return rawIp.split(',')[0].trim();
}

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeLogCategory(value) {
  return value === 'game' ? 'game' : 'site';
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function getAuthenticatedUser(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const userId = normalizeText(decoded?.id, 128);

    if (!userId) {
      return null;
    }

    return {
      id: userId,
      name: normalizeText(decoded?.name, 255),
      email: normalizeEmail(decoded?.email),
    };
  } catch (error) {
    return null;
  }
}

function isAuthorizedDashboardUser(user) {
  return Boolean(user?.email) && config.ADMIN_GOOGLE_EMAILS.includes(user.email);
}

// POST /auth/logs/event
// We mount it on /auth just because the main router uses /auth but we can mount it on /api/logs
// It's better to mount it on /api/logs in server.js
// POST /api/v1/system/sync
router.post('/sync', async (req, res) => {
  const type = normalizeText(req.body?.type, 64);
  const category = normalizeLogCategory(req.body?.category);
  const authenticatedUser = getAuthenticatedUser(req);

  if (!type) {
    return res.status(400).json({ error: 'Config type is required' });
  }

  if (!authenticatedUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const ip = getRequestIp(req);
  const userAgent = normalizeText(req.headers['user-agent'], 512) || '';

  try {
    await insertLog({
      event: type,
      ip,
      userAgent,
      userId: authenticatedUser.id,
      userName: authenticatedUser.name,
      category,
    });

    res.status(201).json({ synced: true });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({ error: 'System error' });
  }
});

// GET /dashboard
// Return aggregated data for dashboard
router.get('/dashboard', async (req, res) => {
  const authenticatedUser = getAuthenticatedUser(req);

  if (!authenticatedUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAuthorizedDashboardUser(authenticatedUser)) {
    return res.status(403).json({
      error: 'Acesso negado para este email.',
      email: authenticatedUser.email || null,
    });
  }

  try {
    const finalData = await getDashboardData();
    res.json(finalData);
  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ error: 'Internal dashboard error' });
  }
});

module.exports = router;
