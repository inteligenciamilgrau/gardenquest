# Guia de Integração de Jogos para IA (Manual do Desenvolvedor)

Este documento descreve como preparar e integrar um novo jogo na plataforma "Inteligência Mil Grau", focando na consistência da experiência do usuário e na prevenção crítica de vazamento de memória (Memory Leaks).

## 1. O Papel da IA na Preparação

Como IA, seu objetivo ao integrar um jogo é garantir que ele "se sinta" parte do ecossistema original. Isso envolve:
-   **Análise de Contrato:** Verificar se as variáveis globais (`PLATFORM_GAME_CONFIG`) e os caminhos de API seguem o padrão.
-   **Ajuste Estético:** Adaptar cores de realce (`accentColor`) para o Hub.
-   **Proteção de Sessão:** Garantir que o jogo exija autenticação via `Platform.requireAuth`.

## 2. Checklist de Integração (Passo a Passo)

1.  **Registro no Backend:** Adicionar o novo `slug` em `backend/services/game-registry.js`.
2.  **Configuração de Frontend:** Criar o diretório `frontend/public/games/<slug>/`.
3.  **Configuração de API:** Criar o router em `backend/routes/games/<slug>.js`.
4.  **SDK Hook:** Incluir `platform-sdk.js` e configurar o objeto `window.PLATFORM_GAME_CONFIG`.

## 3. Prevenção de Memory Leaks: O "Nuclear Cleanup"

O maior desafio em jogos WebGL (Three.js/Babylon) é o resíduo de memória ao sair do jogo e voltar ao Hub. Se não for limpo, o navegador pode travar após 2 ou 3 sessões.

### Estratégia de Descarte Profundo (Deep Disposal)
Ao sair do jogo (botão "Voltar ao Hub"), você **DEVE** implementar uma função de limpeza que percorra todos os objetos da cena:
-   **Geometrias:** `geometry.dispose()`
-   **Materiais:** `material.dispose()`
-   **Texturas:** `material.map.dispose()` (se houver)
-   **Renderizadores:** `renderer.dispose()` e `renderer.forceContextLoss()`

### Forçar Perda de Contexto GPU
Para liberar VRAM instantaneamente, use a extensão `WEBGL_lose_context`:
```javascript
const gl = renderer.getContext();
const extension = gl.getExtension('WEBGL_lose_context');
if (extension) extension.loseContext();
```

### Navegação Limpa (Flatten History)
Para evitar que o Hub carregue sobre uma pilha de memória antiga:
-   Use `window.location.replace('/hub.html?ref=game_exit')` em vez de `href`. Isso "achata" o histórico.
-   No Hub, ao detectar `ref=game_exit`, chame `Platform.getBootstrap({ force: true })` para limpar estados globais obsoletos.

## 4. Problemas Eventuais e Soluções

| Problema | Causa Provável | Solução de IA |
| :--- | :--- | :--- |
| **Memória sobe mas não cai** | Renderizadores ou texturas não descartados. | Usar `renderer.dispose()` + `loseContext`. |
| **Interface do Hub trava** | `setInterval` ou `requestAnimationFrame` ficaram rodando. | Sempre chamar `cancelAnimationFrame` e `clearInterval` no `beforeunload`. |
| **"Sombras" de objetos sumindo** | Objetos removidos da lógica mas não da Cena. | Usar `parent.remove(object)` no nó correto da hierarquia. |
| **Erro de Referência (Null)** | Tentativa de atualizar objeto já destruído. | Nulificar todas as referências globais após a limpeza (`this.world = null`). |

## 5. Instrumentação de Eventos
Sempre adicione rastreamento para sabermos o engajamento:
```javascript
Platform.trackEvent({
    event: 'game_start',
    gameSlug: 'seu-slug',
    details: 'v=1.0.0'
});
```

Este guia garante que a plataforma continue leve, rápida e "premium" para o usuário final.
