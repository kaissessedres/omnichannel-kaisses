# PRD — Megachat Omnichannel Bridge
**Versão:** 0.3  
**Autor:** a definir  
**Status:** Em revisão  
**Changelog:**
- v0.3 — Adicionado frontend mobile PWA no Vercel; hospedagem definida como Railway (backend) + Vercel (frontend); ajustados RNFs, escopo e dependências
- v0.2 — Substituído whatsapp-web.js por Evolution API; adicionado SDK oficial ML; atualizado riscos e dependências

---

## 1. Visão geral do produto

O sistema é composto por dois blocos independentes:

**Bridge Service** — centraliza mensagens de múltiplos canais externos (WhatsApp, Instagram, Mercado Livre, Shopee) no Libredesk, que atua como backend e banco de dados de conversas.

**Frontend Mobile (PWA)** — interface React hospedada no Vercel, otimizada para celular, que consome a API do Libredesk diretamente. O lojista acessa pelo browser mobile e pode adicionar à tela inicial como se fosse um app.

---

## 2. Problema

O cliente opera uma loja de artigos personalizados com presença em:
- 2 contas no Mercado Livre
- 2 contas na Shopee
- 1 conta no Instagram
- 1 conta no WhatsApp

Cada canal exige acesso separado. Mensagens não respondidas a tempo reduzem conversão
e reputação nas plataformas. O tempo gasto alternando entre canais é improdutivo para
uma operação de pessoa única.

---

## 3. Usuários

| Perfil | Descrição |
|---|---|
| Lojista (usuário único) | Opera sozinho, baixo volume de mensagens, não é técnico |
| Administrador (você) | Instala, configura e mantém o sistema |

---

## 4. Objetivos do produto

1. O lojista visualiza mensagens de todos os canais em um único painel
2. O lojista responde qualquer mensagem sem sair do painel
3. O sistema identifica de qual canal veio cada conversa
4. O lojista acessa o painel pelo celular com experiência fluida
5. Custo operacional zero ou próximo de zero

---

## 5. Requisitos funcionais

### 5.1 Canais suportados

| Canal | Contas | Método de integração | Prioridade |
|---|---|---|---|
| WhatsApp | 1 | Evolution API (serviço open source, QR code) | P1 |
| Instagram DM | 1 | Meta Graph API (OAuth) | P1 |
| Mercado Livre | 2 | SDK oficial Node.js + OAuth por conta | P1 |
| Shopee | 2 | Shopee Open Platform ou credenciais diretas | P2 |

### 5.2 Funcionalidades do bridge

- **RF01** — WhatsApp: receber eventos em tempo real via webhook do Evolution API. Demais canais: polling a cada 30 segundos
- **RF02** — Criar conversa no Libredesk quando uma nova mensagem chegar
- **RF03** — Identificar o canal de origem em cada conversa (tag ou label)
- **RF04** — Receber webhook do Libredesk quando o lojista responder
- **RF05** — Enviar a resposta pelo canal de origem correto
- **RF06** — Não duplicar mensagens já sincronizadas
- **RF07** — Reconectar automaticamente em caso de falha de conexão

### 5.3 Libredesk (não desenvolvemos, usamos como está)

- Backend de conversas e mensagens
- API REST consumida pelo frontend mobile
- Gestão de status (aberto, resolvido)
- Deploy self-hosted via Railway

### 5.4 Frontend Mobile PWA (desenvolvemos, hospedado no Vercel)

- **RF08** — Exibir lista de conversas ordenada por mais recente
- **RF09** — Mostrar ícone/badge do canal de origem em cada conversa (WA, IG, ML, Shopee)
- **RF10** — Abrir thread de mensagens ao tocar em uma conversa
- **RF11** — Campo de resposta fixo no rodapé da thread
- **RF12** — Marcar conversa como resolvida
- **RF13** — Suportar instalação como PWA (manifest.json + ícone na home screen)

---

## 6. Requisitos não-funcionais

| Requisito | Descrição |
|---|---|
| Custo | Zero — Oracle Cloud Always Free (backend) + Vercel free tier (frontend) |
| Mobile-first | Interface PWA otimizada para telas de 375px+; touch-friendly |
| Disponibilidade | Backend Railway 24h; frontend Vercel estático — nunca dorme |
| Latência de sync | Mensagens aparecem em até 60 segundos |
| Segurança | Credenciais e tokens nunca expostos em logs ou no frontend |
| Manutenibilidade | Código modular — um arquivo por canal no bridge |

---

## 7. Fora do escopo (v1)

- App nativo iOS ou Android
- Chatbot ou respostas automáticas
- Relatórios ou métricas de atendimento
- Múltiplos agentes / colaboração em equipe
- Notificações push (pode ser adicionado como v2 via Web Push API)
- Integração com ERP ou gestão de pedidos
- Suporte a mais de um lojista (multitenancy)

---

## 8. Critérios de sucesso

- [ ] Lojista consegue ver mensagens de todos os canais pelo celular
- [ ] Lojista consegue responder e a resposta chega no canal correto
- [ ] Interface carrega em menos de 3 segundos no celular
- [ ] Sistema roda por 24h sem intervenção manual
- [ ] Custo mensal igual a zero

---

## 9. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Evolution API banir a conta WhatsApp | Baixa-Média | Alto | Evolution API é mais maduro e amplamente usado que whatsapp-web.js puro; uso moderado, sem spam |
| Evolution API sair do ar ou breaking change | Baixa | Alto | Projeto ativo com 5k+ stars; manter versão pinada no docker-compose.yml |
| Shopee bloquear acesso por credencial | Média | Médio | Iniciar pelo Open Platform; credencial como fallback de teste |
| Oracle Cloud mudar política Always Free | Muito baixa | Alto | Oracle tem histórico sólido de respeitar Always Free; migrar para Fly.io como plano B |
| VM Oracle ficar sem recursos | Baixa | Médio | 4 OCPUs + 24GB RAM é mais que suficiente para o volume atual; monitorar com `docker stats` |
| API do ML mudar sem aviso | Baixa | Médio | SDK oficial do ML absorve mudanças de baixo nível; atualizar só o conector |
| Token OAuth expirar sem renovação | Média | Alto | Lógica de refresh automático obrigatória — ML expira em 6h |

---

## 10. Dependências externas

**Backend (Oracle Cloud Always Free — VM A1 Flex):**
- Docker Compose (orquestra todos os serviços)
- Libredesk (self-hosted — github.com/abhinavxd/libredesk)
- Evolution API (self-hosted — github.com/EvolutionAPI/evolution-api)
- PostgreSQL 15 + Redis 7 (para o Libredesk)
- nginx (reverse proxy)
- mercadolibre npm SDK (oficial — github.com/mercadolibre/nodejs-sdk)

**Frontend (Vercel):**
- React 18 + Vite
- Tailwind CSS (mobile-first)
- Vercel (hospedagem estática gratuita)

**Externos / aprovações:**
- Meta Developer App (aprovação necessária para Instagram)
- Mercado Livre Developer App (criação gratuita — developers.mercadolivre.com.br)
- Shopee Open Platform ou credenciais diretas (open.shopee.com)

---

*Próximo documento: ERD — entidades de dados do bridge service*
