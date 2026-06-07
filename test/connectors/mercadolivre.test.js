// Testa src/connectors/mercadolivre.js. O conector usa o SDK oficial
// `mercadolibre`, que por baixo dos panos usa `needle` para HTTP. Como
// `require` cacheia módulos, o objeto `needle` é o MESMO em todo o processo —
// então dá pra trocar `needle.get`/`needle.post` por mocks e o SDK passa a
// usá-los, sem precisar de proxyquire/jest nem bater na API real do ML.

const test = require('node:test');
const assert = require('node:assert/strict');
const needle = require('needle');

process.env.ML_APP_ID = 'app-id';
process.env.ML_APP_SECRET = 'app-secret';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

const mercadolivre = require('../../src/connectors/mercadolivre');
const { encrypt } = require('../../src/db/crypto');

// Em produção `credentials` chega cifrado (ver src/db/crypto.js) — o
// conector decifra antes de usar, então o teste precisa cifrar também
// pra simular o dado real chegando do banco.
const account = {
  credentials: encrypt(JSON.stringify({ access_token: 'TOKEN123', refresh_token: 'REFRESH456', seller_id: '999' })),
};

// Substitui needle.get/needle.post durante `fn` e restaura no final.
// `impl` recebe (url, ...) e devolve o "body" que o SDK repassa pro conector.
async function withMockNeedle({ get, post }, fn) {
  const originalGet = needle.get;
  const originalPost = needle.post;
  if (get) needle.get = (url, _opts, cb) => get(url, cb);
  if (post) needle.post = (url, body, _opts, cb) => post(url, body, cb);
  try {
    return await fn();
  } finally {
    needle.get = originalGet;
    needle.post = originalPost;
  }
}

test('init busca /users/me com o token da conta (autenticação ok)', async () => {
  let calledUrl;
  await withMockNeedle({
    get: (url, cb) => { calledUrl = url; cb(null, { body: { id: 123, nickname: 'lojista' } }); },
  }, async () => {
    await assert.doesNotReject(() => mercadolivre.init(account));
  });
  assert.match(calledUrl, /\/users\/me\?.*access_token=TOKEN123/);
});

test('init rejeita quando a API do ML devolve erro', async () => {
  await withMockNeedle({
    get: (_url, cb) => cb(new Error('401 Unauthorized'), null),
  }, async () => {
    await assert.rejects(() => mercadolivre.init(account), /ML GET \/users\/me failed/);
  });
});

test('fetchNewMessages mapeia os packs e filtra pelo último ID processado', async () => {
  await withMockNeedle({
    get: (_url, cb) => cb(null, { body: {
      results: [
        { id: 100, pack_id: 555, from: { user_id: 'comprador-1' }, text: { plain: 'mensagem antiga' }, date_created: '2026-06-01T10:00:00Z' },
        { id: 101, pack_id: 556, from: { user_id: 'comprador-2' }, text: { plain: 'mensagem nova' }, date_created: '2026-06-02T10:00:00Z' },
      ],
    } }),
  }, async () => {
    const messages = await mercadolivre.fetchNewMessages(account, 100);

    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], {
      id: 101,
      conversationId: '556',
      contactId: 'comprador-2',
      contactName: 'comprador-2',
      text: 'mensagem nova',
      createdAt: '2026-06-02T10:00:00Z',
    });
  });
});

test('fetchNewMessages devolve tudo quando não há lastMessageId (primeira sincronização)', async () => {
  await withMockNeedle({
    get: (_url, cb) => cb(null, { body: { results: [
      { id: 1, pack_id: 10, from: { user_id: 'u1' }, text: { plain: 'oi' }, date_created: '2026-06-01T10:00:00Z' },
    ] } }),
  }, async () => {
    const messages = await mercadolivre.fetchNewMessages(account, null);
    assert.equal(messages.length, 1);
  });
});

test('fetchNewMessages lida com resposta sem resultados', async () => {
  await withMockNeedle({ get: (_url, cb) => cb(null, { body: {} }) }, async () => {
    const messages = await mercadolivre.fetchNewMessages(account, null);
    assert.deepEqual(messages, []);
  });
});

test('sendMessage envia o texto no corpo da requisição (não na query string)', async () => {
  let captured;
  await withMockNeedle({
    post: (url, body, cb) => { captured = { url, body }; cb(null, { body: { status: 'sent' } }); },
  }, async () => {
    const result = await mercadolivre.sendMessage(account, '556', 'Olá, tudo bem?');
    assert.deepEqual(result, { status: 'sent' });
  });

  // Regressão do bug: o texto tem que ir no corpo HTTP. Se a ordem dos
  // argumentos pro SDK estiver trocada, ele vira "[object Object]" na URL
  // e o corpo chega vazio no servidor do ML.
  assert.match(captured.url, /\/messages\/packs\/556\/sellers\/999/);
  assert.deepEqual(captured.body, { text: { plain: 'Olá, tudo bem?' } });
  assert.doesNotMatch(captured.url, /\[object Object\]/);
});

test('sendMessage rejeita quando a API do ML recusa o envio', async () => {
  await withMockNeedle({
    post: (_url, _body, cb) => cb(new Error('429 Too Many Requests'), null),
  }, async () => {
    await assert.rejects(() => mercadolivre.sendMessage(account, '556', 'oi'), /ML POST .* failed/);
  });
});

test('getContact devolve o nickname quando o usuário é encontrado', async () => {
  await withMockNeedle({
    get: (_url, cb) => cb(null, { body: { id: 'comprador-1', nickname: 'JOAO123' } }),
  }, async () => {
    const contact = await mercadolivre.getContact(account, 'comprador-1');
    assert.deepEqual(contact, { name: 'JOAO123', identifier: 'comprador-1' });
  });
});

test('getContact cai para o ID quando a busca falha', async () => {
  await withMockNeedle({
    get: (_url, cb) => cb(new Error('404 Not Found'), null),
  }, async () => {
    const contact = await mercadolivre.getContact(account, 'comprador-1');
    assert.deepEqual(contact, { name: 'comprador-1', identifier: 'comprador-1' });
  });
});
