// Testa src/connectors/whatsapp.js simulando a Evolution API via mock de
// global.fetch (o conector usa fetch nativo — não precisa de SDK nem rede real).

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.EVOLUTION_API_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'test-key';

const whatsapp = require('../../src/connectors/whatsapp');
const { withMockFetch } = require('../helpers');

const account = { evolution_instance_id: 'megachat-wa-1' };

test('init resolve quando a instância existe na Evolution API', async () => {
  await withMockFetch(async (url, opts) => {
    assert.equal(url, 'http://evolution.test/instance/fetchInstances');
    assert.equal(opts.headers.apikey, 'test-key');
    return { ok: true, json: async () => [{ instance: { instanceName: 'megachat-wa-1' } }] };
  }, async () => {
    await assert.doesNotReject(() => whatsapp.init(account));
  });
});

test('init rejeita quando a instância não está cadastrada na Evolution API', async () => {
  await withMockFetch(async () => ({
    ok: true,
    json: async () => [{ instance: { instanceName: 'outra-instancia' } }],
  }), async () => {
    await assert.rejects(() => whatsapp.init(account), /not found in Evolution API/);
  });
});

test('init rejeita quando a Evolution API está inacessível', async () => {
  await withMockFetch(async () => ({ ok: false, status: 503 }), async () => {
    await assert.rejects(() => whatsapp.init(account), /Evolution API unreachable: 503/);
  });
});

test('sendMessage faz POST em /message/sendText/{instance} com number e text', async () => {
  await withMockFetch(async (url, opts) => {
    assert.equal(url, 'http://evolution.test/message/sendText/megachat-wa-1');
    assert.equal(opts.method, 'POST');
    assert.deepEqual(JSON.parse(opts.body), { number: '5511999999999', text: 'Olá!' });
    return { ok: true, json: async () => ({ status: 'sent' }) };
  }, async () => {
    const result = await whatsapp.sendMessage(account, '5511999999999', 'Olá!');
    assert.deepEqual(result, { status: 'sent' });
  });
});

test('sendMessage propaga erro quando a Evolution API recusa o envio', async () => {
  await withMockFetch(async () => ({ ok: false, status: 400, text: async () => 'instance not connected' }), async () => {
    await assert.rejects(
      () => whatsapp.sendMessage(account, '5511999999999', 'Olá!'),
      /Evolution sendMessage failed: 400 instance not connected/
    );
  });
});

test('getContact devolve o nome do perfil quando a Evolution API responde', async () => {
  await withMockFetch(async (url, opts) => {
    assert.equal(url, 'http://evolution.test/chat/fetchProfile/megachat-wa-1');
    assert.deepEqual(JSON.parse(opts.body), { number: '5511999999999' });
    return { ok: true, json: async () => ({ name: 'Cliente Fulano' }) };
  }, async () => {
    const contact = await whatsapp.getContact(account, '5511999999999');
    assert.deepEqual(contact, { name: 'Cliente Fulano', identifier: '5511999999999' });
  });
});

test('getContact cai para o número de telefone quando o perfil não é encontrado', async () => {
  await withMockFetch(async () => ({ ok: false, status: 404 }), async () => {
    const contact = await whatsapp.getContact(account, '5511999999999');
    assert.deepEqual(contact, { name: '5511999999999', identifier: '5511999999999' });
  });
});
