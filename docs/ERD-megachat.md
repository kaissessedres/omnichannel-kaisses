# ERD — Megachat Bridge Service
**Versão:** 0.3  
**Changelog:**
- v0.3 — Adicionada nota sobre frontend mobile não requerer entidades novas; campo `evolution_instance_id` documentado com clareza
- v0.2 — Adicionado campo evolution_instance_id em ChannelAccount; WhatsApp não armazena sessão localmente

> Nota: O Libredesk gerencia suas próprias entidades (conversas, mensagens, contatos,
> agentes). O ERD abaixo cobre APENAS os dados que o bridge service precisa manter
> para funcionar corretamente.
>
> O frontend mobile (PWA no Vercel) consome a API do Libredesk diretamente — não
> acessa o banco do bridge e não requer entidades adicionais.

---

## Entidades

### 1. ChannelAccount
Representa uma conta conectada em um canal externo.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INTEGER PK | Identificador único |
| channel_type | TEXT | 'whatsapp' \| 'instagram' \| 'mercadolivre' \| 'shopee' |
| account_label | TEXT | Nome amigável ex: "ML Conta Principal" |
| credentials | TEXT | JSON criptografado com tokens/sessão (não usado para WhatsApp) |
| evolution_instance_id | TEXT | Nullable — ID da instância no Evolution API (só WhatsApp) |
| libredesk_inbox_id | INTEGER | ID do inbox correspondente no Libredesk |
| status | TEXT | 'active' \| 'disconnected' \| 'error' |
| last_synced_at | DATETIME | Última vez que o polling/webhook executou com sucesso |
| created_at | DATETIME | |

---

### 2. ConversationMapping
Mapeia uma conversa externa (de qualquer canal) ao ID de conversa do Libredesk.
Evita duplicações e permite rotear respostas corretamente.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INTEGER PK | |
| libredesk_conversation_id | INTEGER | ID da conversa no Libredesk |
| channel_account_id | INTEGER FK → ChannelAccount | De qual conta veio |
| external_conversation_id | TEXT | ID da conversa no canal externo |
| external_contact_id | TEXT | ID do contato no canal externo |
| created_at | DATETIME | |

---

### 3. SyncState
Controla o estado do polling por conta — evita rebuscar mensagens já processadas.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INTEGER PK | |
| channel_account_id | INTEGER FK → ChannelAccount | |
| last_external_message_id | TEXT | ID da última mensagem processada |
| last_polled_at | DATETIME | Quando o polling rodou pela última vez |
| error_count | INTEGER | Falhas consecutivas (para backoff) |
| last_error | TEXT | Mensagem do último erro (para debug) |

---

## Diagrama de relacionamentos

```
ChannelAccount
    │
    ├──── 1:N ──── ConversationMapping
    │                    │
    │                    └── N:1 ──── Libredesk (externo)
    │
    └──── 1:1 ──── SyncState
```

---

## Notas de design

**Por que não armazenamos mensagens?**
O Libredesk já armazena todas as mensagens. Duplicar isso seria redundante e
aumentaria a complexidade sem benefício. O bridge é stateless em relação ao conteúdo —
só precisa saber "de onde veio" e "qual é o ID externo".

**Por que WhatsApp não usa o campo credentials?**
A sessão do WhatsApp é gerenciada inteiramente pelo Evolution API — ele cuida do QR
code, da autenticação e da reconexão automática. O bridge só precisa saber o
`evolution_instance_id` para enviar mensagens via HTTP ao Evolution API. Nenhuma
credencial do WhatsApp passa pelo bridge.

**Por que criptografar credentials?**
Tokens OAuth do ML, Instagram e credenciais da Shopee não podem ficar em texto
plano em banco. Usaremos uma chave de ambiente (env var) para criptografia AES.
WhatsApp não precisa disso pois sua sessão fica no Evolution API.

**SQLite é suficiente?**
Sim. Com um único usuário e baixo volume, SQLite é mais simples que PostgreSQL e não
requer servidor separado. Se escalar para múltiplos clientes no futuro, migra para
PostgreSQL sem mudar a estrutura das tabelas.

---

*Próximo documento: SDD — arquitetura técnica do sistema*
