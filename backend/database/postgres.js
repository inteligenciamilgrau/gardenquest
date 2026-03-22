const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

let pool;

function getConnectionString() {
  if (!config.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is not configured');
  }

  const parsed = new URL(config.SUPABASE_DB_URL);
  ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].forEach((parameterName) => {
    parsed.searchParams.delete(parameterName);
  });

  return parsed.toString();
}

function buildSslConfig() {
  if (!config.SUPABASE_DB_SSL) {
    return false;
  }

  const sslConfig = {
    rejectUnauthorized: true,
  };

  if (config.SUPABASE_DB_SSL_CA_PATH) {
    const resolvedCaPath = path.isAbsolute(config.SUPABASE_DB_SSL_CA_PATH)
      ? config.SUPABASE_DB_SSL_CA_PATH
      : path.resolve(process.cwd(), config.SUPABASE_DB_SSL_CA_PATH);

    if (!fs.existsSync(resolvedCaPath)) {
      throw new Error(`SUPABASE_DB_SSL_CA_PATH file not found: ${resolvedCaPath}`);
    }

    sslConfig.ca = fs.readFileSync(resolvedCaPath, 'utf8');
  }

  return sslConfig;
}

function normalizeLogCategory(category) {
  return category === 'game' ? 'game' : 'site';
}

function normalizeActorType(actorType) {
  return actorType === 'ai' ? 'ai' : 'player';
}

function getPool() {
  const connectionString = getConnectionString();

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: buildSslConfig(),
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pool.on('error', (error) => {
      console.error('Unexpected database pool error:', error.message);
    });
  }

  return pool;
}

async function verifyDatabaseConnection() {
  const database = getPool();
  await database.query('SELECT 1');

  const result = await database.query(
    `SELECT to_regclass('public.logs') AS "logsTable"`
  );

  if (!result.rows[0]?.logsTable) {
    throw new Error('logs table is missing. Run backend/database/supabase-schema.sql in Supabase.');
  }

  await database.query(
    `
      ALTER TABLE public.logs
      ADD COLUMN IF NOT EXISTS user_name text
    `
  );

  await database.query(
    `
      ALTER TABLE public.logs
      ADD COLUMN IF NOT EXISTS details text
    `
  );

  await database.query(
    `
      ALTER TABLE public.logs
      ADD COLUMN IF NOT EXISTS category text
    `
  );

  await database.query(
    `
      ALTER TABLE public.logs
      ALTER COLUMN category SET DEFAULT 'site'
    `
  );

  await database.query(
    `
      UPDATE public.logs
      SET category = CASE
        WHEN event LIKE 'ai_%'
          OR event LIKE 'player_%'
          OR event = 'suspicious_player_command'
          OR user_agent IN ('backend-ai', 'backend-game')
        THEN 'game'
        ELSE 'site'
      END
      WHERE category IS NULL OR category = ''
    `
  );

  await database.query(
    `
      CREATE INDEX IF NOT EXISTS idx_logs_category
      ON public.logs (category)
    `
  );

  await database.query(
    `
      CREATE TABLE IF NOT EXISTS public.game_scores (
        actor_id text not null,
        actor_type text not null,
        actor_name text,
        outfit_color text,
        current_score integer not null default 0,
        best_score integer not null default 0,
        deaths integer not null default 0,
        respawns integer not null default 0,
        last_death_reason text,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now()),
        primary key (actor_id, actor_type)
      )
    `
  );

  await database.query(
    `
      CREATE INDEX IF NOT EXISTS idx_game_scores_best_score
      ON public.game_scores (best_score DESC, updated_at DESC)
    `
  );

  await database.query(
    `
      CREATE INDEX IF NOT EXISTS idx_game_scores_actor_name
      ON public.game_scores (actor_name)
    `
  );

  await database.query(
    `
      ALTER TABLE public.game_scores
      ADD COLUMN IF NOT EXISTS outfit_color text
    `
  );

  await database.query(
    `
      ALTER TABLE public.game_scores
      ADD COLUMN IF NOT EXISTS soccer_goals integer not null default 0
    `
  );

  await database.query(
    `
      CREATE INDEX IF NOT EXISTS idx_game_scores_soccer_goals
      ON public.game_scores (soccer_goals DESC, updated_at DESC)
    `
  );
}

