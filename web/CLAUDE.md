# CLAUDE.md — kaichat-pwa (pasta `web/` do monorepo)

> Frontend mobile do KaiChat. Vive em `web/` deste repositório (monorepo) e é
> publicado no Vercel apontando o **Root Directory** para `web/`. O backend
> (bridge Node + Libredesk) fica na raiz do repo e roda no Oracle Cloud.
> Referência de design original: `../docs/CLAUDE-pwa.md`.

---

## O que é

PWA em React/Vite que o lojista usa pelo celular para ler e responder mensagens
de todos os canais (WhatsApp, Instagram, Mercado Livre, Shopee) em um só lugar.
Não tem backend próprio nem faz polling — consome a **API REST do Libredesk
diretamente** (o bridge é quem alimenta o Libredesk).

```
[Bridge] → [Libredesk] ←── REST API ──── [web/ — este PWA] (Vercel)
                                           ↑ lojista, pelo celular
```

---

## Stack

- **React 18 + Vite** — build estático
- **Tailwind CSS** — mobile-first (telas de 375px+)
- **vite-plugin-pwa** — manifest + service worker (instalável na homescreen)
- **fetch nativo** — sem biblioteca HTTP extra. Roteamento por estado (3 telas,
  1 usuário) — sem react-router, mantendo as dependências enxutas.

---

## Estrutura

```
web/
├── src/
│   ├── api/libredesk.js        # ÚNICA camada que fala com o Libredesk
│   ├── components/             # ConversationList, MessageThread, ReplyBox, ChannelBadge
│   ├── pages/                  # Login, Inbox, Conversation
│   ├── App.jsx                 # roteamento por estado (login → inbox → conversa)
│   └── main.jsx
├── public/                     # favicon.svg, icons/
├── index.html
├── vite.config.js              # inclui VitePWA
├── tailwind.config.js
└── package.json
```

---

## Rodar

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # gera web/dist (o que o Vercel publica)
```

Autenticação: a tela de login pede URL + API key + accountId do Libredesk e
guarda no `localStorage`. Não há backend de auth próprio — a API key é a do
Libredesk. `VITE_LIBREDESK_URL` (opcional) só pré-preenche o campo da URL.

---

## ⚠️ Pendências conhecidas (antes de produção — Fase 9/11)

- **Endpoints a validar:** os caminhos em `src/api/libredesk.js` seguem o padrão
  Chatwoot e PRECISAM ser conferidos contra a API real do Libredesk
  (https://libredesk.io/docs ou o Swagger da instância). Estão centralizados num
  arquivo só de propósito — ajustar é trivial quando a API for confirmada.
- **CORS:** o Libredesk precisa aceitar o domínio do Vercel (ex:
  `*.vercel.app`). Configurar no deploy do Libredesk (Fase 3).
- **Ícones PNG:** o manifest usa SVG (cobre Android/desktop). iOS na homescreen
  exige PNG 192x192 e 512x512 — gerar antes da Fase 11.
- **Testes:** `npm test` (Vitest + jsdom + Testing Library) cobre o cliente da
  API (`src/api/libredesk.js`) e o `ChannelBadge`. Falta cobrir as páginas
  (Inbox/Conversation) quando o fluxo com dados reais for definido.

---

## Deploy (Vercel) — JÁ NO AR

Demo pública: **https://omnichannel-kaisses.vercel.app** (`/?demo` entra direto).

- Projeto `omnichannel-kaisses` (time "kaisses' projects"), **conectado ao Git**:
  todo push na `main` re-deploya sozinho.
- O build sai do `vercel.json` na **raiz** do repo (não usa Root Directory):
  install `npm --prefix web ci`, build `npm --prefix web run build`, output
  `web/dist`, framework null. `.vercelignore` ancora os paths do bridge com `/`.
- Deploy manual (se precisar): `vercel deploy --prod --yes` da raiz do repo.
- Ver memória `reference_vercel_demo_deploy` para detalhes (ex: a Deployment
  Protection foi desligada pra ficar público).

---

## Repositório relacionado

O **bridge** está na raiz deste mesmo repo (`../src`, `../docs`), roda no Oracle
Cloud e alimenta o Libredesk. Este PWA não depende do bridge diretamente — só
do Libredesk estar no ar.
