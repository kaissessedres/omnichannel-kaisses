// Testa o conector Shopee (Open Platform v2) simulando a API via mock de
// global.fetch. Não bate na API real (que exige app aprovado) — valida a
// assinatura HMAC, o mapeamento das mensagens, o envio e o refresh de token.

process.env.SHOPEE_PARTNER_ID = '2000';
process.env.SHOPEE_PARTNER_KEY = 'shopee-partner-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DB_PATH = ':memory:'; // p/ o teste de refresh, que persiste via saveCredentials

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const shopee = require('../../src/connectors/shopee');
const { encrypt, getCredentials } = require('../../src/db/crypto');
const { initDb } = require('../../src/db/schema');
const queries = require('../../src/db/queries');
const { withMockFetch } = require('../helpers');

const account = {
  credentials: encrypt(JSON.stringify({ shop_id: 123, access_token: 'AT', refresh_token: 'RT' })),
};

test('signRequest assina com HMAC-SHA256 sobre partner_id+path+timestamp+access_token+shop_id', () => {
  const path = '/api/v2/sellerchat/get_message';
  const expected = crypto.createHmac('sha256', 'shopee-partner-key')
    .update(`2000${path}1700000000AT123`).digest('hex');
  assert.equal(shopee.signRequest(path, 1700000000, 'AT', '123'), expected);
});

test('fetchNewMessages assina a chamada e mapeia as conversas', async () => {
  let calledUrl;
  await withMockFetch(async (url) => {
    calledUrl = url;
    return { json: async () => ({ error: '', response: { conversations: [
      { to_id: 555, to_name: 'Comprador X', latest_message_id: 'm10', latest_message_content: { text: 'oi' }, last_message_timestamp: 1700000000 },
    ] } }) };
  }, async () => {
    const msgs = await shopee.fetchNewMessages(account, null);
    assert.equal(msgs.length, 1);
    assert.deepEqual(msgs[0], {
      id: 'm10', conversationId: '555', contactId: '555',
      contactName: 'Comprador X', text: 'oi', createdAt: 1700000000,
    });
  });

  assert.match(calledUrl, /\/api\/v2\/sellerchat\/get_conversation_list\?/);
  assert.match(calledUrl, /partner_id=2000/);
  assert.match(calledUrl, /access_token=AT/);
  assert.match(calledUrl, /shop_id=123/);
  assert.match(calledUrl, /sign=[0-9a-f]{64}/);
});

test('fetchNewMessages pula mensagens já processadas (lastMessageId)', async () => {
  await withMockFetch(async () => ({ json: async () => ({ error: '', response: { conversations: [
    { to_id: 555, latest_message_id: 'm10', latest_message_content: { text: 'oi' } },
  ] } }) }), async () => {
    assert.deepEqual(await shopee.fetchNewMessages(account, 'm10'), []);
  });
});

test('sendMessage faz POST em send_message com to_id, message_type e content.text', async () => {
  let captured;
  await withMockFetch(async (url, opts) => {
    captured = { url, opts };
    return { json: async () => ({ error: '', response: { message_id: 'sent-1' } }) };
  }, async () => {
    const res = await shopee.sendMessage(account, '555', 'Olá, tudo certo?');
    assert.equal(res.response.message_id, 'sent-1');
  });

  assert.match(captured.url, /\/api\/v2\/sellerchat\/send_message\?/);
  assert.equal(captured.opts.method, 'POST');
  assert.deepEqual(JSON.parse(captured.opts.body), { to_id: 555, message_type: 'text', content: { text: 'Olá, tudo certo?' } });
});

test('init rejeita quando a Shopee devolve erro', async () => {
  await withMockFetch(async () => ({ json: async () => ({ error: 'error_param', message: 'invalid' }) }), async () => {
    await assert.rejects(() => shopee.init(account), /Shopee init falhou: error_param/);
  });
});

test('fetchNewMessages renova o token em erro de auth, persiste e refaz a chamada', async () => {
  initDb();
  const { lastInsertRowid: id } = queries.createAccount({
    channelType: 'shopee',
    accountLabel: 'Shopee 1',
    credentials: { shop_id: 123, access_token: 'OLD', refresh_token: 'ROLD' },
    libredeskInboxId: 8,
  });
  const accountFromDb = queries.getAccountById(id);

  let convCalls = 0;
  await withMockFetch(async (url) => {
    if (url.includes('/api/v2/auth/access_token/get')) {
      return { json: async () => ({ access_token: 'NEW', refresh_token: 'RNEW', expire_in: 14400 }) };
    }
    convCalls += 1;
    if (convCalls === 1) return { json: async () => ({ error: 'error_auth', message: 'invalid access_token' }) };
    return { json: async () => ({ error: '', response: { conversations: [] } }) };
  }, async () => {
    await shopee.fetchNewMessages(accountFromDb, null);
  });

  assert.equal(convCalls, 2, 'deve refazer a chamada após renovar');
  assert.deepEqual(getCredentials(queries.getAccountById(id)), { shop_id: 123, access_token: 'NEW', refresh_token: 'RNEW' });
});

test('getContact devolve um contato neutro (o nome real vem em fetchNewMessages)', async () => {
  assert.deepEqual(await shopee.getContact(account, '555'), { name: '555', identifier: '555' });
});
