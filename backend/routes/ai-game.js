const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { insertLog } = require('../database/postgres');
const { formatSuspicionDetails, validatePlayerCommandBody } = require('../games/garden-quest/command-security');

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

async function logSuspiciousCommand(req, user, issues) {
  const details = formatSuspicionDetails(issues);
  const ip = getRequestIp(req);
  const userAgent = normalizeText(req.headers['user-agent'], 512) || '';

  console.warn(`Suspicious player command blocked for user ${user?.id || 'unknown'}: ${details}`);

  try {
    await insertLog({
      event: 'suspicious_player_command',
      ip,
      userAgent,
      userId: user?.id || null,
      userName: user?.name || null,
      details,
      category: 'game',
    });
  } catch (error) {
    console.error('Suspicious command log failed:', error.message);
  }
}

function createAiGameRoutes(aiGameEngine) {
  const router = express.Router();

  router.use((req, res, next) => {
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.authUser = {
        id: normalizeText(decoded?.id, 128),
        name: normalizeText(decoded?.name, 255),
      };

      if (!req.authUser.id) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  router.get('/public-state', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(await aiGameEngine.getPublicState(req.authUser));
    } catch (error) {
      next(error);
    }
  });

  router.get('/bootstrap-state', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(await aiGameEngine.getBootstrapState());
    } catch (error) {
      next(error);
    }
  });

  router.post('/command', async (req, res) => {
    const validation = validatePlayerCommandBody(req.body, {
      chatMaxChars: config.PLAYER_CHAT_MAX_CHARS,
    });

    if (validation.suspiciousIssues.length > 0) {
      await logSuspiciousCommand(req, req.authUser, validation.suspiciousIssues);
      return res.status(400).json({ error: 'Seu comando nao pode ser processado com seguranca.' });
    }

    if (!validation.ok || !validation.normalizedCommand) {
      return res.status(400).json({ error: 'Comando invalido.' });
    }

    const result = await aiGameEngine.applyPlayerCommand(req.authUser, validation.normalizedCommand);

    if (!result?.ok) {
      return res.status(result?.statusCode || 400).json({
        error: result?.publicError || 'Nao foi possivel executar o comando.',
      });
    }

    return res.json(result);
  });

  return router;
}

module.exports = createAiGameRoutes;
