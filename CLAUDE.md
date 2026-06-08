# CLAUDE.md — megachat-bridge

> Este arquivo é lido automaticamente pelo Claude Code a cada sessão.
> Mantê-lo atualizado é responsabilidade do desenvolvedor.

---

## O que é este projeto

Bridge service em Node.js que centraliza mensagens de WhatsApp, Instagram,
Mercado Livre e Shopee num único inbox (Libredesk). Faz parte do sistema
"Megachat" — solução omnichannel para um lojista de artigos personalizados
que opera sozinho e precisa responder todos os canais pelo celular.

---

## Contexto de negócio

- **Cliente:** loja de artigos personalizados, operação solo, baixo volume
- **Problema:** 6 canais separados (2 ML, 2 Shopee, 1 Instagram, 1 WhatsApp)
- **Solução:** bridge que alimenta o Libredesk + PWA mobile no Vercel
- **Orçamento:** zero — tudo no free tier

---

## Arquitetura do sistema completo

```
Oracle Cloud VM (A1 Flex — 4 OCPUs, 24GB RAM — Always Free)
└── Docker Compose
    ├── WhatsApp → [Evolution API] → webhook → [Bridge] → [Libredesk]
    ├── Instagram ──── polling 30s ──────────→ [Bridge] → [Libredesk]
    ├── ML (SDK) ───── polling 30s ──────────→ [Bridge] → [Libredesk]
    └── Shopee ──────── polling 30s (P2) ────→ [Bridge] → [Libredesk]

[Libredesk] ←──── REST API ────── [PWA mobile] Vercel
                                   (lojista acessa pelo celular)
```

Este repositório é o **Bridge Service** — roda junto com os demais serviços
via Docker Compose no VM Oracle.

---

## Por que cada tecnologia foi escolhida

**Libredesk** (e não Chatwoot): Chatwoot free tier só tem live chat — WhatsApp e
Instagram exigem plano pago ($19/mês). Libredesk é 100% gratuito e tem API REST
completa com webhooks.

**Evolution API** (e não whatsapp-web.js direto): Mais maduro (5k+ stars), gerencia
sessão, QR code e reconexão automaticamente. whatsapp-web.js direto exigiria mais
código de manutenção.

**SDK oficial ML** (e não fetch manual): `npm install mercadolibre` — mantido pelo
próprio Mercado Livre, já tem OAuth e refresh de token implementados.

**Oracle Cloud Always Free** (e não Railway/Render/Fly): Railway virou trial de 30
dias. Render dorme após 15 min — WhatsApp cairia. Oracle oferece 4 OCPUs ARM +
24GB RAM permanentemente gratuitos, suficiente para rodar todos os serviços juntos
via Docker Compose.

**SQLite** (e não PostgreSQL para o bridge): Operação de 1 usuário, baixo volume.
SQLite sem servidor separado. O Libredesk usa seu próprio PostgreSQL (incluso no
Docker Compose). Migrar bridge para PostgreSQL no futuro não exige mudar o schema.

---

## Decisões que NÃO tomamos e por quê

- **Webhooks para ML/Instagram:** polling simples é suficiente para baixo volume
- **Banco de mensagens:** Libredesk já armazena — não duplicar
- **Multitenancy:** v1 é para um único lojista
- **Deploy local:** Oracle Cloud garante 24h de uptime sem depender do computador do cliente

---

## O que foi pesquisado e descartado

- **GoBots / Predize:** integram Shopee no Brasil mas cobram setup de R$2.000 — caro para este perfil
- **Zaapi:** plataforma asiática, incerto se funciona com contas .com.br da Shopee
- **Chatwoot fork:** backend em Ruby on Rails — stack diferente, manutenção de fork é custosa
- **Render.com:** dorme no free tier — inviável para Evolution API e Bridge
- **Railway:** virou trial de 30 dias em 2024 — não é mais free tier permanente
- **Fly.io:** free tier muito apertado (256MB/VM) para rodar Libredesk + PostgreSQL + Redis

---

## Avisos importantes

⚠️ **Shopee é P2:** deixar para depois de tudo funcionar. A API de chat requer
aprovação na Shopee Open Platform (processo burocrático). Fallback: credenciais
diretas como o Olist faz, mas com risco de bloqueio de conta.

⚠️ **Token ML expira em 6h:** ao contrário do que se supôs no início, o SDK
oficial **não** renova sozinho — só quando chamamos `refreshAccessToken`. Além
disso o ML rotaciona o `refresh_token` a cada uso (single-use). O conector
`src/connectors/mercadolivre.js` já trata isso: detecta o 401 de token expirado,
renova e **persiste** os tokens novos via `saveCredentials` (`src/db/queries.js`).
Sem persistir o refresh_token rotacionado, a renovação seguinte falharia.

