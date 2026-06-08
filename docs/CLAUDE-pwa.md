# CLAUDE.md — kaichat-pwa

> ℹ️ **Decisão atualizada:** o PWA passou a viver **neste mesmo repositório**, na
> pasta `web/` (monorepo) — não num repo separado. As instruções vivas estão em
> `web/CLAUDE.md`. Este documento permanece como **referência de design** (o
> "porquê" das escolhas) e segue válido; só o local da implementação mudou.
>
> Onde se lê "este repo"/"kaichat-pwa" abaixo, leia "a pasta `web/`".

---

## O que é este projeto

Frontend mobile PWA em React, hospedado no Vercel. Interface que o lojista
usa pelo celular para ler e responder mensagens de todos os canais
(WhatsApp, Instagram, Mercado Livre, Shopee) em um único lugar.

Faz parte do sistema "KaiChat" — este repo é a camada de apresentação.
Não processa mensagens nem faz polling — consome a API do Libredesk diretamente.

---

## Contexto de negócio

- **Usuário:** lojista de artigos personalizados, usa pelo celular
- **Problema que resolve:** visualizar e responder conversas de múltiplos canais sem trocar de app
- **Requisito chave:** mobile-first, instalável na homescreen como se fosse um app nativo

---

## Arquitetura — onde este repo se encaixa

```
[Bridge Service] → [Libredesk] ←── REST API ──── [Este repo — PWA]
                                                   Vercel
                                                   ↑
                                              lojista acessa
                                              pelo celular
```

O bridge alimenta o Libredesk com mensagens dos canais externos.
Este PWA apenas lê e responde via API do Libredesk — não tem backend próprio.

---

## Por que PWA e não app nativo

O Libredesk não prioriza mobile (confirmado pelo próprio desenvolvedor).
App nativo está fora do escopo v1. PWA instalável resolve 90% do problema:
fica na homescreen, tem ícone, funciona como app no browser.

---

## Stack

- **React 18 + Vite** — build estático, deploy automático no Vercel
- **Tailwind CSS** — mobile-first, telas de 375px+
- **vite-plugin-pwa** — gera manifest.json e service worker automaticamente
- **fetch nativo** — chamadas à API do Libredesk (sem biblioteca HTTP extra)

---

## Estrutura de pastas

```
kaichat-pwa/
├── src/
│   ├── api/
│   │   └── libredesk.js          # todas as chamadas à API do Libredesk
│   ├── components/
│   │   ├── ConversationList.jsx   # lista de conversas (tela principal)
│   │   ├── MessageThread.jsx      # thread ao abrir uma conversa
│   │   ├── ReplyBox.jsx           # campo de resposta fixo no rodapé
│   │   └── ChannelBadge.jsx       # ícone do canal (WA, IG, ML, Shopee)
│   ├── pages/
│   │   ├── Inbox.jsx              # tela principal
│   │   └── Conversation.jsx       # conversa aberta
│   ├── App.jsx
│   └── main.jsx
├── public/
│   ├── manifest.json              # nome, ícone, cor do PWA
│   └── icons/                     # ícones para homescreen
├── index.html
├── vite.config.js                 # inclui vite-plugin-pwa
├── tailwind.config.js
├── package.json
└── CLAUDE.md                      # este arquivo
```

---

## Autenticação

```
Primeira abertura:
  → tela de login pede a URL do Libredesk + API key
  → salva em localStorage
  → todas as chamadas usam: Authorization: Bearer {api_key}
```

Não há backend de autenticação próprio — a API key é do Libredesk.

---

## Principais chamadas à API do Libredesk

```javascript
// Listar conversas abertas
GET {LIBREDESK_URL}/api/v1/accounts/{id}/conversations?status=open

// Mensagens de uma conversa
GET {LIBREDESK_URL}/api/v1/accounts/{id}/conversations/{conv_id}/messages

// Enviar resposta
POST {LIBREDESK_URL}/api/v1/accounts/{id}/conversations/{conv_id}/messages
Body: { content: "texto" }

// Marcar como resolvida
PATCH {LIBREDESK_URL}/api/v1/accounts/{id}/conversations/{conv_id}
Body: { status: "resolved" }
```

⚠️ **Atenção:** estes endpoints são baseados no padrão Chatwoot e precisam ser
validados contra a documentação real do Libredesk antes de implementar.
Consultar: https://libredesk.io/docs ou o Swagger da instância (no VM Oracle Cloud).

---

## Aviso de CORS

O PWA chama a API do Libredesk de um domínio Vercel (ex: kaichat-pwa.vercel.app).
O Libredesk precisa ter CORS configurado para aceitar esse domínio.
Verificar/configurar isso na Fase 3 (deploy do Libredesk), antes de iniciar este repo.

---

## Comportamento PWA

- Instalável via "Adicionar à tela inicial" (iOS Safari e Android Chrome)
- Ícone na homescreen configurado em `public/manifest.json`
- Service worker para leitura offline de conversas já carregadas
- Cor da status bar do celular configurada no manifest

---

## Deploy

Push na branch `main` → Vercel detecta Vite automaticamente → build e deploy.
Variáveis de ambiente no dashboard Vercel:
- `VITE_LIBREDESK_URL` — URL pública da instância do Libredesk (no VM Oracle Cloud)

---

## Fase atual do projeto

- [x] Documentação (PRD, ERD, SDD)
- [ ] Fases 1-8 — Bridge Service (repo kaichat-bridge, concluir primeiro)
- [ ] **Fase 9 — Este repo** ← começa aqui depois do bridge funcionar
- [ ] Fase 11 — Testes end-to-end

---

## Repositório relacionado

`kaichat-bridge` — bridge Node.js no Oracle Cloud (Docker Compose).
Alimenta o Libredesk com mensagens dos canais externos.
Este PWA não depende do bridge diretamente — só do Libredesk estar no ar.
