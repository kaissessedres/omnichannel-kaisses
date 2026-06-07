const { getDb } = require('./schema');
const { setCredentials } = require('./crypto');

// Insere uma conta de canal. `credentials` é um objeto em texto plano (ex:
// { access_token, refresh_token, seller_id }) — é cifrado aqui antes de gravar
// (ver setCredentials). Para WhatsApp, deixe credentials vazio: a sessão fica
// no Evolution API, não no banco.
function createAccount({ channelType, accountLabel, credentials = {}, evolutionInstanceId = null, libredeskInboxId, status = 'active' }) {
  return getDb()
    .prepare(`
      INSERT INTO ChannelAccount
        (channel_type, account_label, credentials, evolution_instance_id, libredesk_inbox_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(channelType, accountLabel, setCredentials(credentials), evolutionInstanceId, libredeskInboxId, status);
}

function getAccountById(id) {
  return getDb().prepare('SELECT * FROM ChannelAccount WHERE id = ?').get(id);
}

// Atualiza (cifrado) as credenciais de uma conta existente. Usado quando o
// token OAuth é rotacionado — ex: o conector ML troca o access_token expirado e
// recebe um refresh_token novo (single-use) que PRECISA ser persistido, senão o
// próximo refresh falha. `credentials` é o objeto completo em texto plano.
function saveCredentials(channelAccountId, credentials) {
  getDb()
    .prepare('UPDATE ChannelAccount SET credentials = ? WHERE id = ?')
    .run(setCredentials(credentials), channelAccountId);
}

function findMapping(channelAccountId, externalConversationId) {
  return getDb()
    .prepare('SELECT * FROM ConversationMapping WHERE channel_account_id = ? AND external_conversation_id = ?')
    .get(channelAccountId, externalConversationId);
}

function createMapping({ libredeskConversationId, channelAccountId, externalConversationId, externalContactId }) {
  return getDb()
    .prepare(`
      INSERT INTO ConversationMapping
        (libredesk_conversation_id, channel_account_id, external_conversation_id, external_contact_id)
      VALUES (?, ?, ?, ?)
    `)
    .run(libredeskConversationId, channelAccountId, externalConversationId, externalContactId);
}

function findMappingByLibredesk(libredeskConversationId) {
  return getDb()
    .prepare(`
      SELECT cm.*, ca.channel_type, ca.evolution_instance_id, ca.credentials, ca.libredesk_inbox_id
      FROM ConversationMapping cm
      JOIN ChannelAccount ca ON ca.id = cm.channel_account_id
      WHERE cm.libredesk_conversation_id = ?
    `)
    .get(libredeskConversationId);
}

function getActiveAccounts(channelType) {
  if (channelType) {
    return getDb()
      .prepare("SELECT * FROM ChannelAccount WHERE channel_type = ? AND status = 'active'")
      .all(channelType);
  }
  return getDb()
    .prepare("SELECT * FROM ChannelAccount WHERE status = 'active'")
    .all();
}

function getSyncState(channelAccountId) {
  return getDb()
    .prepare('SELECT * FROM SyncState WHERE channel_account_id = ?')
    .get(channelAccountId);
}

function upsertSyncState(channelAccountId, { lastMessageId, errorCount, lastError } = {}) {
  getDb()
    .prepare(`
      INSERT INTO SyncState (channel_account_id, last_external_message_id, last_polled_at, error_count, last_error)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
      ON CONFLICT(channel_account_id) DO UPDATE SET
        last_external_message_id = COALESCE(excluded.last_external_message_id, last_external_message_id),
        last_polled_at           = CURRENT_TIMESTAMP,
        error_count              = excluded.error_count,
        last_error               = excluded.last_error
    `)
    .run(channelAccountId, lastMessageId ?? null, errorCount ?? 0, lastError ?? null);
}

function markAccountError(channelAccountId, errorMessage) {
  getDb()
    .prepare("UPDATE ChannelAccount SET status = 'error' WHERE id = ?")
    .run(channelAccountId);
  upsertSyncState(channelAccountId, { errorCount: 5, lastError: errorMessage });
}

function updateLastSynced(channelAccountId) {
  getDb()
    .prepare('UPDATE ChannelAccount SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(channelAccountId);
}

module.exports = {
  createAccount,
  getAccountById,
  saveCredentials,
  findMapping,
  createMapping,
  findMappingByLibredesk,
  getActiveAccounts,
  getSyncState,
  upsertSyncState,
  markAccountError,
  updateLastSynced,
};
