# SDD — Software Design Document: Megachat Bridge
**Versão:** 0.3  
**Changelog:**
- v0.3 — Adicionado frontend mobile PWA (React/Vercel); arquitetura agora tem 4 serviços; seção 9 dedicada ao frontend; stack e deploy atualizados
- v0.2 — Evolution API adicionado como serviço dedicado WhatsApp; SDK oficial ML; webhook Evolution API; 3 serviços Railway

---

## 1. Visão geral da arquitetura

```
CANAIS EXTERNOS
WhatsApp | Instagram | Mercado Livre x2 | Shopee x2
   |           |              |                |
   v           |              |                |
[EVOLUTION     | Graph API    | SDK oficial    | HTTP
 API]          | polling 30s  | polling 30s    | polling 30s
(Railway)      |              |                |
   |           |              |                |
   | webhook   +--------------+----------------+
   +--------------------+
                        v
             [BRIDGE SERVICE]  <- voce constroi (Railway)
              Node.js
              connectors + libredesk client + SQLite DB
                        |
                        | REST API
                        v
             [LIBREDESK]        (Railway)
              backend, dados, webhooks de reply
                        |
                REST API|         webhook reply
                        |
                        v
             [FRONTEND MOBILE PWA]  <- voce constroi (Vercel)
              React + Tailwind
              Instalavel na homescreen do celular
                        |
                        v
             [LOJISTA]
              celular / browser
```

**4 servicos no total:**
- Railway #1: Libredesk (PostgreSQL + Redis inclusos)
- Railway #2: Evolution API (WhatsApp)
- Railway #3: Bridge Service (Node.js)
- Vercel: Frontend Mobile PWA (React estatico)

---

## 2. Componentes do bridge service

### 2.1 Estrutura de pastas

```
megachat-bridge/
├── src/
│   ├── connectors/
│   │   ├── whatsapp.js       # cliente HTTP para Evolution API
│   │   ├── instagram.js      # Meta Graph API (fetch nativo)
│   │   ├── mercadolivre.js   # SDK oficial mercadolibre npm
│   │   └── shopee.js         # Shopee Open Platform ou credencial
│   ├── libredesk/
│   │   └── client.js         # wrapper da API REST do Libredesk
│   ├── db/
│   │   ├── schema.js         # criação das tabelas SQLite
│   │   └── queries.js        # funções de acesso ao banco
│   ├── webhook/
│   │   ├── libredesk.js      # recebe replies do Libredesk
│   │   └── evolution.js      # recebe mensagens do Evolution API
│   ├── poller.js             # orquestra polling (Instagram, ML, Shopee)
│   └── index.js              # entry point — sobe Express + pollers
├── .env                      # credenciais (nunca commitado)
├── .env.example              # template de variáveis
├── package.json
└── README.md
```

### 2.2 Fluxo de entrada — WhatsApp (event-driven via Evolution API)

```
WhatsApp → Evolution API detecta mensagem
    → Evolution API dispara webhook POST /webhook/evolution
    → bridge identifica instância (evolution_instance_id)
    → busca ChannelAccount correspondente
    → verifica se ConversationMapping existe
        → NÃO: cria conversa no Libredesk → salva mapping
        → SIM: busca libredesk_conversation_id
    → envia mensagem para conversa no Libredesk
    → atualiza SyncState.last_synced_at
```

### 2.3 Fluxo de entrada — Instagram, ML, Shopee (polling)

```
node-cron dispara a cada 30s por conta
    → connector.fetchNewMessages(lastMessageId)
    → para cada mensagem nova:
        → verifica ConversationMapping
            → NÃO: cria conversa no Libredesk → salva mapping
            → SIM: busca libredesk_conversation_id
        → envia mensagem para Libredesk
    → atualiza SyncState.last_external_message_id
```

### 2.4 Fluxo de saída (lojista responde no Libredesk)

```
Lojista responde no Libredesk
    → Libredesk dispara webhook POST /webhook/libredesk
    → bridge busca ConversationMapping pelo libredesk_conversation_id
    → identifica channel_type da conta de origem
    → chama conector correto:
        → whatsapp: POST /message/sendText no Evolution API
        → instagram: POST /me/messages na Graph API
        → mercadolivre: POST /messages via SDK oficial
        → shopee: POST chat/send via Open Platform
```

---

## 3. Especificação dos conectores

### 3.1 Interface comum (todos os conectores implementam)

```javascript
// Cada conector exporta este contrato
{
  // Inicializa o conector (configura SDK, verifica token, etc.)
  async init(channelAccount),

  // Busca mensagens novas desde lastMessageId (não usado no WhatsApp)
  async fetchNewMessages(lastMessageId),

  // Envia resposta para uma conversa existente
  async sendMessage(externalConversationId, text),

  // Retorna informações do contato pelo ID externo
  async getContact(externalContactId)
}
```

