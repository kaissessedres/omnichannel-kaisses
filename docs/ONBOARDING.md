# ONBOARDING — do servidor no ar até o lojista usando

> Roteiro único de primeira configuração. Costura, em ordem, o que está
> espalhado por outros docs/scripts. Siga de cima pra baixo — cada passo tem um
> "deu certo?" pra conferir antes de seguir.
>
> **Quem faz:** você/dev (passos 1–4, uma vez). **Lojista:** só o passo 5.
> **Pré-requisito:** o stack já no ar (Fase 3) — ver `DEPLOY-oracle.md` (VM) ou
> `DEPLOY-desktop.md` (desktop). Tudo abaixo roda depois que `docker compose ps`
> mostra libredesk, evolution, bridge, postgres, redis e nginx `Up`/`healthy`.

---

## 0. Antes de começar — `.env` preenchido

No diretório do projeto, o `.env` (copiado de `.env.example`) precisa ter pelo
menos:

```env
POSTGRES_PASSWORD=...           # senha do banco do Libredesk
EVOLUTION_API_KEY=...           # chave do Evolution API
ENCRYPTION_KEY=...              # 64 hex — gere: openssl rand -hex 32
WEBHOOK_SECRET=...              # opcional, recomendado (assina os webhooks)
OAUTH_REDIRECT_URI=https://SEU-DOMINIO/oauth/callback   # URL PÚBLICA (p/ ML/Instagram)
# por canal (preencha conforme for conectando):
ML_APP_ID=...  ML_APP_SECRET=...
META_APP_ID=... META_APP_SECRET=...
SHOPEE_PARTNER_ID=... SHOPEE_PARTNER_KEY=...   # só na Fase 10
```

> `LIBREDESK_API_KEY` e `LIBREDESK_ACCOUNT_ID` ficam vazios por enquanto — você
> preenche no passo 1. Depois de editar o `.env`: `docker compose restart bridge`.

---

## 1. Configurar o Libredesk

1. Acesse o painel: `http://SEU-IP` (ou seu domínio). Crie a **conta admin**.
2. Crie **um Inbox por canal/conta** (tipo *API*) e **anote o Inbox ID** de cada
   (aparece na URL `…/inboxes/<id>`):

   | Canal/conta | Sugestão de nome | Inbox ID |
   |---|---|---|
   | WhatsApp | "WhatsApp" | ____ |
   | Instagram | "Instagram" | ____ |
   | Mercado Livre 1 | "Mercado Livre 1" | ____ |
   | Mercado Livre 2 | "Mercado Livre 2" | ____ |
   | Shopee 1/2 (P2) | "Shopee 1" | ____ |

3. **Configurações → API → Gerar nova API key.** Copie e ponha no `.env`
   (`LIBREDESK_API_KEY`, `LIBREDESK_ACCOUNT_ID` — normalmente `1`).
4. **Webhook de saída** (replies do lojista): Configurações → Webhooks → Novo →
   URL `http://bridge:3000/webhook/libredesk`, evento `message_created`. Se
   preencheu `WEBHOOK_SECRET`, use a **mesma string** aqui (ver
   `reference_libredesk_webhook_signature` / SDD §6.1).
5. `docker compose restart bridge` (pega a API key nova).

**Deu certo?** `docker compose logs bridge` sobe sem erro de credencial.

---

## 2. Como criar contas (a ferramenta de onboarding)

As contas de canal são criadas pelo CLI do bridge, **dentro do container**:

```bash
docker compose exec bridge npm run add-account -- \
  --type <whatsapp|instagram|mercadolivre|shopee> \
  --label "Nome amigável" --inbox <Inbox ID> [opções por canal]

docker compose exec bridge npm run accounts   # lista o que já existe
```

Ele cria a `ChannelAccount` (credenciais **cifradas**). Conta de OAuth nasce
`disconnected` e o CLI **imprime o link `/oauth/start`** pra conectar.

---

## 3. Conectar cada canal

### 3.1 WhatsApp (via Evolution + QR)
```bash
docker compose exec bridge npm run add-account -- \
  --type whatsapp --label "WhatsApp" --inbox <ID> --instance kaichat-wa-1
```
Depois: abra `http://SEU-IP:8080` (Evolution), crie a instância
`kaichat-wa-1`, **escaneie o QR** com o celular da loja → status **Connected**.

