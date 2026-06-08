# KaiChat

Inbox **omnichannel** para um lojista que opera sozinho — centraliza WhatsApp,
Instagram, Mercado Livre e Shopee num único lugar (Libredesk), com um PWA mobile
pra responder tudo pelo celular.

🔗 **Demo pública:** https://kaichat-kaisses.vercel.app/?demo

---

Este repositório tem duas partes:

- **Bridge** (raiz) — serviço Node.js que liga os canais ao Libredesk.
  Rode os testes com `npm test`. Visão geral em [CLAUDE.md](CLAUDE.md).
- **PWA** ([`web/`](web/)) — frontend React/Vite, publicado no Vercel.
  Ver [web/CLAUDE.md](web/CLAUDE.md).

Documentação: [docs/](docs/) (PRD, ERD, SDD, guias de deploy e o
[runbook de onboarding](docs/ONBOARDING.md)).
