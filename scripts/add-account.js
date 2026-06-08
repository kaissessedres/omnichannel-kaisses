#!/usr/bin/env node
// Onboarding de contas — cria uma linha em ChannelAccount com as credenciais
// já cifradas (via createAccount/setCredentials). Para ML/Instagram sem token,
// cria em 'disconnected' e imprime o link /oauth/start pra conectar (ver
// src/webhook/oauth.js). WhatsApp não usa credentials (sessão fica no Evolution).
//
// Uso:
//   npm run add-account -- --type mercadolivre --label "ML Conta 1" --inbox 3
//   npm run add-account -- --type whatsapp --label "WhatsApp" --inbox 7 --instance kaichat-wa-1
//   npm run add-account -- --type instagram --label "IG" --inbox 5 --access-token <token>
//   npm run accounts            # lista as contas cadastradas

require('dotenv').config({ quiet: true });
const { parseArgs } = require('node:util');

const CHANNELS = ['whatsapp', 'instagram', 'mercadolivre', 'shopee'];
const OAUTH_CHANNELS = ['mercadolivre', 'instagram'];

const OPTIONS = {
  type: { type: 'string' },
  label: { type: 'string' },
  inbox: { type: 'string' },
  instance: { type: 'string' },
  'access-token': { type: 'string' },
  'refresh-token': { type: 'string' },
  'seller-id': { type: 'string' },
  'shop-id': { type: 'string' },
  list: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

// Valida os argumentos e devolve o payload do createAccount + se a conta ainda
// precisa do fluxo OAuth. Função pura (sem I/O) — é o "cérebro" testável do CLI.
function resolveAccountArgs(values) {
  const { type, label, inbox } = values;
  if (!type || !label || !inbox) {
    throw new Error('Faltam argumentos obrigatórios: --type, --label, --inbox');
  }
  if (!CHANNELS.includes(type)) {
    throw new Error(`--type inválido: "${type}" (use um de: ${CHANNELS.join(', ')})`);
  }
  const libredeskInboxId = Number(inbox);
  if (!Number.isInteger(libredeskInboxId) || libredeskInboxId <= 0) {
    throw new Error(`--inbox deve ser um inteiro positivo (recebido: "${inbox}")`);
  }

  const credentials = {};
  if (values['access-token']) credentials.access_token = values['access-token'];
  if (values['refresh-token']) credentials.refresh_token = values['refresh-token'];
  if (values['seller-id']) credentials.seller_id = values['seller-id'];   // Mercado Livre
  if (values['shop-id']) credentials.shop_id = values['shop-id'];         // Shopee

  const hasCreds = Object.keys(credentials).length > 0;
  // OAuth sem token = conecta depois (disconnected). Com token, ou WhatsApp
  // (sessão no Evolution), ou qualquer outro caso = active.
  const status = !hasCreds && OAUTH_CHANNELS.includes(type) ? 'disconnected' : 'active';

  return {
    input: {
      channelType: type,
      accountLabel: label,
      credentials,
      evolutionInstanceId: values.instance || null,
      libredeskInboxId,
      status,
    },
    needsOAuth: status === 'disconnected',
  };
}

function usage() {
  console.log(`Onboarding de contas do KaiChat

  npm run add-account -- --type <canal> --label <nome> --inbox <id> [opções]
  npm run accounts                 lista as contas cadastradas

Canais: ${CHANNELS.join(', ')}

Opções:
  --type          whatsapp | instagram | mercadolivre | shopee   (obrigatório)
  --label         nome amigável da conta                         (obrigatório)
  --inbox         id do inbox no Libredesk                        (obrigatório)
  --instance      id da instância no Evolution API (WhatsApp)
  --access-token  semeia o token direto (pula o OAuth)
  --refresh-token refresh token (Mercado Livre / Shopee)
  --seller-id     id do vendedor (Mercado Livre)
  --shop-id       id da loja (Shopee)
  --list          lista as contas e sai
  -h, --help      esta ajuda`);
}

function listAccounts() {
  const { getDb } = require('../src/db/schema');
  const rows = getDb()
    .prepare('SELECT id, channel_type, account_label, status, libredesk_inbox_id FROM ChannelAccount ORDER BY id')
    .all();
  if (!rows.length) return console.log('(nenhuma conta cadastrada)');
  for (const a of rows) {
    console.log(`#${a.id}  ${a.channel_type.padEnd(12)}  ${a.status.padEnd(12)}  inbox ${a.libredesk_inbox_id}  ${a.account_label}`);
  }
}

function main() {
  const { values } = parseArgs({ options: OPTIONS });
  if (values.help) return usage();

  const { initDb } = require('../src/db/schema');
  initDb();

  if (values.list) return listAccounts();

  const { input, needsOAuth } = resolveAccountArgs(values);
  const { createAccount } = require('../src/db/queries');
  const { lastInsertRowid: id } = createAccount(input);

  console.log(`✅ Conta #${id} criada: ${input.channelType} "${input.accountLabel}" — status ${input.status}`);
  if (needsOAuth) {
    const base = (process.env.OAUTH_REDIRECT_URI || '').replace(/\/oauth\/callback\/?$/, '');
    const url = base ? `${base}/oauth/start?account=${id}` : `<SERVIDOR_PÚBLICO>/oauth/start?account=${id}`;
    console.log(`🔗 Para conectar (OAuth), abra no navegador: ${url}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Erro: ${err.message}\n`);
    usage();
    process.exit(1);
  }
}

module.exports = { resolveAccountArgs };
