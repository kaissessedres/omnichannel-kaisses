# Deploy — Desktop como servidor (contornar a fila do Oracle)

> Guia para subir todos os serviços do Megachat no **seu PC**, em vez de (ou
> antes de) o VM Oracle. Serve para destravar a Fase 3 enquanto a Oracle está
> "Out of host capacity". Custo: zero (sua máquina + energia).
>
> **Quase nenhuma mudança de código:** o stack é Docker Compose, portável. O
> mesmo `docker compose up` roda no desktop hoje e no Oracle depois, sem
> retrabalho. O que muda aqui é **rede/operação**, não `src/`.

---

## Os dois níveis (leia antes de começar)

A maior parte do sistema **não precisa de IP público** — então dá pra avançar
muito sem mexer em roteador/firewall:

| Nível | O que cobre | Precisa de internet pública? |
|---|---|---|
| **A — Local** | Subir tudo, configurar Libredesk, conectar WhatsApp, testar conectores ML/Instagram. **Desbloqueia as Fases 3-8.** | ❌ Não. WhatsApp é conexão de saída; polling ML/IG é de saída; Libredesk↔bridge é interno ao Docker. |
| **B — Exposto** | Lojista usar o **PWA (Vercel) de fora de casa** + **callbacks OAuth** de ML/Instagram (Fases 7/8). | ✅ Sim — via **Cloudflare Tunnel** (HTTPS, sem abrir porta). |

> Comece pelo Nível A. Só vá pro B quando for usar o app pelo celular fora da
> sua rede ou conectar o OAuth de ML/Instagram.

---

## Pré-requisitos

### 1. Manter o PC ligado 24/7 (sem dormir)

Se a máquina suspender, o WhatsApp cai e o polling para. Desative a suspensão:

- **Windows:** Configurações → Sistema → Energia → *Suspensão* = **Nunca**.
  Também: `powercfg /change standby-timeout-ac 0` e `powercfg /change hibernate-timeout-ac 0`.
- **macOS:** Ajustes → Bateria/Energia → desligar suspensão automática. Ou rodar
  `caffeinate -s` num terminal enquanto o servidor estiver no ar.
- **Linux:** `sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target`.

### 2. Instalar Docker

- **Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) com
  backend **WSL2** (o instalador configura). Reinicie e abra o Docker Desktop uma vez.
- **macOS:** Docker Desktop (ou OrbStack/Colima, se preferir mais leve).
- **Linux:** `curl -fsSL https://get.docker.com | sudo sh` e
  `sudo usermod -aG docker $USER` (relogar depois).

Verifique:

```bash
docker --version
docker compose version
```

> **Arquitetura:** o Oracle é ARM, seu PC é x86 — **não é problema**. As imagens
> (postgres, redis, libredesk, evolution, nginx) são multi-arch e o bridge
> recompila sozinho no `build`. É até mais simples que no ARM.

---

## Parte 1 — Subir o stack (Nível A — local)

### 1.1 — Clonar o repositório

```bash
git clone https://github.com/kaissessedres/omnichannel-kaisses.git
cd omnichannel-kaisses
```

### 1.2 — Criar o `.env`

```bash
cp .env.example .env
```

Preencha o mínimo para o primeiro boot (use seu editor preferido):

```env
POSTGRES_PASSWORD=uma_senha_forte_aqui
EVOLUTION_API_KEY=outra_senha_forte_aqui
ENCRYPTION_KEY=          # gere com: openssl rand -hex 32
WEBHOOK_SECRET=          # opcional agora; recomendado quando expor (Nível B)

# Deixe em branco por enquanto (preencher nas fases seguintes):
LIBREDESK_API_KEY=
LIBREDESK_ACCOUNT_ID=1
```

