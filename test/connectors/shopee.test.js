// Shopee é P2 (Fase 10) — o conector é só um placeholder. Este teste fixa o
// contrato esperado: init/sendMessage avisam claramente que não está pronto,
// enquanto fetchNewMessages/getContact devolvem valores neutros e seguros
// (o poller e o webhook do Libredesk dependem desse comportamento até a
// implementação real chegar — ver ALL/POLLED em src/connectors/index.js).

const test = require('node:test');
const assert = require('node:assert/strict');

const shopee = require('../../src/connectors/shopee');

test('init rejeita explicando que ainda não foi implementado', async () => {
  await assert.rejects(() => shopee.init(), /Shopee connector not implemented \(P2 — Fase 10\)/);
});

test('sendMessage rejeita explicando que ainda não foi implementado', async () => {
  await assert.rejects(() => shopee.sendMessage(), /Shopee connector not implemented \(P2 — Fase 10\)/);
});

test('fetchNewMessages devolve lista vazia (poller não encontra nada pra sincronizar)', async () => {
  assert.deepEqual(await shopee.fetchNewMessages(), []);
});

test('getContact devolve um contato neutro em vez de quebrar quem chamar', async () => {
  assert.deepEqual(await shopee.getContact(), { name: 'unknown', identifier: 'unknown' });
});
