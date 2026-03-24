# Guia de Desenvolvimento e Integração (IMG Platform)

Este documento é a fonte única de verdade para criar e integrar novos jogos na plataforma. Ele cobre a arquitetura modular (Full-Stack Isolation) e as melhores práticas de performance.

## 1. Arquitetura Modular (Soberania)

Cada jogo deve ser um módulo independente, pronto para ser movido para seu próprio repositório Git.

### Estrutura de Pastas
- **Frontend**: `frontend/public/games/[slug]/`
  - Deve conter `index.html`, `js/`, `css/` e `assets/`.
  - **Obrigatório**: Incluir `platform-sdk.js` localmente.
- **Backend**: `backend/games/[slug]/`
  - Deve conter `engine.js` (lógica), `command-security.js` e `world-definition.js`.

---

## 2. Integração de Repositórios Externos

Para manter um jogo em um repositório Git separado e "encaixá-lo" na plataforma, a estrutura recomendada no repositório do jogo é:
```text
meu-jogo-repo/
  ├── web/      (Conteúdo que vai para frontend/public/games/)
  └── api/      (Conteúdo que vai para backend/games/)
```

### Como "Montar" o jogo na Plataforma:
No repositório da Plataforma, você pode usar **Links Simbólicos (Symlinks)** para mapear as pastas sem precisar duplicar código:
1. Adicione o jogo como um submódulo em uma pasta temporária: `git submodule add [URL] external/meu-jogo`
2. Crie os links:
   - `mklink /D frontend\public\games\meu-jogo ..\..\..\external\meu-jogo\web` (Windows)
   - `mklink /D backend\games\meu-jogo ..\..\external\meu-jogo\api` (Windows)

Dessa forma, um único Git externo alimenta as duas pastas necessárias na plataforma.

---

## 3. Passo a Passo de Integração (Local)

1.  **Registro no Catálogo**: Adicione o jogo em `backend/services/game-registry.js`.
2.  **Criação das Pastas**: Crie as estruturas mencionadas no item 1.
3.  **Configuração do Frontend**: No `index.html` do jogo, configure o `window.PLATFORM_GAME_CONFIG`:
    ```javascript
    window.PLATFORM_GAME_CONFIG = {
        slug: 'meu-jogo',
        apiBasePath: '/api/v1/games/meu-jogo',
        // ... caminhos para login e hub
    };
    ```
4.  **Montagem do Backend**: No `backend/server.js`, importe o motor e monte a rota:
    ```javascript
    const { MeuEngine } = require('./games/meu-jogo/engine');
    const meuEngine = new MeuEngine();
    app.use('/api/v1/games/meu-jogo', createAiGameRoutes(meuEngine));
    ```

---

## 3. Performance e Banco de Dados (Supabase)

> [!IMPORTANT]
> **NÃO grave no banco em tempo real** para ações frequentes (score, comida, movimento).

-   **Throttling**: Chame `persistActorStats` apenas na **Morte do Player** ou no **Logout**.
-   **Logs**: Silencie logs de ações repetitivas. Use `logEvent` apenas para eventos críticos.
-   **Heartbeat**: O heartbeat do servidor deve ser baixo (ex: 60s) para evitar ruído.

---

## 4. Prevenção de Memory Leaks

WebGL exige limpeza profunda ao sair do jogo:
-   **Deep Disposal**: Percorra geometrias, materiais e texturas chamando `.dispose()`.
-   **Context Loss**: Use `WEBGL_lose_context` para liberar a GPU imediatamente.
-   **Navegação**: Use `window.location.replace('/hub.html?ref=game_exit')` para achatar o histórico.

---

## 5. SDK da Plataforma (`Platform`)

Use as funções globais para manter a consistência:
-   `Platform.requireAuth()`: Garante que o usuário está logado.
-   `Platform.backToHub()`: Retorna ao Hub limpando a sessão.
-   `Platform.trackEvent()`: Registra métricas de engajamento.

Este guia garante que a plataforma continue leve, modular e expansível.
