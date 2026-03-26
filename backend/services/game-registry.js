const GAME_REGISTRY = Object.freeze([
  Object.freeze({
    slug: 'garden-quest',
    name: 'Garden Quest',
    tagline:
      'Explore um jardim vivo, converse com outros jogadores e dispute os recordes do servidor.',
    description:
      'Aventura 3D multiplayer com perfil persistente, chat, ranking e simulacao sincronizada pelo backend.',
    route: '/games/garden-quest/',
    legacyRoute: '/game.html',
    status: 'active',
    visibility: 'public',
    accentColor: '#38bd7e',
    surfaceColor: '#10261b',
    artworkLabel: 'GQ',
    capabilities: ['profile', 'leaderboard', 'chat', 'persistent-world'],
  }),
]);

function normalizeSlug(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return /^[a-z0-9-]{2,64}$/.test(normalizedValue) ? normalizedValue : null;
}

function listGames() {
  return GAME_REGISTRY.map((game) => ({ ...game }));
}

function getGameBySlug(slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const match = GAME_REGISTRY.find((game) => game.slug === normalizedSlug);
  return match ? { ...match } : null;
}

module.exports = {
  getGameBySlug,
  listGames,
  normalizeSlug,
};
