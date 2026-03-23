const express = require('express');
const { setupSecurity } = require('./middleware/security');
const createAuthRoutes = require('./routes/auth');
const createAiGameRoutes = require('./routes/ai-game');
const createPlatformRoutes = require('./routes/platform');
const config = require('./config');
const { verifyDatabaseConnection } = require('./database/postgres');
const { AiGameEngine } = require('./game/engine');

const app = express();
const aiGameEngine = new AiGameEngine();

// Trust Cloud Run proxy for secure cookies
app.set('trust proxy', 1);

// Server-side Heartbeat to confirm process is alive
if (config.NODE_ENV === 'development' || config.APP_ENV === 'local') {
    setInterval(() => {
        console.log(`[SERVER-HEARTBEAT] ⚙️ Alive at ${new Date().toLocaleTimeString()} (RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB)`);
    }, 2000);
}

// Enhanced Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const referer = req.headers.referer || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  
  // Log request start
  if (config.NODE_ENV === 'development') {
    console.log(`>>> [REQUISICAO] ${req.method} ${req.url} [Referer: ${referer}]`);
  }

  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (config.NODE_ENV === 'development') {
        console.log(`<<< [RESPOSTA] ${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
});

// Root handler to avoid 404 in logs
app.get('/', (req, res) => {
    res.json({ message: 'IMG Backend Root', status: 'ready' });
});

// Security middleware
setupSecurity(app);

// Body parser
app.use(express.json({ limit: '16kb' }));

// Routes
const systemRoutes = require('./routes/logs');
const aiGameRoutes = createAiGameRoutes(aiGameEngine);
app.use('/auth', createAuthRoutes({ gameEngine: aiGameEngine }));
app.use('/api/v1/platform', createPlatformRoutes());
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/ai-game', aiGameRoutes);
app.use('/api/v1/games/garden-quest', aiGameRoutes);

// Health check (Cloud Run requirement)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  console.warn(`[404] Resource not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    await verifyDatabaseConnection();
    console.log('Database connection established.');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }

  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${config.PORT}`);
    console.log(`Runtime mode: ${config.NODE_ENV}`);
    console.log(`App environment: ${config.APP_ENV}`);
    if (config.LOADED_ENV_FILES.length > 0) {
      console.log(`Loaded env files: ${config.LOADED_ENV_FILES.join(', ')}`);
    }
    console.log(`Frontend URL: ${config.FRONTEND_URL || '(unset)'}`);
    console.log(`AI player: ${config.AI_GAME_ENABLED ? 'enabled' : 'disabled'}`);

    if (!config.GOOGLE_CLIENT_ID) {
      console.error('WARNING: GOOGLE_CLIENT_ID is not set. Google Login will not work.');
    } else {
      console.log(`GOOGLE_CLIENT_ID loaded (ends with ${config.GOOGLE_CLIENT_ID.slice(-10)})`);
    }

    aiGameEngine.start();
  });
}

process.on('SIGINT', () => {
  aiGameEngine.stop();
});

process.on('SIGTERM', () => {
  aiGameEngine.stop();
});

startServer();