> `LIBREDESK_URL` e `EVOLUTION_API_URL` **não precisam** ser editados — o
> `docker-compose.yml` já os aponta pra rede interna (`libredesk:9000`,
> `evolution:8080`).
>
> Gerar a `ENCRYPTION_KEY` no Windows sem `openssl`: rode num container —
> `docker run --rm alpine sh -c "apk add -q openssl && openssl rand -hex 32"`.

### 1.3 — Subir tudo

```bash
docker compose up -d
docker compose logs -f      # acompanhe até ficar healthy (1–2 min). Ctrl+C sai dos logs (não derruba)
```

> **Porta 80 ocupada?** Se algo no PC já usa a 80 (IIS, Skype antigo), troque o
> mapeamento do nginx no `docker-compose.yml` de `"80:80"` para `"8081:80"` e
> acesse o Libredesk em `http://localhost:8081`. (No Nível B com túnel, a porta
> nem precisa ficar exposta no host.)

### 1.4 — Verificar

```bash
docker compose ps          # todos devem estar Up/healthy
```

---

## Parte 2 — Configurar o Libredesk (Fase 3)

Igual ao guia do Oracle, só que pelo **localhost**:

1. Abra `http://localhost` (ou `http://localhost:8081` se trocou a porta).
2. Crie a conta admin (primeiro acesso).
3. Crie um **Inbox** por canal (WhatsApp, Instagram, ML 1, ML 2) — tipo API.
   Anote o **Inbox ID** de cada um (aparece na URL).
4. **Configurações → API → Gerar nova API key.** Copie e ponha no `.env`
   (`LIBREDESK_API_KEY`, `LIBREDESK_ACCOUNT_ID`).
5. **Webhook de saída** (replies do lojista): Configurações → Webhooks → Novo:
   - URL: `http://bridge:3000/webhook/libredesk`
   - Evento: `message_created`
   - Se preencheu `WEBHOOK_SECRET` no `.env`, ponha **a mesma string** aqui.
6. Reinicie o bridge p/ pegar as novas vars: `docker compose restart bridge`.

---

## Parte 3 — Conectar o WhatsApp (Fase 4)

1. Abra `http://localhost:8080` — painel do Evolution API.
2. Login com a `EVOLUTION_API_KEY` do `.env`.
3. Crie a instância com o nome de `EVOLUTION_WA_INSTANCE` (padrão `megachat-wa-1`).
4. Escaneie o QR code com o WhatsApp do lojista. Aguarde **Connected**.

Pronto: com isso o WhatsApp já entra no Libredesk e as Fases 5/6 podem ser
validadas **sem nenhuma exposição pública**.

---

## Parte 4 — Expor para a internet (Nível B — Cloudflare Tunnel)

Necessário só para: (a) o lojista abrir o **PWA pelo celular fora de casa** e
(b) os **callbacks OAuth** de ML/Instagram.

### Por que túnel (e não abrir porta no roteador)

- ⚠️ **Mixed content:** o PWA no Vercel é **HTTPS**. O navegador **bloqueia** uma
  página HTTPS chamando um Libredesk em `http://`. Precisamos de **HTTPS**.
- O **Cloudflare Tunnel** resolve tudo de uma vez: dá HTTPS automático, **não
  precisa abrir porta** no roteador nem ter IP fixo, e não expõe seu IP de casa.

### 4.1 — Opção rápida, sem conta (só para testar)

URL temporária `https://algo-aleatorio.trycloudflare.com` que muda a cada execução:

```bash
docker run --rm -it cloudflare/cloudflared:latest \
  tunnel --url http://host.docker.internal:80
```

(No Linux, se `host.docker.internal` não resolver, use o IP do host ou rode o
`cloudflared` instalado na máquina apontando para `http://localhost:80`.)
Bom para um teste rápido de ponta a ponta; não serve para produção (URL volátil).

### 4.2 — Opção estável (túnel nomeado, recomendada)

Precisa de uma conta Cloudflare (grátis) com um **domínio** gerenciado por ela.

