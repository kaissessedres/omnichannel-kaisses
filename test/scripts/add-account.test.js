// Testa o "cérebro" do CLI de onboarding (scripts/add-account.js):
// resolveAccountArgs valida os argumentos e decide o status. Função pura — não
// toca no banco. Um teste extra fecha o ciclo: o payload resolvido vira uma
// conta de verdade (createAccount) com as credenciais cifradas e legíveis.

process.env.DB_PATH = ':memory:';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveAccountArgs } = require('../../scripts/add-account');
const { initDb } = require('../../src/db/schema');
const queries = require('../../src/db/queries');
const { getCredentials } = require('../../src/db/crypto');

test('ML sem token → status disconnected e precisa de OAuth, credenciais vazias', () => {
  const { input, needsOAuth } = resolveAccountArgs({ type: 'mercadolivre', label: 'ML 1', inbox: '3' });
  assert.equal(input.status, 'disconnected');
  assert.equal(needsOAuth, true);
  assert.deepEqual(input.credentials, {});
  assert.equal(input.libredeskInboxId, 3);
});

test('ML com tokens semeados → status active, sem OAuth, credenciais preenchidas', () => {
  const { input, needsOAuth } = resolveAccountArgs({
    type: 'mercadolivre', label: 'ML 1', inbox: '3',
    'access-token': 'AT', 'refresh-token': 'RT', 'seller-id': '777',
  });
  assert.equal(input.status, 'active');
  assert.equal(needsOAuth, false);
  assert.deepEqual(input.credentials, { access_token: 'AT', refresh_token: 'RT', seller_id: '777' });
});

test('WhatsApp → status active com a instância do Evolution, sem credenciais', () => {
  const { input, needsOAuth } = resolveAccountArgs({
    type: 'whatsapp', label: 'WhatsApp', inbox: '7', instance: 'megachat-wa-1',
  });
  assert.equal(input.status, 'active');
  assert.equal(needsOAuth, false);
  assert.equal(input.evolutionInstanceId, 'megachat-wa-1');
  assert.deepEqual(input.credentials, {});
});

test('Instagram sem token → disconnected/OAuth (mesma regra do ML)', () => {
  const { input, needsOAuth } = resolveAccountArgs({ type: 'instagram', label: 'IG', inbox: '5' });
  assert.equal(input.status, 'disconnected');
  assert.equal(needsOAuth, true);
});

test('Shopee com shop-id + tokens monta as credenciais (shop_id/access/refresh)', () => {
  const { input } = resolveAccountArgs({
    type: 'shopee', label: 'Shopee 1', inbox: '8',
    'shop-id': '123', 'access-token': 'AT', 'refresh-token': 'RT',
  });
  assert.deepEqual(input.credentials, { access_token: 'AT', refresh_token: 'RT', shop_id: '123' });
});

test('rejeita type inválido, argumentos faltando e inbox não numérico', () => {
  assert.throws(() => resolveAccountArgs({ type: 'telegram', label: 'x', inbox: '1' }), /type inválido/);
  assert.throws(() => resolveAccountArgs({ type: 'whatsapp', inbox: '1' }), /obrigatórios/);
  assert.throws(() => resolveAccountArgs({ type: 'whatsapp', label: 'x', inbox: 'abc' }), /inteiro positivo/);
});

test('o payload resolvido cria uma conta real com credenciais cifradas e legíveis', () => {
  initDb();
  const { input } = resolveAccountArgs({
    type: 'mercadolivre', label: 'ML seed', inbox: '3',
    'access-token': 'AT', 'refresh-token': 'RT', 'seller-id': '9',
  });
  const { lastInsertRowid: id } = queries.createAccount(input);

  const account = queries.getAccountById(id);
  assert.equal(account.status, 'active');
  assert.doesNotMatch(account.credentials, /AT|RT/); // cifrado no banco
  assert.deepEqual(getCredentials(account), { access_token: 'AT', refresh_token: 'RT', seller_id: '9' });
});