**Deu certo?** Mande uma mensagem de um outro número pro WhatsApp da loja →
aparece uma conversa nova no Libredesk.

### 3.2 Mercado Livre (OAuth) — repita por conta (ML 1, ML 2)
```bash
docker compose exec bridge npm run add-account -- \
  --type mercadolivre --label "Mercado Livre 1" --inbox <ID>
#  → imprime:  🔗 https://SEU-DOMINIO/oauth/start?account=<id>
```
Abra esse link no navegador → **autorize** no Mercado Livre → o callback
(`/oauth/callback`) troca o code, **salva o token cifrado** e marca a conta
`active`. (Pré-requisito: `OAUTH_REDIRECT_URI` público e **igual** ao registrado
no app ML; `ML_APP_ID`/`ML_APP_SECRET` no `.env`.)

**Deu certo?** `npm run accounts` mostra a conta como `active`; em ~30s uma
pergunta nova no ML aparece no Libredesk.

### 3.3 Instagram (OAuth) — igual ao ML
```bash
docker compose exec bridge npm run add-account -- \
  --type instagram --label "Instagram" --inbox <ID>
#  → abra o /oauth/start?account=<id> e autorize na Meta
```
(Pré-requisito: `META_APP_ID`/`META_APP_SECRET`; o token de 60d é renovado
proativamente pelo conector.)

### 3.4 Shopee (P2 — Fase 10)
Só quando o app estiver **aprovado** na Open Platform (partner_id/key + escopo de
chat). Aí: `SHOPEE_PARTNER_ID`/`SHOPEE_PARTNER_KEY` no `.env` e
```bash
docker compose exec bridge npm run add-account -- \
  --type shopee --label "Shopee 1" --inbox <ID> \
  --shop-id <SHOP_ID> --access-token <TOKEN> --refresh-token <REFRESH>
```

---

## 4. Conferir tudo conectado
```bash
docker compose exec bridge npm run accounts
```
Todas as contas que você quer ativas devem estar `active`. WhatsApp deve estar
`Connected` no Evolution.

---

## 5. Lojista entra no PWA (uso diário)

1. Abra o app: a URL do Vercel (ex: `https://SEU-APP.vercel.app`).
2. Na **tela de acesso**: **Endereço do atendimento** = URL pública do Libredesk;
   **Chave de acesso** = a API key do passo 1.3; (Avançado: Account ID, normal `1`).
3. **Entrar** → ele testa a conexão e guarda no aparelho (só faz isso uma vez).
4. Pronto: o lojista vê **todos os canais juntos**, com abas por conta, e responde.

> ⚠️ **CORS:** o Libredesk precisa aceitar o domínio do Vercel como origem —
> configure no deploy do Libredesk antes deste passo (ver aviso no `CLAUDE.md`).
> Como o PWA é HTTPS, o Libredesk também precisa estar em **HTTPS** (domínio +
> TLS, ou o túnel do `DEPLOY-desktop.md`).

**Demo (sem nada disso):** `https://omnichannel-kaisses.vercel.app/?demo` já
mostra a cara do app com dados de exemplo.

---

## 6. Smoke test final ("deu certo?")

- [ ] Mensagem de teste em **cada** canal aparece no Libredesk (≤ 60s).
- [ ] Respondendo pelo PWA, a resposta chega no canal de origem.
- [ ] A aba da conta certa filtra a conversa; a origem aparece no topo da conversa.
- [ ] Token não expira sozinho: ML (6h) e Instagram (60d) renovam e persistem.

---

## Mapa rápido (onde está cada peça)

| Assunto | Arquivo |
|---|---|
| Subir o stack | `DEPLOY-oracle.md` / `DEPLOY-desktop.md` |
| Criar contas (CLI) | `scripts/add-account.js` |
| Fluxo OAuth | `src/webhook/oauth.js` |
| Variáveis | `.env.example` |
| PWA (deploy/uso) | `web/CLAUDE.md` |
| Visão geral / avisos | `CLAUDE.md`, `docs/SDD-kaichat.md` |
