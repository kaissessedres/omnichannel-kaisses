// Testa src/connectors/instagram.js simulando a Meta Graph API via mock de
// global.fetch (o conector usa fetch nativo — não precisa de rede real).

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.INSTAGRAM_ACCESS_TOKEN = 'env-fallback-token';

const instagram = require('../../src/connectors/instagram');
const { withMockFetch } = require('../helpers');

const GRAPH_URL = 'https://graph.facebook.com/v19.0';
const accountWithToken = { credentials: '{"access_token":"page-token-abc"}' };
const accountWithoutToken = { credentials: '{}' };

test('init usa o token da conta quando presente e resolve em caso de sucesso', async () => {
  await withMockFetch(async (url) => {
    assert.equal(url, `${GRAPH_URL}/me?access_token=page-token-abc`);
    return { ok: true, json: async () => ({ id: 'ig-user-1' }) };
  }, async () => {
    await assert.doesNotReject(() => instagram.init(accountWithToken));
  });
});

test('init cai para INSTAGRAM_ACCESS_TOKEN quando a conta não tem token salvo', async () => {
  await withMockFetch(async (url) => {
    assert.equal(url, `${GRAPH_URL}/me?access_token=env-fallback-token`);
    return { ok: true, json: async () => ({ id: 'ig-user-1' }) };
  }, async () => {
    await instagram.init(accountWithoutToken);
  });
});

test('init rejeita quando a Graph API recusa o token', async () => {
  await withMockFetch(async () => ({ ok: false, status: 401 }), async () => {
    await assert.rejects(() => instagram.init(accountWithToken), /Instagram init failed: 401/);
  });
});

test('fetchNewMessages mapeia conversas e filtra pelo último ID processado', async () => {
  await withMockFetch(async (url) => {
    assert.match(url, /\/me\/conversations\?fields=/);
    assert.match(url, /access_token=page-token-abc/);
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'conv-1',
            messages: { data: [
              { id: 'm1', message: 'mensagem antiga', from: { id: 'u1', name: 'Cliente Um' }, created_time: '2026-06-01T10:00:00Z' },
              { id: 'm2', message: 'mensagem nova', from: { id: 'u1', name: 'Cliente Um' }, created_time: '2026-06-02T10:00:00Z' },
            ] },
          },
          {
            id: 'conv-2',
            messages: { data: [
              { id: 'm3', message: 'outra conversa', from: { id: 'u2' }, created_time: '2026-06-02T11:00:00Z' },
            ] },
          },
        ],
      }),
    };
  }, async () => {
    const messages = await instagram.fetchNewMessages(accountWithToken, 'm1');

    assert.equal(messages.length, 2);
    assert.deepEqual(messages[0], {
      id: 'm2',
      conversationId: 'conv-1',
      contactId: 'u1',
      contactName: 'Cliente Um',
      text: 'mensagem nova',
      createdAt: '2026-06-02T10:00:00Z',
    });
    // Sem nome de contato, cai para o ID — mesmo padrão usado no resto da app
    assert.equal(messages[1].contactName, 'u2');
  });
});

test('fetchNewMessages devolve tudo quando não há lastMessageId (primeira sincronização)', async () => {
  await withMockFetch(async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 'conv-1', messages: { data: [
      { id: 'm1', message: 'oi', from: { id: 'u1' }, created_time: '2026-06-01T10:00:00Z' },
    ] } }] }),
  }), async () => {
    const messages = await instagram.fetchNewMessages(accountWithToken, null);
    assert.equal(messages.length, 1);
  });
});

test('fetchNewMessages lida com conversas sem mensagens', async () => {
  await withMockFetch(async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 'conv-vazia' }] }),
  }), async () => {
    const messages = await instagram.fetchNewMessages(accountWithToken, null);
    assert.deepEqual(messages, []);
  });
});

test('fetchNewMessages rejeita quando a Graph API falha', async () => {
  await withMockFetch(async () => ({ ok: false, status: 500 }), async () => {
    await assert.rejects(() => instagram.fetchNewMessages(accountWithToken, null), /Instagram fetchMessages failed: 500/);
  });
});

test('sendMessage faz POST em /{conversationId}/messages com o token no corpo', async () => {
  await withMockFetch(async (url, opts) => {
    assert.equal(url, `${GRAPH_URL}/conv-1/messages`);
    assert.equal(opts.method, 'POST');
    assert.deepEqual(JSON.parse(opts.body), { message: 'Olá!', access_token: 'page-token-abc' });
    return { ok: true, json: async () => ({ message_id: 'sent-1' }) };
  }, async () => {
    const result = await instagram.sendMessage(accountWithToken, 'conv-1', 'Olá!');
    assert.deepEqual(result, { message_id: 'sent-1' });
  });
});

test('sendMessage propaga o corpo do erro quando a Graph API recusa', async () => {
  await withMockFetch(async () => ({ ok: false, status: 403, text: async () => 'permission denied' }), async () => {
    await assert.rejects(
      () => instagram.sendMessage(accountWithToken, 'conv-1', 'Olá!'),
      /Instagram sendMessage failed: 403 permission denied/
    );
  });
});

test('getContact devolve o nome quando a Graph API responde', async () => {
  await withMockFetch(async (url) => {
    assert.equal(url, `${GRAPH_URL}/u1?fields=name&access_token=page-token-abc`);
    return { ok: true, json: async () => ({ name: 'Cliente Um' }) };
  }, async () => {
    const contact = await instagram.getContact(accountWithToken, 'u1');
    assert.deepEqual(contact, { name: 'Cliente Um', identifier: 'u1' });
  });
});

test('getContact cai para o ID quando a Graph API falha ou não traz nome', async () => {
  await withMockFetch(async () => ({ ok: false, status: 404 }), async () => {
    const contact = await instagram.getContact(accountWithToken, 'u1');
    assert.deepEqual(contact, { name: 'u1', identifier: 'u1' });
  });
});
