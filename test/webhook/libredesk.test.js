// Testa o webhook que recebe replies do lojista via Libredesk e roteia pro
// conector certo. Sobe o router num servidor HTTP efêmero, usa SQLite real
// em memória pro mapeamento, e troca o sendMessage do conector por um mock
// — sem precisar de credenciais reais nem bater nas APIs externas.

process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { getDb, initDb } = require('../../src/db/schema');
const queries = require('../../src/db/queries');
const { ALL: CONNECTORS } = require('../../src/connectors');
const libredeskWebhook = require('../../src/webhook/libredesk');
const { startRouterServer, waitFor, seedAccount } = require('../helpers');

const EXTERNAL_CONVERSATION_ID = '5511999999999';
const LIBREDESK_CONVERSATION_ID = 777;

// Mesmo "segredo compartilhado" que entraria no .env do bridge E no painel
// do Libredesk (Admin → Integrations → Webhooks) — usado só nos testes que
// configuram WEBHOOK_SECRET para exercitar a validação de assinatura.
const TEST_WEBHOOK_SECRET = 'segredo-compartilhado-de-teste';

// Troca WEBHOOK_SECRET temporariamente (como withEncryptionKey em
// crypto.test.js) e restaura no final mesmo se `fn` lançar — preserva o
// padrão "sem secret configurado" que as demais suítes deste arquivo esperam.
async function withWebhookSecret(value, fn) {
  const original = process.env.WEBHOOK_SECRET;
  if (value === undefined) delete process.env.WEBHOOK_SECRET;
  else process.env.WEBHOOK_SECRET = value;
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = original;
  }
}

function hmacSignature(rawBody, secret) {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

let server;
let accountId;
let mappingId;

test.before(async () => {
  initDb();
  server = await startRouterServer('/webhook/libredesk', libredeskWebhook);
});

test.after(() => server.close());

test.beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM ConversationMapping; DELETE FROM SyncState; DELETE FROM ChannelAccount;');
  accountId = seedAccount(db, {
    channel_type: 'whatsapp',
    account_label: 'WhatsApp Loja',
    evolution_instance_id: 'kaichat-wa-1',
    libredesk_inbox_id: 7,
  });
  const { lastInsertRowid } = queries.createMapping({
    libredeskConversationId: LIBREDESK_CONVERSATION_ID,
    channelAccountId: accountId,
    externalConversationId: EXTERNAL_CONVERSATION_ID,
    externalContactId: EXTERNAL_CONVERSATION_ID,
  });
  mappingId = lastInsertRowid;
});

// `secret`: assina corretamente o corpo com esse segredo (simula o Libredesk
// configurado com o mesmo WEBHOOK_SECRET — ou um diferente, pra simular
// adulteração/dessincronia). `signature`: manda esse valor cru no header,
// sem calcular nada — pra testar formatos malformados. Sem nenhum dos dois
// (uso original, mantido pelos testes pré-existentes): nenhum header de
// assinatura é enviado, exatamente como o Libredesk faria sem secret configurado.
function postReply(payload, { secret, signature } = {}) {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Libredesk-Signature'] = hmacSignature(body, secret);
  else if (signature !== undefined) headers['X-Libredesk-Signature'] = signature;
  return fetch(`${server.baseUrl}/webhook/libredesk`, { method: 'POST', headers, body });
}

// Troca temporariamente o sendMessage do conector `channelType` por `impl` e
// restaura o original no final. Funciona porque CONNECTORS é o MESMO objeto
// (cache do require) que o webhook importa — a troca tem efeito real, sem
// precisar de proxyquire/mock.module.
async function withMockConnectorSend(channelType, impl, fn) {
  const connector = CONNECTORS[channelType];
  const original = connector.sendMessage;
  connector.sendMessage = impl;
  try {
    return await fn();
  } finally {
    connector.sendMessage = original;
  }
}

test('reply "outgoing" com mapeamento conhecido é roteado pro conector certo', async () => {
  const calls = [];
  await withMockConnectorSend('whatsapp', async (mapping, externalId, content) => {
    calls.push({ mapping, externalId, content });
    return { status: 'sent' };
  }, async () => {
    const res = await postReply({
      conversation_id: LIBREDESK_CONVERSATION_ID,
      content: 'Já estamos preparando seu pedido!',
      message_type: 'outgoing',
    });
    assert.equal(res.status, 200);
    await waitFor(() => calls.length > 0);
  });

  assert.equal(calls.length, 1);
  const [{ mapping, externalId, content }] = calls;
  assert.equal(mapping.id, mappingId);
  assert.equal(mapping.channel_type, 'whatsapp');
  assert.equal(mapping.evolution_instance_id, 'kaichat-wa-1');
  assert.equal(externalId, EXTERNAL_CONVERSATION_ID);
  assert.equal(content, 'Já estamos preparando seu pedido!');
});

test('mensagens "incoming" (eco do próprio cliente) não são re-roteadas', async () => {
  const calls = [];
  await withMockConnectorSend('whatsapp', async (...args) => { calls.push(args); }, async () => {
    const res = await postReply({
      conversation_id: LIBREDESK_CONVERSATION_ID,
      content: 'Olá, vocês têm o produto X?',
      message_type: 'incoming',
    });
    assert.equal(res.status, 200);
  });

  assert.equal(calls.length, 0);
});