async function insertLog({
  event,
  ip = null,
  userAgent = null,
  userId = null,
  userName = null,
  details = null,
  category = 'site',
}) {
  await getPool().query(
    `
      INSERT INTO logs (event, ip, user_agent, user_id, user_name, details, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [event, ip, userAgent, userId, userName, details, normalizeLogCategory(category)]
  );
}

async function upsertGameScore({
  actorId,
  actorType,
  actorName = null,
  outfitColor = null,
  score = 0,
  bestScore = 0,
  deaths = 0,
  respawns = 0,
  lastDeathReason = null,
}) {
  await getPool().query(
    `
      INSERT INTO public.game_scores (
        actor_id,
        actor_type,
        actor_name,
        outfit_color,
        current_score,
        best_score,
        deaths,
        respawns,
        last_death_reason,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, timezone('utc', now()))
      ON CONFLICT (actor_id, actor_type)
      DO UPDATE SET
        actor_name = EXCLUDED.actor_name,
        outfit_color = EXCLUDED.outfit_color,
        current_score = EXCLUDED.current_score,
        best_score = EXCLUDED.best_score,
        deaths = EXCLUDED.deaths,
        respawns = EXCLUDED.respawns,
        last_death_reason = EXCLUDED.last_death_reason,
        updated_at = timezone('utc', now())
    `,
    [
      actorId,
      normalizeActorType(actorType),
      actorName,
      outfitColor,
      Math.max(0, Math.trunc(score)),
      Math.max(0, Math.trunc(bestScore)),
      Math.max(0, Math.trunc(deaths)),
      Math.max(0, Math.trunc(respawns)),
      lastDeathReason,
    ]
  );
}

async function getGameActorProfile(actorId, actorType = 'player') {
  const result = await getPool().query(
    `
      SELECT
        actor_name AS "actorName",
        outfit_color AS "outfitColor"
      FROM public.game_scores
      WHERE actor_id = $1 AND actor_type = $2
      LIMIT 1
    `,
    [actorId, normalizeActorType(actorType)]
  );

  if (result.rowCount < 1) {
    return null;
  }

  return {
    actorName: result.rows[0].actorName || null,
    outfitColor: result.rows[0].outfitColor || null,
  };
}

async function getTopGameScores(limit = 10) {
  const normalizedLimit = Math.max(1, Math.min(50, Math.trunc(limit) || 10));
  const result = await getPool().query(
    `
      SELECT
        actor_id AS "actorId",
        actor_type AS "actorType",
        actor_name AS "actorName",
        current_score AS "currentScore",
        best_score AS "bestScore",
        deaths,
        respawns,
        updated_at AS "updatedAt"
      FROM public.game_scores
      ORDER BY best_score DESC, updated_at ASC
      LIMIT $1
    `,
    [normalizedLimit]
  );

  return result.rows.map((row, index) => ({
    rank: index + 1,
    actorId: row.actorId,
    actorType: normalizeActorType(row.actorType),
    actorName: row.actorName || (row.actorType === 'ai' ? 'IA' : 'Jogador'),
    currentScore: Math.max(0, Math.trunc(row.currentScore || 0)),
    bestScore: Math.max(0, Math.trunc(row.bestScore || 0)),
    deaths: Math.max(0, Math.trunc(row.deaths || 0)),
    respawns: Math.max(0, Math.trunc(row.respawns || 0)),
    updatedAt: row.updatedAt,
  }));
}

async function incrementGameActorSoccerGoals({
  actorId,
  actorType = 'player',
  actorName = null,
  outfitColor = null,
}) {
  if (!actorId) {
    return;
  }

  await getPool().query(
    `
      INSERT INTO public.game_scores (
        actor_id,
        actor_type,
        actor_name,
        outfit_color,
        current_score,
        best_score,
        deaths,
        respawns,
        soccer_goals,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 1, timezone('utc', now()))
      ON CONFLICT (actor_id, actor_type)
      DO UPDATE SET
        actor_name = COALESCE(EXCLUDED.actor_name, public.game_scores.actor_name),
        outfit_color = COALESCE(EXCLUDED.outfit_color, public.game_scores.outfit_color),
        soccer_goals = public.game_scores.soccer_goals + 1,
        updated_at = timezone('utc', now())
    `,
    [
      actorId,
      normalizeActorType(actorType),
      actorName,
      outfitColor,
    ]
  );
}

async function getTopSoccerScorers(limit = 10) {
  const normalizedLimit = Math.max(1, Math.min(50, Math.trunc(limit) || 10));
  const result = await getPool().query(
    `
      SELECT
        actor_id AS "actorId",
        actor_type AS "actorType",
        actor_name AS "actorName",
        soccer_goals AS "soccerGoals",
        updated_at AS "updatedAt"
      FROM public.game_scores
      WHERE soccer_goals > 0
      ORDER BY soccer_goals DESC, updated_at ASC
      LIMIT $1
    `,
    [normalizedLimit]
  );

  return result.rows.map((row, index) => ({
    rank: index + 1,
    actorId: row.actorId,
    actorType: normalizeActorType(row.actorType),
    actorName: row.actorName || (row.actorType === 'ai' ? 'IA' : 'Jogador'),
    soccerGoals: Math.max(0, Math.trunc(row.soccerGoals || 0)),
    updatedAt: row.updatedAt,
  }));
}

async function getDashboardData() {
  const database = getPool();
  const [
    siteMetricsResult,
    gameMetricsResult,
    recentSiteLogsResult,
    recentGameLogsResult,
    uniqueVisitorsResult,
  ] = await Promise.all([
    database.query(
      `
        SELECT event, COUNT(*)::int AS count
        FROM logs
        WHERE category = 'site'
        GROUP BY event
        ORDER BY event ASC
      `
    ),
    database.query(
      `
        SELECT event, COUNT(*)::int AS count
        FROM logs
        WHERE category = 'game'
        GROUP BY event
        ORDER BY event ASC
      `
    ),
    database.query(
      `
        SELECT
          id,
          event,
          ip,
          user_agent AS "userAgent",
          user_id AS "userId",
          user_name AS "userName",
          details,
          category,
          created_at AS "timestamp"
        FROM logs
        WHERE category = 'site'
        ORDER BY created_at DESC
        LIMIT 50
      `
    ),
    database.query(
      `
        SELECT
          id,
          event,
          ip,
          user_agent AS "userAgent",
          user_id AS "userId",
          user_name AS "userName",
          details,
          category,
          created_at AS "timestamp"
        FROM logs
        WHERE category = 'game'
        ORDER BY created_at DESC
        LIMIT 50
      `
    ),
    database.query(
      `
        SELECT COUNT(DISTINCT ip)::int AS "uniqueVisitors"
        FROM logs
        WHERE category = 'site'
          AND ip IS NOT NULL AND ip <> ''
      `
    ),
  ]);

  return {
    siteMetrics: siteMetricsResult.rows.map((row) => ({
      event: row.event,
      count: Number(row.count) || 0,
    })),
    gameMetrics: gameMetricsResult.rows.map((row) => ({
      event: row.event,
      count: Number(row.count) || 0,
    })),
    recentSiteLogs: recentSiteLogsResult.rows,
    recentGameLogs: recentGameLogsResult.rows,
    uniqueVisitors: uniqueVisitorsResult.rows[0]?.uniqueVisitors || 0,
  };
}

module.exports = {
  getGameActorProfile,
  getTopGameScores,
  getTopSoccerScorers,
  getDashboardData,
  incrementGameActorSoccerGoals,
  insertLog,
  upsertGameScore,
  verifyDatabaseConnection,
};
