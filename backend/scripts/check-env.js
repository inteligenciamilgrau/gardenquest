const config = require('../config');

const summary = {
  appEnv: config.APP_ENV,
  nodeEnv: config.NODE_ENV,
  loadedEnvFiles: config.LOADED_ENV_FILES,
  frontendUrl: config.FRONTEND_URL || '(unset)',
  googleRedirectUri: config.GOOGLE_REDIRECT_URI || '(unset)',
  cookieSecure: config.COOKIE_SECURE,
  cookieSameSite: config.COOKIE_SAME_SITE,
  supabaseDbSsl: config.SUPABASE_DB_SSL,
  adminAllowlistCount: config.ADMIN_GOOGLE_EMAILS.length,
  hasGoogleClientId: Boolean(config.GOOGLE_CLIENT_ID),
  hasGoogleClientSecret: Boolean(config.GOOGLE_CLIENT_SECRET),
  hasJwtSecret: Boolean(process.env.JWT_SECRET),
  hasSupabaseDbUrl: Boolean(config.SUPABASE_DB_URL),
  hasOpenAiApiKey: Boolean(config.OPENAI_API_KEY),
};

console.log(JSON.stringify(summary, null, 2));