test('replies sem content ou sem conversation_id são ignorados', async () => {
  const calls = [];
  await withMockConnectorSend('whatsapp', async (...args) => { calls.push(args); }, async () => {
    await postReply({ conversation_id: LIBREDESK_CONVERSATION_ID, content: '', message_type: 'outgoing' });
    await postReply({ content: 'sem conversation_id', message_type: 'outgoing' });
  });

  assert.equal(calls.length, 0);
});

test('replies para conversas sem mapeamento são ignorados sem derrubar o webhook', async () => {
  const calls = [];
  await withMockConnectorSend('whatsapp', async (...args) => { calls.push(args); }, async () => {
    const res = await postReply({
      conversation_id: 99999,
      content: 'conversa que o bridge não conhece',
      message_type: 'outgoing',
    });
    assert.equal(res.status, 200);
  });

  assert.equal(calls.length, 0);
});

test('roteia pelo canal do mapeamento — Mercado Livre não passa pelo conector de WhatsApp', async () => {
  const mlAccountId = seedAccount(getDb(), {
    channel_type: 'mercadolivre',
    account_label: 'ML Conta 1',
    credentials: '{"seller_id":"123"}',
    evolution_instance_id: null,
    libredesk_inbox_id: 3,
  });
  queries.createMapping({
    libredeskConversationId: 888,
    channelAccountId: mlAccountId,
    externalConversationId: 'pack-42',
    externalContactId: 'comprador-1',
  });

  const waCalls = [];
  const mlCalls = [];
  await withMockConnectorSend('whatsapp', async (...args) => { waCalls.push(args); }, async () => {
    await withMockConnectorSend('mercadolivre', async (mapping, externalId, content) => {
      mlCalls.push({ mapping, externalId, content });
    }, async () => {
      const res = await postReply({ conversation_id: 888, content: 'Já enviamos seu pedido!', message_type: 'outgoing' });
      assert.equal(res.status, 200);
      await waitFor(() => mlCalls.length > 0);
    });
  });

  assert.equal(waCalls.length, 0);
  assert.equal(mlCalls.length, 1);
  assert.equal(mlCalls[0].mapping.channel_type, 'mercadolivre');
  assert.equal(mlCalls[0].externalId, 'pack-42');
  assert.equal(mlCalls[0].content, 'Já enviamos seu pedido!');
});

// A partir daqui: validação de assinatura HMAC-SHA256 (X-Libredesk-Signature),
// só ativa quando WEBHOOK_SECRET está configurado — ver isValidSignature em
// src/webhook/libredesk.js e docs.libredesk.io/configuration/webhooks. Os
// testes acima já cobrem o padrão atual (sem secret = sem checagem, request
// sempre processada); os de baixo cobrem o que muda quando o secret existe.

test('com WEBHOOK_SECRET configurado, aceita e processa requisição com assinatura válida', async () => {
  const calls = [];
  await withWebhookSecret(TEST_WEBHOOK_SECRET, async () => {
    await withMockConnectorSend('whatsapp', async (mapping, externalId, content) => {
      calls.push({ mapping, externalId, content });
    }, async () => {
      const res = await postReply({
        conversation_id: LIBREDESK_CONVERSATION_ID,
        content: 'Resposta com assinatura batendo',
        message_type: 'outgoing',
      }, { secret: TEST_WEBHOOK_SECRET });
      assert.equal(res.status, 200);
      await waitFor(() => calls.length > 0);
    });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].content, 'Resposta com assinatura batendo');
});

test('com WEBHOOK_SECRET configurado, rejeita com 401 quando o segredo usado pra assinar não bate (adulteração/dessincronia)', async () => {
  const calls = [];
  await withWebhookSecret(TEST_WEBHOOK_SECRET, async () => {
    await withMockConnectorSend('whatsapp', async (...args) => { calls.push(args); }, async () => {
      const res = await postReply({
        conversation_id: LIBREDESK_CONVERSATION_ID,
        content: 'Assinada com outro segredo',
        message_type: 'outgoing',
      }, { secret: 'segredo-diferente-do-configurado' });
      assert.equal(res.status, 401);
    });
  });

  assert.equal(calls.length, 0);
});

test('com WEBHOOK_SECRET configurado, rejeita com 401 quando o header de assinatura está ausente', async () => {
  const calls = [];
  await withWebhookSecret(TEST_WEBHOOK_SECRET, async () => {
    await withMockConnectorSend('whatsapp', async (...args) => { calls.push(args); }, async () => {
      const res = await postReply({
        conversation_id: LIBREDESK_CONVERSATION_ID,
        content: 'Sem header X-Libredesk-Signature',
        message_type: 'outgoing',
      });
      assert.equal(res.status, 401);
    });
  });

  assert.equal(calls.length, 0);
});

test('com WEBHOOK_SECRET configurado, rejeita com 401 (sem derrubar o processo) quando o header tem formato inesperado', async () => {
  const calls = [];
  await withWebhookSecret(TEST_WEBHOOK_SECRET, async () => {
    await withMockConnectorSend('whatsapp', async (...args) => { calls.push(args); }, async () => {
      // Tamanho diferente do esperado ("sha256=" + 64 hex) — exercita o guard
      // que evita o RangeError do crypto.timingSafeEqual com buffers desiguais.
      const res = await postReply({
        conversation_id: LIBREDESK_CONVERSATION_ID,
        content: 'Header de assinatura mal formado',
        message_type: 'outgoing',
      }, { signature: 'isso-não-é-um-sha256=valido' });
      assert.equal(res.status, 401);
    });
  });

  assert.equal(calls.length, 0);
});