O serviço `cloudflared` já vem pronto em **`docker-compose.tunnel.yml`** (na raiz
do repo) — é opt-in, não sobe sozinho. Você só precisa do token e de subir com os
dois arquivos:

1. No painel **Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Escolha **Cloudflared**, dê um nome (ex: `megachat`), copie o **token**.
3. Ponha o token no `.env`: `CLOUDFLARE_TUNNEL_TOKEN=...`
4. No painel do túnel, em **Public Hostnames**, aponte
   `megachat.seudominio.com` → **Service** `http://nginx:80`.
5. Suba o stack **com o arquivo do túnel** somado ao base:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
   ```

   (O Nível A local continua com o `docker compose up -d` normal, sem túnel.)

Agora o Libredesk está em `https://megachat.seudominio.com` com HTTPS válido.

### 4.3 — Apontar o PWA (Vercel) e liberar CORS

1. **Vercel** (projeto do `web/`): defina `VITE_LIBREDESK_URL` = a URL do túnel.
   (Também dá para só digitar essa URL na tela de login do app — ela guarda
   URL + API key no `localStorage`.)
2. **CORS no Libredesk:** ele precisa aceitar o domínio do Vercel
   (`https://seu-app.vercel.app`) como origem. Configure isso na instância do
   Libredesk antes de usar o PWA de fora (ver a doc do Libredesk; é o aviso de
   CORS já registrado no `CLAUDE.md`). Sem isso, o navegador bloqueia as chamadas.

---

## Diferenças vs. o guia do Oracle (resumo)

| Passo no `DEPLOY-oracle.md` | No desktop |
|---|---|
| Criar VM A1 Flex (ARM) | — (não existe; é o seu PC) |
| Abrir portas no **Security List** da Oracle | — (Nível A não expõe nada; Nível B usa túnel, sem abrir porta) |
| `iptables` do Ubuntu | Firewall do SO — irrelevante no Nível A; desnecessário com túnel |
| Acessar por `http://IP_PUBLICO` | `http://localhost` |
| HTTPS via domínio + Certbot | HTTPS via Cloudflare Tunnel (4.2) |
| `git pull && docker compose up -d --build bridge` | **Igual** |

Resto (instalar Docker, `.env`, `docker compose up`, configurar Libredesk,
conectar WhatsApp) é **idêntico**.

---

## Conviver com o Oracle / migrar depois

- O **mesmo** `docker compose up` roda no VM quando a capacidade liberar — sem
  mudar nada do código.
- **Dados** (SQLite do bridge, Postgres do Libredesk, sessão do WhatsApp) ficam
  em *volumes* Docker locais; **não viajam sozinhos** para o Oracle. Na migração:
  ou refaz o onboarding (recriar inboxes, reescanear o QR, reconectar OAuth), ou
  copia os volumes (`docker run --rm -v <vol>:/data -v $PWD:/backup alpine tar ...`).
- Para baixo volume, refazer o onboarding costuma ser mais simples que migrar volumes.

---

## Troubleshooting

| Problema | O que verificar |
|---|---|
| `docker compose` não conecta | Docker Desktop está **aberto/rodando**? (Win/Mac) |
| `http://localhost` não abre | `docker compose ps` mostra nginx Up? Porta 80 ocupada? (ver 1.3) |
| Libredesk não sobe | `docker compose logs libredesk` / `logs postgres` — senha bate com `POSTGRES_PASSWORD`? |
| QR não aparece | `http://localhost:8080`, ver status da instância no Evolution |
| Bridge não recebe webhook | `docker compose logs bridge` — webhook do Evolution/Libredesk configurado? |
| PWA não carrega conversas | Mixed content (Libredesk precisa estar em **HTTPS** — Nível B) e **CORS** liberado (4.3) |
| Túnel não conecta | `docker compose logs cloudflared` — token correto no `.env`? Hostname público aponta pra `http://nginx:80`? |
| Tudo cai quando saio do PC | Suspensão desativada? (Pré-requisitos) |
