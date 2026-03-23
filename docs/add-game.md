# Adicionar Um Novo Jogo

Este projeto agora funciona como uma plataforma com:

- autenticacao centralizada no backend
- um hub de jogos em `frontend/public/hub.html`
- um SDK compartilhado em `frontend/public/js/platform-sdk.js`
- um catalogo de jogos no backend em `backend/services/game-registry.js`

O Garden Quest ja esta no formato canonico. Use-o como referencia para trazer o proximo jogo.

## Fluxo Da Plataforma

1. O usuario entra por `frontend/public/index.html`.
2. Depois do login Google, o backend redireciona para `/hub.html`.
3. O hub carrega `/api/v1/platform/bootstrap`.
4. Cada card abre um jogo registrado no catalogo.
5. O jogo usa `platform-sdk.js` para navegar de volta ao hub e reutilizar a sessao.

## Estrutura Minima

Para um novo jogo com slug `football-mania`, crie:

```text
frontend/public/games/football-mania/index.html
backend/routes/games/football-mania.js
```

E registre o jogo em:

```text
backend/services/game-registry.js
```

## Passo 1: Registrar O Jogo No Catalogo

Adicione uma entrada em `GAME_REGISTRY` com pelo menos:

```js
{
  slug: 'football-mania',
  name: 'Football Mania',
  tagline: 'Seu resumo curto para o hub.',
  description: 'Descricao mais completa para uso futuro.',
  route: '/games/football-mania/',
  status: 'active',
  visibility: 'public',
  accentColor: '#3b82f6',
  surfaceColor: '#0f172a',
  artworkLabel: 'FM',
  capabilities: ['score', 'multiplayer']
}
```

Campos importantes:

- `slug`: identificador canonico do jogo
- `route`: caminho usado pelo hub e pelo SDK
- `accentColor` e `surfaceColor`: cores do card no hub
- `capabilities`: badges exibidos no catalogo

## Passo 2: Criar A Pagina Do Jogo

Cada jogo deve ter um `index.html` proprio em `frontend/public/games/<slug>/`.

Use este bootstrap minimo:

```html
<script>
  window.PLATFORM_GAME_CONFIG = Object.freeze({
    slug: 'football-mania',
    name: 'Football Mania',
    gamePath: '/games/football-mania/',
    hubPath: '/hub.html',
    loginPath: '/index.html',
    apiBasePath: '/api/v1/games/football-mania',
    assetBasePath: '/',
  });
</script>
<script src="/js/config.js"></script>
<script src="/js/auth.js"></script>
<script src="/js/platform-sdk.js"></script>
```

Regras:

- `hubPath` deve continuar apontando para `/hub.html`
- `loginPath` deve continuar apontando para `/index.html`
- `apiBasePath` deve apontar para a API canonica do jogo
- `assetBasePath` deve apontar para a raiz onde seus assets compartilhados vivem

## Passo 3: Usar O SDK Da Plataforma

O SDK atual exposto em `window.Platform` cobre:

- `Platform.requireAuth({ redirectPath })`
- `Platform.getBootstrap()`
- `Platform.getUser()`
- `Platform.getGames()`
- `Platform.getGameBySlug(slug)`
- `Platform.openGame(slug)`
- `Platform.backToHub()`
- `Platform.logout()`
- `Platform.trackEvent({ event, gameSlug, details })`
- `Platform.getGameContext()`

Uso recomendado dentro de um jogo:

```js
const user = await Platform.requireAuth({ redirectPath: '/games/football-mania/' });
if (!user) return;

document.getElementById('backBtn').addEventListener('click', () => {
  Platform.backToHub();
});
```

Importante:

- nao use `localStorage` para identidade/autenticacao
- a verdade da sessao continua no cookie `httpOnly`
- para saber quem e o usuario atual, use o SDK ou `/auth/me`

## Passo 4: Criar A API Do Jogo

Monte a API do jogo em um router proprio:

```text
backend/routes/games/football-mania.js
```

Padrao recomendado:

```text
/api/v1/games/football-mania/bootstrap-state
/api/v1/games/football-mania/public-state
/api/v1/games/football-mania/command
```

Depois monte esse router em `backend/server.js`.

Se o jogo usar comandos `POST`, atualize tambem os limites e protecoes em:

```text
backend/middleware/security.js
```

## Passo 5: Integrar Navegacao E Instrumentacao

Todo jogo novo deve ter pelo menos:

- um botao ou acao para `Platform.backToHub()`
- um fluxo de login via `Platform.requireAuth()`
- eventos de navegacao via `Platform.trackEvent()`

Eventos uteis:

- `platform_game_launch`
- `platform_back_to_hub`
- `football_match_started`
- `football_goal_scored`

## Scores E Progresso

Nesta fase, o SDK esta focado em:

- sessao
- catalogo
- navegacao
- rastreamento de eventos

Persistencia generica de score e progresso ainda nao foi normalizada por `gameSlug`.

Antes de adicionar um `Platform.saveScore()`, alinhe o banco para suportar:

- `game_slug`
- tipo de score
- progresso por usuario e por jogo

Enquanto isso, cada jogo pode manter sua propria rota de persistencia no backend.

## Checklist Final

- registrar o jogo em `backend/services/game-registry.js`
- criar `frontend/public/games/<slug>/index.html`
- carregar `platform-sdk.js`
- criar rotas do jogo em `/api/v1/games/<slug>/...`
- adicionar botao de volta ao hub
- proteger o jogo com `Platform.requireAuth()`
- instrumentar eventos com `Platform.trackEvent()`

## O Que Evitar

- nao misture hub do usuario com dashboard admin
- nao crie subdominios por jogo nesta fase
- nao replique autenticacao em cada jogo
- nao use `iframe` como padrao para jogos com input intenso
- nao copie o estado do usuario para `localStorage` como fonte principal
