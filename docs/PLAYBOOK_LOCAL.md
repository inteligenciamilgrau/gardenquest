# Playbook Local - GardenQuest

Este playbook descreve o procedimento completo para subir a aplicacao localmente.

## 1. Objetivo

Subir ambiente funcional com:

- Banco PostgreSQL local
- Backend API
- Worker de processamento do runtime
- Frontend estatico

No fim, o fluxo `index -> hub -> game` deve funcionar.

## 2. Pre-requisitos

- Node.js 20+
- npm 10+
- Docker + Docker Compose
- Python 3
- `psql` (opcional, mas recomendado)

## 3. Preparar variaveis de ambiente

1. Copie o arquivo base:

```bash
cp .env.local.example .env.local
```

2. Ajuste no minimo:

```env
APP_ENV=local
NODE_ENV=development
PORT=8080
FRONTEND_URL=http://localhost:5500
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/callback
JWT_SECRET=troque-por-um-segredo-forte
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:5432/gardenquest_dev
SUPABASE_DB_SSL=false
ADMIN_GOOGLE_EMAILS=seu-email@dominio.com
```

3. Se quiser IA real de NPC, configure:

```env
OPENAI_API_KEY=...
```

4. Valide o ambiente:

```bash
npm --prefix backend run check:env
```

## 4. Subir banco local

```bash
docker compose -f docker-compose.local.yml up -d
```

Aplicar schema canonico:

```bash
psql "$SUPABASE_DB_URL" -f backend/database/supabase-schema.sql
```

Se nao tiver `psql`, execute pelo container:

```bash
docker exec -i gardenquest-postgres psql -U postgres -d gardenquest_dev < backend/database/supabase-schema.sql
```

## 5. Instalar dependencias

```bash
npm --prefix backend install
```

## 6. Subir backend (modo recomendado)

Terminal 1:

```bash
npm --prefix backend run start:api
```

Terminal 2:

```bash
npm --prefix backend run start:worker
```

Observacao:
- Para modo monolitico legado: `npm --prefix backend run start:legacy`

## 7. Subir frontend

Terminal 3:

```bash
cd frontend/public
python3 -m http.server 5500
```

Abra no navegador:

- `http://localhost:5500`

Se a API rodar em outra porta:

- `http://localhost:5500/?api=http://localhost:18080`

## 8. Smoke test funcional

1. Abrir `index.html`
2. Fazer login Google
3. Confirmar redirecionamento para `hub.html`
4. Clicar em `Abrir jogo`
5. Confirmar carregamento de `games/garden-quest/`
6. Testar `Voltar ao hub`
7. Abrir `dashboard.html` (somente admin allowlist)

## 9. Validacoes tecnicas

```bash
npm --prefix backend run check:env
npm --prefix backend run test:tasks
npm --prefix backend run test:routes
npm --prefix backend run test:integration
```

Opcional E2E:

```bash
E2E_BASE_URL=http://127.0.0.1:5500 npm --prefix backend run test:e2e
```

## 10. Troubleshooting rapido

- `401/403 no dashboard`:
  - validar `ADMIN_GOOGLE_EMAILS`
  - reiniciar API apos trocar `.env.local`

- `sem atualizacao em tempo real`:
  - validar se `start:worker` esta ativo
  - validar conectividade com banco

- `erro de callback OAuth`:
  - revisar `GOOGLE_REDIRECT_URI`
  - revisar configuracao do cliente OAuth no Google Cloud

- `frontend aponta para API errada`:
  - abrir com `?api=...`
  - ou limpar no console:

```js
localStorage.removeItem('img_platform_api_url');
localStorage.removeItem('gardenquest.localApiUrl');
```

## 11. Encerrar ambiente

Parar processos locais:

- `Ctrl+C` nos terminais da API/Worker/frontend

Parar banco:

```bash
docker compose -f docker-compose.local.yml down
```
