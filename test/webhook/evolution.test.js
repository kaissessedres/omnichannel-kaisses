// Testa o webhook que recebe mensagens da Evolution API (WhatsApp).
// Sobe o router num servidor HTTP efêmero, mocka o fetch usado pelo cliente
// do Libredesk e usa um SQLite real em memória — cobre o fluxo de ponta a
// ponta (parse do evento → roteamento → gravação do mapeamento) sem Docker
// nem credenciais reais.

process.env.DB_PATH = ':memory:';
process.env.LIBREDESK_URL = 'http://libredesk.test';
process.env.LIBREDESK_API_KEY = 'ld-test-key';
process.env.LIBREDESK_ACCOUNT_ID = '1';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getDb, initDb } = require('../../src/db/schema');
const queries = require('../../src/db/queries');
const evolutionWebhook = require('../../src/webhook/evolution');
const { startRouterServer, withMockFetch, waitFor, seedAccount } = require('../helpers');

// Guarda o fetch real ANTES de qualquer mock — postEvent precisa bater no
// servidor de teste de verdade, mesmo enquanto global.fetch está mockado
// para simular a API do Libredesk (senão a própria chamada do teste cairia
// no mock e devolveria 404).
const realFetch = global.fetch;

let server;
let accountId;

test.before(async () => {
  initDb();
  server = await startRouterServer('/webhook/evolution', evolutionWebhook);
});

test.after(() => server.close());

test.beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM ConversationMapping; DELETE FROM SyncState; DELETE FROM ChannelAccount;');
  accountId = seedAccount(db, {
    channel_type: 'whatsapp',
    account_label: 'WhatsApp Loja',
    evolution_instance_id: 'megachat-wa-1',
    libredesk_inbox_id: 7,
  });
});

function evolutionEvent(overrides = {}) {
  return {
    event: 'messages.upsert',
    instance: 'megachat-wa-1',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
      message: { conversation: 'Olá, vocês têm o produto X?' },
    },
    ...overrides,
  };
}

function postEvent(payload) {
  return realFetch(`${server.baseUrl}/webhook/evolution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Mock de fetch que simula a API do Libredesk e registra as chamadas feitas.
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

test('mensagem de contato novo cria conversa no Libredesk e grava o mapeamento', async () => {
  const { impl, calls } = mockLibredesk();

  await withMockFetch(impl, async () => {
    const res = await postEvent(evolutionEvent());
    assert.equal(res.status, 200);
    await waitFor(() => queries.findMapping(accountId, '5511999999999'));
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/v1\/accounts\/1\/conversations$/);
  assert.deepEqual(calls[0].body, {
    inbox_id: 7,
    contact: { name: '5511999999999', identifier: '5511999999999' },
    message: { content: 'Olá, vocês têm o produto X?' },
    additional_attributes: { channel_label: 'WhatsApp' },
  });
  assert.equal(queries.findMapping(accountId, '5511999999999').libredesk_conversation_id, 555);
});

test('mensagem de contato já mapeado é roteada pra conversa existente (não duplica)', async () => {
  queries.createMapping({
    libredeskConversationId: 777,
    channelAccountId: accountId,
    externalConversationId: '5511999999999',
    externalContactId: '5511999999999',
  });

  const { impl, calls } = mockLibredesk();
  await withMockFetch(impl, async () => {
    const res = await postEvent(evolutionEvent());
    assert.equal(res.status, 200);
    await waitFor(() => calls.length > 0);
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/v1\/accounts\/1\/conversations\/777\/messages$/);
  assert.deepEqual(calls[0].body, { content: 'Olá, vocês têm o produto X?', message_type: 'incoming' });
  // Continua com um único mapeamento — não criou conversa duplicada
  assert.equal(queries.findMapping(accountId, '5511999999999').libredesk_conversation_id, 777);
});

test('mensagens enviadas pelo próprio lojista (fromMe) são ignoradas', async () => {
  const { impl, calls } = mockLibredesk();
  await withMockFetch(impl, async () => {
    const res = await postEvent(evolutionEvent({
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true }, message: { conversation: 'oi' } },
    }));
    assert.equal(res.status, 200);
  });

  assert.equal(calls.length, 0);
  assert.equal(queries.findMapping(accountId, '5511999999999'), undefined);
});

test('eventos de instância desconhecida são ignorados', async () => {
  const { impl, calls } = mockLibredesk();
  await withMockFetch(impl, async () => {
    const res = await postEvent(evolutionEvent({ instance: 'instancia-que-nao-existe' }));
    assert.equal(res.status, 200);
  });

  assert.equal(calls.length, 0);
});

test('eventos que não são messages.upsert são ignorados', async () => {
  const { impl, calls } = mockLibredesk();
  await withMockFetch(impl, async () => {
    const res = await postEvent(evolutionEvent({ event: 'connection.update', data: { state: 'open' } }));
    assert.equal(res.status, 200);
  });

  assert.equal(calls.length, 0);
});

test('mensagens de mídia (sem texto) usam o texto de fallback "[mídia não suportada]"', async () => {
  const { impl, calls } = mockLibredesk();
  await withMockFetch(impl, async () => {
    const res = await postEvent(evolutionEvent({
      data: {
        key: { remoteJid: '5511988888888@s.whatsapp.net', fromMe: false },
        message: { imageMessage: { caption: 'foto do produto' } },
      },
    }));
    assert.equal(res.status, 200);
    await waitFor(() => queries.findMapping(accountId, '5511988888888'));
  });

  assert.equal(calls[0].body.message.content, '[mídia não suportada]');
});