### 3.2 WhatsApp — via Evolution API
- **Como funciona:** Evolution API roda como serviço separado e expõe REST API
- **Auth:** QR code gerado pela Evolution API no primeiro run; sessão gerenciada por ela
- **Recepção:** webhook em tempo real (não polling) — Evolution API chama `/webhook/evolution`
- **Envio:** `POST {EVOLUTION_URL}/message/sendText/{instance}` com o texto
- **Múltiplas contas:** cada número WhatsApp é uma "instância" no Evolution API
- **Repositório base:** github.com/EvolutionAPI/evolution-api

### 3.3 Instagram — Meta Graph API
- **Biblioteca:** fetch nativo (Graph API REST)
- **Auth:** OAuth 2.0 — token de longa duração (60 dias, renovável)
- **Polling:** `GET /me/conversations?fields=messages` a cada 30s
- **Pré-requisito:** app Meta aprovado com permissão `instagram_manage_messages`
- **Referência:** github.com/Regijur/mercado-livre-api-integration (padrão OAuth similar)

### 3.4 Mercado Livre — SDK oficial
- **Biblioteca:** `npm install mercadolibre` (github.com/mercadolibre/nodejs-sdk)
- **Auth:** OAuth 2.0 gerenciado pelo SDK — access token expira em 6h, refresh automático
- **Polling:** `GET /messages/packs` a cada 30s por conta
- **Contas:** 2 instâncias do conector com tokens independentes
- **Tutorial PT:** github.com/Anonimy/MercadoLivreApplication

### 3.5 Shopee
- **Opção A (preferida):** Shopee Open Platform — OAuth, API oficial de chat (`open.shopee.com`)
- **Opção B (fallback):** credenciais diretas — sessão HTTP autenticada (como o Olist faz)
- **Polling:** `GET /api/v2/sellerchat/get_message` a cada 30s por conta
- **Contas:** 2 instâncias do conector

---

## 4. Variáveis de ambiente (.env)

```
# Libredesk
LIBREDESK_URL=https://seu-libredesk.railway.app
LIBREDESK_API_KEY=xxxx

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://seu-evolution.railway.app
EVOLUTION_API_KEY=xxxx
EVOLUTION_WA_INSTANCE=megachat-wa-1   # nome da instância no Evolution API

# Encryption (para tokens ML, Instagram, Shopee no banco)
ENCRYPTION_KEY=32-char-random-string

# Mercado Livre
ML_APP_ID=xxxx
ML_APP_SECRET=xxxx
ML_ACCOUNT_1_REFRESH_TOKEN=xxxx
ML_ACCOUNT_2_REFRESH_TOKEN=xxxx

# Instagram
META_APP_ID=xxxx
META_APP_SECRET=xxxx
INSTAGRAM_ACCESS_TOKEN=xxxx

# Shopee (uma por conta)
SHOPEE_PARTNER_ID=xxxx
SHOPEE_PARTNER_KEY=xxxx
SHOPEE_ACCOUNT_1_TOKEN=xxxx
SHOPEE_ACCOUNT_2_TOKEN=xxxx

# Webhook
WEBHOOK_PORT=3000
WEBHOOK_SECRET=xxxx
```

---

## 5. Stack tecnológica

| Camada | Tecnologia | Hospedagem | Justificativa |
|---|---|---|---|
| Runtime backend | Node.js 20 LTS | Railway | Async nativo, ecossistema rico |
| Framework web | Express.js | Railway | Leve, para receber webhooks |
| Banco de dados bridge | SQLite (better-sqlite3) | Railway (volume persistente) | Sem servidor separado, suficiente para 1 cliente |
| WhatsApp | Evolution API | Railway (serviço próprio) | Gerencia sessão, QR e reconexão automaticamente |
| ML | mercadolibre npm SDK (oficial) | Railway | Mantido pelo próprio ML; absorve mudanças de API |
| Instagram | fetch nativo (Graph API) | Railway | REST puro, sem dependência extra |
| Shopee | fetch nativo (Open Platform) | Railway | Sem SDK oficial disponível |
| Scheduler | node-cron | Railway | Polling a cada 30s para Instagram, ML, Shopee |
| Frontend mobile | React 18 + Vite | Vercel | Build estático, nunca dorme, deploy automático via GitHub |
| Estilo mobile | Tailwind CSS | Vercel | Mobile-first utility classes, sem configuração de build extra |
| PWA | vite-plugin-pwa | Vercel | manifest.json + service worker gerados automaticamente |
| Backend helpdesk | Libredesk | Railway | PostgreSQL + Redis inclusos no template oficial |

---

## 6. Estratégia de erros e resiliência

