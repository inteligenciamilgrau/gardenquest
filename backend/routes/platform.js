const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { insertLog } = require('../database/postgres');
const { getGameBySlug, listGames, normalizeSlug } = require('../services/game-registry');

const AUTH_COOKIE_NAME = 'auth_token';
const PLATFORM_HUB_PATH = '/hub.html';
const PLATFORM_LOGIN_PATH = '/index.html';

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

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normalizePlatformEventName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,64}$/.test(normalizedValue)
    ? normalizedValue
    : null;
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

    const email = normalizeEmail(decoded?.email);

    return {
      id: userId,
      name: normalizeText(decoded?.name, 255),
      email,
      picture: normalizeText(decoded?.picture, 2048),
      isAdmin: Boolean(email) && config.ADMIN_GOOGLE_EMAILS.includes(email),
    };
  } catch (error) {
    return null;
  }
}

function buildBootstrapPayload(user) {
  return {
    platform: {
      name: 'Garden Quest Platform',
      hubPath: PLATFORM_HUB_PATH,
      loginPath: PLATFORM_LOGIN_PATH,
    },
    user,
    games: listGames(),
  };
}

function buildEventDetails({ gameSlug = null, details = null }) {
  const detailParts = [];

  if (gameSlug) {
    detailParts.push(`game=${gameSlug}`);
  }

  if (details) {
    detailParts.push(details);
  }

  return detailParts.join(' | ') || null;
}

function createPlatformRoutes() {
  const router = express.Router();

  router.use((req, res, next) => {
    const authenticatedUser = getAuthenticatedUser(req);

    if (!authenticatedUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.authUser = authenticatedUser;
    return next();
  });

  router.get('/bootstrap', (req, res) => {
    console.log(`[PLATFORM] Serving bootstrap for user: ${req.authUser?.name || 'unknown'}`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(buildBootstrapPayload(req.authUser));
  });

  router.get('/games', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ games: listGames() });
  });

  router.post('/events', async (req, res) => {
    const event = normalizePlatformEventName(req.body?.event);
    const gameSlug = normalizeSlug(req.body?.gameSlug);
    const details = normalizeText(req.body?.details, 512);

    console.log(`[EVENT] Track request: ${event} (Game: ${gameSlug || 'none'}) - User: ${req.authUser.id}`);

    if (!event) {
      console.warn('[EVENT] Invalid platform event received.');
      return res.status(400).json({ error: 'Invalid platform event.' });
    }

    if (req.body?.gameSlug && !gameSlug) {
      console.warn('[EVENT] Invalid game slug received.');
      return res.status(400).json({ error: 'Invalid game slug.' });
    }

    if (gameSlug && !getGameBySlug(gameSlug)) {
      console.warn(`[EVENT] Game not found for slug: ${gameSlug}`);
      return res.status(404).json({ error: 'Game not found.' });
    }

    try {
      await insertLog({
        event,
        ip: getRequestIp(req),
        userAgent: normalizeText(req.headers['user-agent'], 512) || '',
        userId: req.authUser.id,
        userName: req.authUser.name,
        details: buildEventDetails({ gameSlug, details }),
        category: gameSlug ? 'game' : 'site',
      });

      console.log(`[EVENT] Success: ${event} recorded.`);
      return res.status(201).json({ tracked: true });
    } catch (error) {
      console.error('[EVENT] Database log failed:', error.message);
      return res.status(500).json({ error: 'Unable to track platform event.' });
    }
  });

  return router;
}

module.exports = createPlatformRoutes;
