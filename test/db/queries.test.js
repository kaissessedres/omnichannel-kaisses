// Testa src/db/queries.js contra um SQLite real em memória (':memory:').
// Nada de mocks aqui — é a forma mais fiel de pegar erros de SQL/constraint
// sem precisar de um arquivo em disco.

process.env.DB_PATH = ':memory:';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // necessário p/ createAccount/saveCredentials cifrarem

const test = require('node:test');
const assert = require('node:assert/strict');

const { getDb, initDb } = require('../../src/db/schema');
const queries = require('../../src/db/queries');
const { getCredentials } = require('../../src/db/crypto');
const { seedAccount } = require('../helpers');

test.before(() => {
  initDb();
});

test.beforeEach(() => {
  // Cada teste começa com as três tabelas vazias — evita que dados de um
  // teste vazem para o próximo (a conexão ':memory:' é compartilhada).
  const db = getDb();
  db.exec('DELETE FROM ConversationMapping; DELETE FROM SyncState; DELETE FROM ChannelAccount;');
});

test('findMapping devolve undefined quando não existe', () => {
  const accountId = seedAccount(getDb());
  assert.equal(queries.findMapping(accountId, 'nao-existe'), undefined);
});

test('createMapping + findMapping fazem o roundtrip', () => {
  const accountId = seedAccount(getDb());

  queries.createMapping({
    libredeskConversationId: 42,
    channelAccountId: accountId,
    externalConversationId: '5511999999999',
    externalContactId: '5511999999999',
  });

  const found = queries.findMapping(accountId, '5511999999999');
  assert.equal(found.libredesk_conversation_id, 42);
  assert.equal(found.external_contact_id, '5511999999999');
});

test('createMapping respeita a constraint de unicidade (channel_account_id + external_conversation_id)', () => {
  const accountId = seedAccount(getDb());
  queries.createMapping({
    libredeskConversationId: 1,
    channelAccountId: accountId,
    externalConversationId: 'dup',
    externalContactId: 'dup',
  });

  assert.throws(() => {
    queries.createMapping({
      libredeskConversationId: 2,
      channelAccountId: accountId,
      externalConversationId: 'dup',
      externalContactId: 'dup',
    });
  }, /UNIQUE constraint failed/);
});

test('findMappingByLibredesk traz os dados da conta via JOIN', () => {
  const accountId = seedAccount(getDb(), {
    channel_type: 'mercadolivre',
    account_label: 'ML Conta 1',
    credentials: '{"seller_id":"123"}',
    libredesk_inbox_id: 2,
  });
  queries.createMapping({
    libredeskConversationId: 99,
    channelAccountId: accountId,
    externalConversationId: 'pack-1',
    externalContactId: 'user-1',
  });

  const mapping = queries.findMappingByLibredesk(99);
  assert.equal(mapping.channel_type, 'mercadolivre');
  assert.equal(mapping.libredesk_inbox_id, 2);
  assert.equal(mapping.credentials, '{"seller_id":"123"}');
  assert.equal(mapping.external_conversation_id, 'pack-1');
});

test('findMappingByLibredesk devolve undefined quando não há mapeamento', () => {
  assert.equal(queries.findMappingByLibredesk(123456), undefined);
});

test('getActiveAccounts filtra por canal e por status', () => {
  seedAccount(getDb(), { channel_type: 'whatsapp', account_label: 'WA ativa', status: 'active' });
  seedAccount(getDb(), { channel_type: 'whatsapp', account_label: 'WA com erro', status: 'error' });
  seedAccount(getDb(), { channel_type: 'instagram', account_label: 'IG ativa', status: 'active' });

  const whatsappActive = queries.getActiveAccounts('whatsapp');
  assert.equal(whatsappActive.length, 1);
  assert.equal(whatsappActive[0].account_label, 'WA ativa');

  const allActive = queries.getActiveAccounts();
  assert.equal(allActive.length, 2);
  assert.ok(allActive.every((a) => a.status === 'active'));
});

test('getSyncState devolve undefined antes do primeiro upsert', () => {
  const accountId = seedAccount(getDb());
  assert.equal(queries.getSyncState(accountId), undefined);
});