⚠️ **WhatsApp ToS:** Evolution API usa sessão não-oficial. Usar com moderação,
sem envio em massa. Risco de ban existe mas é baixo-médio.

⚠️ **CORS no Libredesk:** o PWA mobile (Vercel) chama a API do Libredesk
diretamente. Confirmar configuração de CORS no Libredesk antes da fase 9.

---

## Estrutura de pastas

```
omnichannel-kaisses/          # este repositório
├── src/
│   ├── connectors/
│   │   ├── index.js          # registro central (composition root) — ALL e POLLED
│   │   ├── whatsapp.js       # cliente HTTP para Evolution API
│   │   ├── instagram.js      # Meta Graph API (fetch nativo)
│   │   ├── mercadolivre.js   # SDK oficial mercadolibre npm
│   │   └── shopee.js         # Shopee Open Platform (P2 — placeholder)
│   ├── libredesk/
│   │   └── client.js         # wrapper da API REST do Libredesk
│   ├── db/
│   │   ├── schema.js         # criação das tabelas SQLite
│   │   ├── queries.js        # funções de acesso ao banco
│   │   └── crypto.js         # AES-256-GCM p/ ChannelAccount.credentials (ENCRYPTION_KEY)
│   ├── webhook/
│   │   ├── libredesk.js      # recebe replies do Libredesk
│   │   ├── evolution.js      # recebe mensagens do Evolution API
│   │   └── oauth.js          # /oauth/start e /oauth/callback (code→token ML/Instagram)
│   ├── poller.js             # orquestra polling (Instagram, ML)
│   └── index.js              # entry point
├── scripts/
│   └── add-account.js        # onboarding: cria ChannelAccount (npm run add-account / accounts)
├── test/                     # suíte automatizada — `npm test` (node --test)
│   ├── helpers.js            # mocks e servidor HTTP efêmero compartilhados
│   ├── poller.test.js
│   ├── db/
│   │   ├── queries.test.js
│   │   └── crypto.test.js
│   ├── connectors/
│   │   ├── whatsapp.test.js
│   │   ├── instagram.test.js
│   │   ├── mercadolivre.test.js
│   │   └── shopee.test.js
│   └── webhook/
│       ├── evolution.test.js
│       ├── libredesk.test.js
│       └── oauth.test.js
├── docs/
│   ├── PRD-megachat.md
│   ├── ERD-megachat.md
│   ├── SDD-megachat.md
│   ├── DEPLOY-oracle.md      # guia passo a passo do deploy no Oracle Cloud
│   ├── DEPLOY-desktop.md     # alternativa: rodar no desktop (contornar a fila do Oracle)
│   └── CLAUDE-pwa.md         # referência de design do PWA (hoje em web/)
├── nginx/
│   └── nginx.conf            # reverse proxy (Libredesk na porta 80)
├── data/                     # banco SQLite (ignorado pelo git)
├── Dockerfile                # build do bridge para Docker
├── docker-compose.yml        # orquestra todos os serviços no Oracle Cloud
├── .env.example              # template de variáveis — EDITE AQUI
├── package.json
└── CLAUDE.md                 # este arquivo
```

---

## Banco de dados — 3 tabelas (SQLite)

**ChannelAccount** — uma linha por conta conectada (ex: "ML Conta 1", "WhatsApp")
**ConversationMapping** — mapeia ID externo → ID conversa no Libredesk (evita duplicatas)
**SyncState** — controla polling por conta (último ID processado, erros consecutivos)

Schema completo: ver `src/db/schema.js` ou `docs/ERD-megachat.md`

---

## Variáveis de ambiente necessárias

Ver `.env.example` na raiz. Nunca commitar `.env`.
Variáveis principais: LIBREDESK_URL, LIBREDESK_API_KEY, EVOLUTION_API_URL,
EVOLUTION_API_KEY, ML_APP_ID, ML_APP_SECRET, ENCRYPTION_KEY.

---

## Interface dos conectores

Todo conector é registrado em `src/connectors/index.js` (composition root —
único lugar que importa os módulos individuais; poller e webhook dependem só
desse índice). De lá saem dois agrupamentos, porque nem todo conector cumpre
o mesmo papel:

```javascript
// Contrato base — TODO conector implementa (registrado em ALL)
{
  async init(channelAccount),     // inicializa autenticação
  async sendMessage(convId, text),// envia resposta
  async getContact(contactId)     // info do contato
}

// Contrato de polling — só quem é orientado a polling implementa
// de verdade (registrado em POLLED: hoje instagram e mercadolivre)
{
  async fetchNewMessages(lastMsgId),  // busca mensagens novas desde o último ID
}
```

