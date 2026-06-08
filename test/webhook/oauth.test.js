// Testa o roteador OAuth (src/webhook/oauth.js): /start redireciona pra
// autorização e /callback troca o code pelo token e persiste cifrado. A troca
// real (exchangeCode) é testada nos testes dos conectores; aqui mockamos os
// métodos do conector pra exercitar a orquestração da rota (state → conta →
// troca → saveCredentials → status ativo), com SQLite real em memória.

process.env.DB_PATH = ':memory:';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.OAUTH_REDIRECT_URI = 'https://megachat.example/oauth/callback';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getDb, initDb } = require('../../src/db/schema');
const queries = require('../../src/db/queries');
const { getCredentials } = require('../../src/db/crypto');
const mercadolivre = require('../../src/connectors/mercadolivre');
const instagram = require('../../src/connectors/instagram');
const oauthRouter = require('../../src/webhook/oauth');
const { startRouterServer } = require('../helpers');

let server;

test.before(async () => {
  initDb();
  server = await startRouterServer('/oauth', oauthRouter);
});

test.after(() => server.close());

test.beforeEach(() => {
  getDb().exec('DELETE FROM ConversationMapping; DELETE FROM SyncState; DELETE FROM ChannelAccount;');
});

// Troca temporariamente um método do conector (mesmo objeto que a rota importa,
// via cache do require) e restaura no final.
async function withMockMethod(obj, name, impl, fn) {
  const original = obj[name];
  obj[name] = impl;
  try {
    return await fn();
  } finally {
    obj[name] = original;
  }
}

function seedDisconnectedML() {
  const { lastInsertRowid } = queries.createAccount({
    channelType: 'mercadolivre',
    accountLabel: 'ML a conectar',
    credentials: {},
    libredeskInboxId: 3,
    status: 'disconnected',
  });
  return lastInsertRowid;
}

test('/callback troca o code, persiste as credenciais cifradas e ativa a conta', async () => {
  const id = seedDisconnectedML();
  let receivedArgs;
  await withMockMethod(mercadolivre, 'exchangeCode', async (code, redirectUri) => {
    receivedArgs = { code, redirectUri };
    return { access_token: 'AT', refresh_token: 'RT', seller_id: '777' };
  }, async () => {
    const res = await fetch(`${server.baseUrl}/oauth/callback?code=the-code&state=${id}`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /conectada/i);
  });

  assert.deepEqual(receivedArgs, { code: 'the-code', redirectUri: 'https://megachat.example/oauth/callback' });
  const account = queries.getAccountById(id);
  assert.equal(account.status, 'active');
  assert.deepEqual(getCredentials(account), { access_token: 'AT', refresh_token: 'RT', seller_id: '777' });
});

test('/callback com state desconhecido responde 404 e não cria conta', async () => {
  const res = await fetch(`${server.baseUrl}/oauth/callback?code=x&state=99999`);
  assert.equal(res.status, 404);
});

test('/callback sem code responde 400', async () => {
  const id = seedDisconnectedML();
  const res = await fetch(`${server.baseUrl}/oauth/callback?state=${id}`);
  assert.equal(res.status, 400);
});

test('/callback com erro de autorização (?error=...) responde 400', async () => {
  const res = await fetch(`${server.baseUrl}/oauth/callback?error=access_denied&state=1`);
  assert.equal(res.status, 400);
});

test('/callback responde 502 e mantém a conta inativa quando a troca falha', async () => {
  const id = seedDisconnectedML();
  await withMockMethod(mercadolivre, 'exchangeCode', async () => { throw new Error('ML authorize falhou'); }, async () => {
    const res = await fetch(`${server.baseUrl}/oauth/callback?code=bad&state=${id}`);
    assert.equal(res.status, 502);
  });
  const account = queries.getAccountById(id);
  assert.equal(account.status, 'disconnected');
  assert.deepEqual(getCredentials(account), {});
});

test('/start redireciona (302) para a URL de autorização do canal da conta', async () => {
  const id = seedDisconnectedML();
  await withMockMethod(mercadolivre, 'getAuthUrl', (redirectUri, state) => {
    assert.equal(redirectUri, 'https://megachat.example/oauth/callback');
    assert.equal(state, String(id));
    return 'https://auth.mercadolibre.com/authorization?x=1';
  }, async () => {
    const res = await fetch(`${server.baseUrl}/oauth/start?account=${id}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://auth.mercadolibre.com/authorization?x=1');
  });
});

test('/start com conta inexistente responde 404', async () => {
  const res = await fetch(`${server.baseUrl}/oauth/start?account=99999`);
  assert.equal(res.status, 404);
});

// instagram é importado só pra garantir que o canal está registrado no roteador
// (cobertura do mapeamento OAUTH_CONNECTORS sem depender de rede).
test('o roteador reconhece instagram como canal com fluxo OAuth', async () => {
  const { lastInsertRowid: id } = queries.createAccount({
    channelType: 'instagram', accountLabel: 'IG a conectar', credentials: {}, libredeskInboxId: 5, status: 'disconnected',
  });
  await withMockMethod(instagram, 'exchangeCode', async () => ({ access_token: 'IG_LONG', expires_at: Date.now() + 5184000000 }), async () => {
    const res = await fetch(`${server.baseUrl}/oauth/callback?code=ig-code&state=${id}`);
    assert.equal(res.status, 200);
  });
  assert.equal(queries.getAccountById(id).status, 'active');
});
