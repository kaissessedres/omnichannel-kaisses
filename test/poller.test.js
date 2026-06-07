// Testa o orquestrador de polling (Instagram + Mercado Livre). `pollAccount`
// é a função com toda a lógica que importa, mas não é exportada — só
// `startPolling`, que registra um cron a cada 30s. Por isso trocamos
// `cron.schedule` (node-cron, módulo cacheado) por um mock que captura o
// callback e deixa o teste disparar um "tick" manualmente — sem esperar o
// timer real nem acumular agendamentos de verdade.

process.env.DB_PATH = ':memory:';
process.env.LIBREDESK_URL = 'http://libredesk.test';
process.env.LIBREDESK_API_KEY = 'ld-test-key';
process.env.LIBREDESK_ACCOUNT_ID = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('node-cron');

const { getDb, initDb } = require('../src/db/schema');
const queries = require('../src/db/queries');
const { POLLED } = require('../src/connectors');
const { startPolling } = require('../src/poller');
const { withMockFetch, seedAccount } = require('./helpers');

let tick;
const originalSchedule = cron.schedule;
cron.schedule = (_expression, fn) => { tick = fn; return { stop() {} }; };
test.after(() => { cron.schedule = originalSchedule; });

startPolling();

// Troca temporariamente fetchNewMessages do conector `channelType` — mesmo
// truque de cache do require usado em mercadolivre.test.js / libredesk.test.js.
async function withMockFetchMessages(channelType, impl, fn) {
  const connector = POLLED[channelType];
  const original = connector.fetchNewMessages;
  connector.fetchNewMessages = impl;
  try {
    return await fn();
  } finally {
    connector.fetchNewMessages = original;
  }
}

// Mock de fetch que simula a API do Libredesk e registra as chamadas feitas
// (mesmo formato usado em test/webhook/evolution.test.js).
function mockLibredesk() {
  const calls = [];
  const impl = async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : undefined;
    calls.push({ url, method: opts?.method, body });
    if (url.endsWith('/conversations') && opts.method === 'POST') {
      return { ok: true, json: async () => ({ id: 555 }) };
    }
    if (/\/conversations\/\d+\/messages$/.test(url) && opts.method === 'POST') {
      return { ok: true, json: async () => ({ id: 1 }) };
    }
    return { ok: false, status: 404, text: async () => 'unexpected URL in test mock' };
  };
  return { impl, calls };
}

let accountId;

test.before(() => initDb());

test.beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM ConversationMapping; DELETE FROM SyncState; DELETE FROM ChannelAccount;');
  accountId = seedAccount(db, {
    channel_type: 'instagram',
    account_label: 'Instagram Loja',
    evolution_instance_id: null,
    libredesk_inbox_id: 9,
  });
});

test('contato novo: cria conversa no Libredesk, grava o mapeamento e atualiza o estado de sync', async () => {
  const { impl, calls } = mockLibredesk();
  await withMockFetchMessages('instagram', async () => [
    { id: 'm200', conversationId: 'conv-1', contactId: 'user-1', contactName: 'Maria', text: 'Olá!', createdAt: '2026-06-07T10:00:00Z' },
  ], async () => {
    await withMockFetch(impl, () => tick());
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/conversations$/);
  assert.deepEqual(calls[0].body, {
    inbox_id: 9,
    contact: { name: 'Maria', identifier: 'user-1' },
    message: { content: 'Olá!' },
    additional_attributes: { channel_label: 'Instagram Loja' },
  });

  assert.equal(queries.findMapping(accountId, 'conv-1').libredesk_conversation_id, 555);

  const state = queries.getSyncState(accountId);
  assert.equal(state.last_external_message_id, 'm200');
  assert.equal(state.error_count, 0);

  const account = getDb().prepare('SELECT last_synced_at FROM ChannelAccount WHERE id = ?').get(accountId);
  assert.ok(account.last_synced_at, 'updateLastSynced deveria ter gravado last_synced_at');
});

test('contato já mapeado: roteia a mensagem como reply na conversa existente (não duplica)', async () => {
  queries.createMapping({
    libredeskConversationId: 777,
    channelAccountId: accountId,
    externalConversationId: 'conv-1',
    externalContactId: 'user-1',
  });

  const { impl, calls } = mockLibredesk();
  await withMockFetchMessages('instagram', async () => [
    { id: 'm201', conversationId: 'conv-1', contactId: 'user-1', contactName: 'Maria', text: 'Outra mensagem', createdAt: '2026-06-07T10:05:00Z' },
  ], async () => {
    await withMockFetch(impl, () => tick());
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/conversations\/777\/messages$/);
  assert.deepEqual(calls[0].body, { content: 'Outra mensagem', message_type: 'incoming' });
  // Continua com um único mapeamento — não criou conversa duplicada
  assert.equal(queries.findMapping(accountId, 'conv-1').libredesk_conversation_id, 777);
});

test('sem mensagens novas: não chama o Libredesk nem grava estado de sync', async () => {
  const { impl, calls } = mockLibredesk();
  await withMockFetchMessages('instagram', async () => [], async () => {
    await withMockFetch(impl, () => tick());
  });

  assert.equal(calls.length, 0);
  assert.equal(queries.getSyncState(accountId), undefined);
});

test('erro ao buscar mensagens: incrementa error_count sem derrubar o ciclo nem marcar a conta', async () => {
  await withMockFetchMessages('instagram', async () => {
    throw new Error('Graph API fora do ar');
  }, () => tick());

  const state = queries.getSyncState(accountId);
  assert.equal(state.error_count, 1);
  assert.equal(state.last_error, 'Graph API fora do ar');

  const account = getDb().prepare('SELECT status FROM ChannelAccount WHERE id = ?').get(accountId);
  assert.equal(account.status, 'active');
});

test('5 falhas consecutivas: marca a conta como erro (e ela some das contas ativas)', async () => {
  await withMockFetchMessages('instagram', async () => {
    throw new Error('falha persistente');
  }, async () => {
    for (let i = 0; i < 5; i += 1) await tick();
  });

  const account = getDb().prepare('SELECT status FROM ChannelAccount WHERE id = ?').get(accountId);
  assert.equal(account.status, 'error');

  const state = queries.getSyncState(accountId);
  assert.equal(state.error_count, 5);
  assert.deepEqual(queries.getActiveAccounts('instagram'), []);
});

test('cada ciclo consulta contas ativas de Instagram e Mercado Livre (não só uma)', async () => {
  const mlAccountId = seedAccount(getDb(), {
    channel_type: 'mercadolivre',
    account_label: 'ML Conta 1',
    credentials: '{"seller_id":"123"}',
    evolution_instance_id: null,
    libredesk_inbox_id: 3,
  });

  const seen = [];
  const { impl } = mockLibredesk();
  await withMockFetchMessages('instagram', async (account) => { seen.push(account.id); return []; }, async () => {
    await withMockFetchMessages('mercadolivre', async (account) => { seen.push(account.id); return []; }, async () => {
      await withMockFetch(impl, () => tick());
    });
  });

  assert.deepEqual(seen.sort((a, b) => a - b), [accountId, mlAccountId].sort((a, b) => a - b));
});