test('upsertSyncState insere e depois atualiza (ON CONFLICT)', () => {
  const accountId = seedAccount(getDb());

  queries.upsertSyncState(accountId, { lastMessageId: 'msg-1', errorCount: 0 });
  let state = queries.getSyncState(accountId);
  assert.equal(state.last_external_message_id, 'msg-1');
  assert.equal(state.error_count, 0);

  queries.upsertSyncState(accountId, { lastMessageId: 'msg-2', errorCount: 1, lastError: 'timeout' });
  state = queries.getSyncState(accountId);
  assert.equal(state.last_external_message_id, 'msg-2');
  assert.equal(state.error_count, 1);
  assert.equal(state.last_error, 'timeout');
});

test('upsertSyncState preserva o último ID quando lastMessageId não é informado (COALESCE)', () => {
  const accountId = seedAccount(getDb());

  queries.upsertSyncState(accountId, { lastMessageId: 'msg-1', errorCount: 0 });
  // Uma falha de polling não deve apagar o progresso já salvo
  queries.upsertSyncState(accountId, { errorCount: 1, lastError: 'falhou sem novidades' });

  const state = queries.getSyncState(accountId);
  assert.equal(state.last_external_message_id, 'msg-1');
  assert.equal(state.error_count, 1);
});

test('markAccountError marca status=error e fixa error_count em 5', () => {
  const accountId = seedAccount(getDb(), { status: 'active' });

  queries.markAccountError(accountId, 'falhou 5 vezes seguidas');

  const account = getDb().prepare('SELECT * FROM ChannelAccount WHERE id = ?').get(accountId);
  assert.equal(account.status, 'error');

  const state = queries.getSyncState(accountId);
  assert.equal(state.error_count, 5);
  assert.equal(state.last_error, 'falhou 5 vezes seguidas');
});

test('updateLastSynced grava o timestamp em ChannelAccount', () => {
  const accountId = seedAccount(getDb());
  assert.equal(getDb().prepare('SELECT last_synced_at FROM ChannelAccount WHERE id = ?').get(accountId).last_synced_at, null);

  queries.updateLastSynced(accountId);

  const account = getDb().prepare('SELECT last_synced_at FROM ChannelAccount WHERE id = ?').get(accountId);
  assert.ok(account.last_synced_at, 'last_synced_at deveria ter sido preenchido');
});

// ── Lado de escrita das credenciais (createAccount / saveCredentials) ──

test('createAccount cifra credentials no banco e getCredentials lê de volta', () => {
  const { lastInsertRowid } = queries.createAccount({
    channelType: 'mercadolivre',
    accountLabel: 'ML Conta 1',
    credentials: { access_token: 'tok', refresh_token: 'ref', seller_id: '7' },
    libredeskInboxId: 3,
  });

  const account = queries.getAccountById(lastInsertRowid);
  // no banco está cifrado — o token em texto plano NÃO aparece na coluna
  assert.doesNotMatch(account.credentials, /access_token|tok|ref/);
  // mas decifra de volta no objeto original
  assert.deepEqual(getCredentials(account), { access_token: 'tok', refresh_token: 'ref', seller_id: '7' });
});

test('createAccount grava credentials NULL para conta sem token (WhatsApp)', () => {
  const { lastInsertRowid } = queries.createAccount({
    channelType: 'whatsapp',
    accountLabel: 'WhatsApp Loja',
    evolutionInstanceId: 'kaichat-wa-1',
    libredeskInboxId: 1,
  });

  const account = queries.getAccountById(lastInsertRowid);
  assert.equal(account.credentials, null);
  assert.deepEqual(getCredentials(account), {});
});

test('saveCredentials atualiza (cifrado) os tokens de uma conta — caminho do refresh rotacionado', () => {
  const { lastInsertRowid } = queries.createAccount({
    channelType: 'mercadolivre',
    accountLabel: 'ML Conta 1',
    credentials: { access_token: 'OLD', refresh_token: 'OLD_REF', seller_id: '7' },
    libredeskInboxId: 3,
  });

  queries.saveCredentials(lastInsertRowid, { access_token: 'NEW', refresh_token: 'NEW_REF', seller_id: '7' });

  const account = queries.getAccountById(lastInsertRowid);
  assert.deepEqual(getCredentials(account), { access_token: 'NEW', refresh_token: 'NEW_REF', seller_id: '7' });
});
