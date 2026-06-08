# Deploy — Oracle Cloud Always Free

> Guia passo a passo para subir todos os serviços do KaiChat num único VM Oracle.
> Custo: **zero** (Always Free — não expira).

---

## O que vai rodar neste VM

```
Oracle Cloud VM (ARM A1 Flex — 4 OCPUs, 24GB RAM)
└── Docker Compose
    ├── nginx          → porta 80   (painel Libredesk para o lojista)
    ├── libredesk      → porta 9000 (interno)
    ├── postgres       → porta 5432 (interno)
    ├── redis          → porta 6379 (interno)
    ├── evolution-api  → porta 8080 (exposto só para escanear QR code)
    └── bridge         → porta 3000 (interno — só recebe webhooks internos)
```

---

## Parte 1 — Criar conta e VM na Oracle Cloud

### 1.1 — Criar conta

1. Acesse [cloud.oracle.com](https://cloud.oracle.com) → **Start for free**
2. Preencha com seu e-mail e dados (pede cartão de crédito para verificação — **não cobra**)
3. Região recomendada: **Brazil East (São Paulo)** — menor latência para o cliente

### 1.2 — Criar o VM A1 Flex (ARM)

1. No menu: **Compute → Instances → Create Instance**
2. Configurações:
   - **Name:** `kaichat-vm`
   - **Image:** Ubuntu 22.04 (ARM)
   - **Shape:** Ampere → `VM.Standard.A1.Flex`
   - **OCPUs:** 4 | **Memory:** 24 GB
   - **Boot volume:** 100 GB (padrão)
3. Em **Add SSH keys**: faça upload da sua chave pública (`~/.ssh/id_rsa.pub`) ou gere uma nova
4. Clique em **Create** e aguarde o status ficar **Running**
5. Anote o **IP público** da instância (ex: `140.238.xxx.xxx`)

### 1.3 — Abrir as portas no firewall da Oracle

Por padrão só a porta 22 (SSH) está aberta. Precisa abrir mais duas:

1. Na página da instância → **Primary VNIC** → **Subnet** → **Security List**
2. Clique em **Add Ingress Rules** e adicione:

| Source CIDR | Protocol | Port | Descrição |
|---|---|---|---|
| 0.0.0.0/0 | TCP | 80 | Libredesk (painel) |
| 0.0.0.0/0 | TCP | 8080 | Evolution API (QR code) |

---

## Parte 2 — Configurar o VM

### 2.1 — Conectar via SSH

```bash
ssh ubuntu@SEU_IP_ORACLE
```

### 2.2 — Abrir portas no firewall interno do Ubuntu

O Oracle Cloud tem dois firewalls: o da nuvem (já configurado acima) e o `iptables` do Ubuntu. Precisa liberar ambos:

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# Salva as regras para persistirem após reboot
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

### 2.3 — Instalar Docker e Docker Compose

```bash
# Atualiza o sistema
sudo apt-get update && sudo apt-get upgrade -y

# Instala Docker
curl -fsSL https://get.docker.com | sudo sh

# Adiciona seu usuário ao grupo docker (sem precisar de sudo)
sudo usermod -aG docker ubuntu
newgrp docker

# Verifica a instalação
docker --version
docker compose version
```

---

## Parte 3 — Fazer deploy do KaiChat

### 3.1 — Clonar o repositório

```bash
git clone https://github.com/kaissessedres/kaichat.git
cd kaichat
```

### 3.2 — Criar o arquivo .env

```bash
cp .env.example .env
nano .env
```

Preencha os campos obrigatórios para o primeiro boot:

```env
# Obrigatório agora (Libredesk + Evolution API):
POSTGRES_PASSWORD=uma_senha_forte_aqui
EVOLUTION_API_KEY=outra_senha_forte_aqui
ENCRYPTION_KEY=   # gere com: openssl rand -hex 32

# Deixe em branco por enquanto (preencher nas fases seguintes):
LIBREDESK_API_KEY=
LIBREDESK_ACCOUNT_ID=1
ML_APP_ID=
# etc...
```

> **Nota:** `LIBREDESK_URL` e `EVOLUTION_API_URL` **não precisam** ser editados no `.env`.
> O `docker-compose.yml` já os sobrescreve com os endereços internos corretos (`http://libredesk:9000` e `http://evolution:8080`).

### 3.3 — Verificar imagem do Libredesk

Antes de subir, confirme o nome correto da imagem Docker do Libredesk:

```bash
# Acesse e veja a imagem mais recente:
# https://github.com/abhinavxd/libredesk/pkgs/container/libredesk
```

Se o nome for diferente de `ghcr.io/abhinavxd/libredesk:latest`, edite o `docker-compose.yml`.

### 3.4 — Subir todos os serviços

```bash
docker compose up -d

# Acompanhe os logs para ver se tudo subiu:
docker compose logs -f
```

Aguarde todos os serviços ficarem `healthy` (1–2 minutos).

### 3.5 — Verificar status

```bash
docker compose ps
```

Todos devem estar `Up` ou `healthy`.

---

## Parte 4 — Configurar o Libredesk (Fase 3)

1. Acesse `http://SEU_IP_ORACLE` no browser
2. Crie a conta admin (primeiro acesso)
3. Crie os **Inboxes** — um por canal:
   - "WhatsApp" → tipo API
   - "Instagram" → tipo API
   - "Mercado Livre 1" → tipo API
   - "Mercado Livre 2" → tipo API
4. Para cada inbox criado, anote o **Inbox ID** (aparece na URL: `/inboxes/123/...`)
5. Vá em **Configurações → API → Gerar nova API key**
6. Copie a API key e edite o `.env`:
   ```bash
   nano .env
   # Preencha LIBREDESK_API_KEY e LIBREDESK_ACCOUNT_ID
   ```
7. Configure o webhook de saída do Libredesk (para receber replies):
   - Configurações → Webhooks → Novo webhook
   - URL: `http://bridge:3000/webhook/libredesk`
   - Evento: `message_created`

8. Reinicie o bridge para pegar as novas env vars:
   ```bash
   docker compose restart bridge
   ```

---

## Parte 5 — Conectar WhatsApp (Fase 4)

1. Acesse `http://SEU_IP_ORACLE:8080` — painel do Evolution API
2. Faça login com a `EVOLUTION_API_KEY` configurada
3. Crie uma instância com o nome definido em `EVOLUTION_WA_INSTANCE` (padrão: `kaichat-wa-1`)
4. Escaneie o QR code com o WhatsApp do lojista
5. Aguarde o status ficar **Connected**

Após conectar, pode fechar a porta 8080 no Security List da Oracle se quiser mais segurança (acesse por SSH tunnel quando precisar novamente).

---

## Comandos úteis do dia a dia

```bash
# Ver status de todos os serviços
docker compose ps

# Ver logs em tempo real
docker compose logs -f bridge
docker compose logs -f evolution

# Reiniciar um serviço específico
docker compose restart bridge

# Atualizar o bridge após novo deploy (git pull + rebuild)
git pull
docker compose up -d --build bridge

# Parar tudo (raramente necessário)
docker compose down
```

---

## Opcional — Adicionar domínio e HTTPS

Se quiser um endereço como `kaichat.seudominio.com` com HTTPS:

1. Aponte um subdomínio para o IP do VM (DNS A record)
2. Instale o Certbot no VM:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   ```
3. Edite `nginx/nginx.conf` para incluir `server_name seu.dominio.com`
4. Gere o certificado:
   ```bash
   sudo certbot --nginx -d seu.dominio.com
   ```
5. Reinicie o nginx: `docker compose restart nginx`

> O Libredesk precisará saber a URL final para gerar links corretos.
> Adicione `APP_URL=https://seu.dominio.com` nas env vars do Libredesk no `docker-compose.yml`.

---

## Troubleshooting

| Problema | O que verificar |
|---|---|
| `http://IP` não abre | Porta 80 aberta no Security List? `iptables` liberado? `docker compose ps` mostra nginx Up? |
| Libredesk não conecta no banco | `docker compose logs postgres` — senha bate com `POSTGRES_PASSWORD`? |
| Evolution API não aparece | `docker compose logs evolution` — porta 8080 aberta? |
| Bridge não recebe webhooks | `docker compose logs bridge` — Evolution API configurou o webhook corretamente? |
| QR code não aparece | Acesse `http://IP:8080` e verifique o status da instância |