- **Polling falhou:** incrementar error_count no SyncState; após 5 falhas consecutivas, marcar conta como 'error' e logar
- **Libredesk indisponível:** manter fila em memória por até 5 minutos antes de descartar
- **Token ML expirado:** SDK oficial tenta refresh automático; se falhar, marcar conta como 'disconnected'
- **Token Instagram expirado:** logar alerta 7 dias antes dos 60 dias; renovação manual por enquanto
- **Evolution API indisponível:** bridge loga erro e tenta de novo no próximo webhook; mensagens não perdidas pois ficam no WhatsApp
- **WhatsApp desconectado:** Evolution API tenta reconectar automaticamente; se falhar, gera novo QR code

---

## 7. Plano de deploy — 3 serviços Railway + 1 Vercel

```
Railway Project: megachat
├── Service 1: libredesk        (template oficial — PostgreSQL + Redis inclusos)
├── Service 2: evolution-api    (repo: github.com/EvolutionAPI/evolution-api)
└── Service 3: megachat-bridge  (repo seu — Node.js detectado automaticamente)

Vercel Project: megachat-pwa
└── megachat-pwa               (repo seu — React/Vite detectado automaticamente)
                               (deploy automático a cada push na branch main)
```

### Desenvolvimento local
```bash
# Terminal 1 — Libredesk
docker compose up libredesk   # localhost:9000

# Terminal 2 — Evolution API
docker compose up evolution   # localhost:8080

# Terminal 3 — Bridge
node src/index.js             # localhost:3000

# Terminal 4 — Expor bridge para webhooks (desenvolvimento)
ngrok http 3000
```

### Produção
Todas as variáveis de ambiente configuradas no dashboard Railway por serviço.
Os três serviços se comunicam via URLs internas do Railway (sem expor portas públicas desnecessárias).

---

## 8. Ordem de implementação sugerida

| Fase | O que construir | Hospedagem | Entregável |
|---|---|---|---|
| 1 | Criar repos GitHub + configurar Codespaces | GitHub | Ambiente de dev pronto |
| 2 | Setup: Node.js, Express, SQLite, schema do banco | Local/Codespaces | Projeto rodando |
| 3 | Deploy Libredesk no Railway + client.js | Railway | Inbox vazio no browser |
| 4 | Deploy Evolution API no Railway + QR code WhatsApp | Railway | WhatsApp conectado |
| 5 | Conector WhatsApp + webhook evolution.js | Railway | Mensagens WA no Libredesk |
| 6 | Webhook libredesk.js + sendMessage WA | Railway | Respostas saindo pelo WA |
| 7 | Conector Mercado Livre (SDK oficial) | Railway | Mensagens ML no inbox |
| 8 | Conector Instagram (Graph API) | Railway | Instagram no inbox |
| 9 | Frontend mobile PWA (React + Tailwind) | Vercel | Lojista usa pelo celular |
| 10 | Conector Shopee | Railway | Shopee no inbox |
| 11 | Testes end-to-end + ajustes mobile | — | Sistema completo em produção |

---


---

## 9. Frontend Mobile PWA — especificação

### 9.1 Estrutura de pastas

```
megachat-pwa/
├── src/
│   ├── api/
│   │   └── libredesk.js      # cliente HTTP para a API do Libredesk
│   ├── components/
│   │   ├── ConversationList.jsx  # lista de conversas na tela inicial
│   │   ├── MessageThread.jsx     # thread de mensagens ao abrir conversa
│   │   ├── ReplyBox.jsx          # campo de resposta fixo no rodapé
│   │   └── ChannelBadge.jsx      # ícone do canal (WA, IG, ML, Shopee)
│   ├── pages/
│   │   ├── Inbox.jsx             # tela principal — lista de conversas
│   │   └── Conversation.jsx      # tela de conversa aberta
│   ├── App.jsx
│   └── main.jsx
├── public/
│   ├── manifest.json         # configuração PWA (nome, ícone, cor)
│   └── icons/                # ícones para homescreen
├── index.html
├── vite.config.js            # inclui vite-plugin-pwa
├── tailwind.config.js
└── package.json
```

### 9.2 Fluxo de autenticação

```
Lojista abre o PWA pela primeira vez
  → tela de login pede API key do Libredesk
  → API key salva no localStorage
  → todas as chamadas usam Authorization: Bearer {api_key}
```

### 9.3 Principais chamadas à API do Libredesk

```javascript
// Listar conversas abertas
GET /api/v1/accounts/{id}/conversations?status=open

// Abrir thread de uma conversa
GET /api/v1/accounts/{id}/conversations/{conv_id}/messages

// Enviar resposta
POST /api/v1/accounts/{id}/conversations/{conv_id}/messages
{ content: "texto da resposta" }

// Marcar como resolvida
PATCH /api/v1/accounts/{id}/conversations/{conv_id}
{ status: "resolved" }
```

### 9.4 PWA — comportamento mobile

- Instalável via "Adicionar à tela inicial" no browser do celular
- Ícone personalizado na homescreen (como um app nativo)
- Funciona offline para leitura de conversas já carregadas (service worker)
- Tema de cor configurado no manifest.json (status bar do celular)

*Documentos relacionados: PRD-megachat.md, ERD-megachat.md*