WhatsApp não implementa `fetchNewMessages` — recebe via webhook do Evolution
API, então esse método nunca seria chamado nele. Forçar uma implementação vazia
só para "cumprir a interface" é o tipo de violação de Interface Segregation que
preferimos evitar (ver `docs/SDD-megachat.md` seção 3.1 para mais contexto).

---

## Fase atual do projeto

- [x] Documentação (PRD, ERD, SDD)
- [x] Fase 1 — Setup repos GitHub + Codespaces
- [x] Fase 2 — Node.js, Express, SQLite, schema
- [ ] **Fase 3 — Setup Oracle Cloud VM + Docker Compose** ← PRÓXIMA (feito pelo desenvolvedor — ver docs/DEPLOY-oracle.md)
- [ ] Fase 4 — Deploy Evolution API + WhatsApp QR (feito pelo desenvolvedor)
- [ ] Fase 5 — Conector WhatsApp + webhook
- [ ] Fase 6 — Reply via WhatsApp
- [ ] Fase 7 — Conector Mercado Livre
- [ ] Fase 8 — Conector Instagram
- [ ] Fase 9 — Frontend PWA (pasta `web/` — monorepo; scaffold runnable já existe, ver `web/CLAUDE.md`)
- [ ] Fase 10 — Conector Shopee
- [ ] Fase 11 — Testes e produção (suíte unitária/integração do bridge já existe — `npm test`, ver `test/`; falta e2e + produção)

### Trabalho transversal já feito (fora da ordem das fases)

A Fase 3 depende do desenvolvedor provisionar o VM Oracle e hoje está travada por
falta de capacidade ("Out of host capacity" — há workflow de retry em
`.github/workflows/oracle-vm-retry.yml`). **Alternativa para destravar:** rodar o
mesmo stack Docker Compose no desktop do dev (sem mudança de código) — ver
`docs/DEPLOY-desktop.md`. Enquanto isso, adiantamos o que não depende do VM:

- **Suíte de testes:** `npm test` (node --test) — **94 testes**, cobrindo
  conectores, db, poller e webhooks. Ver `test/`.
- **CI:** `.github/workflows/ci.yml` roda a suíte do bridge + o build do `web/`
  a cada push na main e em todo PR.
- **Criptografia de `credentials`:** AES-256-GCM em `src/db/crypto.js`
  (`ENCRYPTION_KEY`). Lado de escrita pronto: `createAccount`/`saveCredentials`
  em `src/db/queries.js` cifram via `setCredentials`. Ver ERD e SDD §6.1.
- **Renovação de token do ML:** o conector detecta o 401 de token expirado,
  renova e persiste o `refresh_token` rotacionado (o SDK não faz isso sozinho).
- **Renovação de token do Instagram:** token de longa duração (~60d) sem
  refresh_token separado — o conector renova *proativamente* (grant
  `fb_exchange_token`) antes de expirar e persiste o novo + `expires_at`.
- **Validação de assinatura dos webhooks:** HMAC-SHA256 (`X-Libredesk-Signature`)
  em `src/webhook/libredesk.js`, com `WEBHOOK_SECRET`. Ver SDD §6.1.
- **Fluxo OAuth de ponta (código pronto):** `getAuthUrl`/`exchangeCode` nos
  conectores ML e Instagram + rotas `/oauth/start` e `/oauth/callback`
  (`src/webhook/oauth.js`) que trocam o `code` pelo token e persistem cifrado.
  **Falta só o end-to-end** (precisa do servidor exposto com `OAUTH_REDIRECT_URI`
  pública igual à registrada no app) — depende do VM/desktop.
- **Onboarding de contas:** `npm run add-account` (e `npm run accounts` p/ listar)
  — `scripts/add-account.js` cria a `ChannelAccount` cifrada; conta de OAuth nasce
  `disconnected` e o CLI imprime o link `/oauth/start` pra conectar.
- **PWA (Fase 9) em monorepo:** scaffold runnable em `web/` (Vite + React +
  Tailwind + vite-plugin-pwa) — `npm run build` passa. Cliente da API do
  Libredesk pronto (endpoints a validar). Deploy no Vercel com Root Directory =
  `web/`. Ver `web/CLAUDE.md`.

---

## Frontend PWA — no mesmo repo (monorepo)

Decidimos manter o PWA **neste repositório**, na pasta `web/` (e não num repo
separado). Frontend mobile React/Vite, publicado no Vercel com Root Directory =
`web/`. Consome a API REST do Libredesk diretamente (não passa pelo bridge).
Instruções vivas em `web/CLAUDE.md`; design original em `docs/CLAUDE-pwa.md`.

O bridge (raiz do repo) e o PWA (`web/`) têm deploys independentes: o bridge vai
pro Oracle via Docker; o `web/` vai pro Vercel. O `Dockerfile` do bridge só copia
`src/` e `package*.json`, então `web/` nunca entra na imagem do bridge.
