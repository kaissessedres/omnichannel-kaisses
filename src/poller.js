// Orquestra o polling de Instagram e Mercado Livre a cada 30 segundos
// WhatsApp não entra aqui — usa webhook do Evolution API

const cron = require('node-cron');
const { getActiveAccounts, getSyncState, upsertSyncState, findMapping, createMapping, updateLastSynced, markAccountError } = require('./db/queries');
const libredesk = require('./libredesk/client');
const { POLLED } = require('./connectors');

async function pollAccount(account) {
  const connector = POLLED[account.channel_type];
  if (!connector) return;

  const state = getSyncState(account.id) || {};

  try {
    const messages = await connector.fetchNewMessages(account, state.last_external_message_id);
    if (messages.length === 0) return;

    let lastId = state.last_external_message_id;
    for (const msg of messages) {
      let mapping = findMapping(account.id, msg.conversationId);

      if (!mapping) {
        const conv = await libredesk.createConversation({
          inboxId: account.libredesk_inbox_id,
          contactName: msg.contactName,
          contactIdentifier: msg.contactId,
          channelLabel: account.account_label,
          initialMessage: msg.text,
        });
        createMapping({
          libredeskConversationId: conv.id,
          channelAccountId: account.id,
          externalConversationId: msg.conversationId,
          externalContactId: msg.contactId,
        });
        console.log(`[poller] Nova conversa ${account.channel_type} criada: ${conv.id}`);
      } else {
        await libredesk.sendMessage(mapping.libredesk_conversation_id, msg.text);
      }

      lastId = msg.id;
    }

    upsertSyncState(account.id, { lastMessageId: lastId, errorCount: 0 });
    updateLastSynced(account.id);
  } catch (err) {
    console.error(`[poller] Erro em ${account.account_label}: ${err.message}`);
    const currentState = getSyncState(account.id) || { error_count: 0 };
    const newCount = (currentState.error_count || 0) + 1;

    if (newCount >= 5) {
      markAccountError(account.id, err.message);
      console.error(`[poller] Conta "${account.account_label}" marcada como erro após 5 falhas`);
    } else {
      upsertSyncState(account.id, { errorCount: newCount, lastError: err.message });
    }
  }
}

function startPolling() {
  // Os canais a pollar saem das chaves de POLLED — uma fonte só, pra não
  // divergir do registro central quando um conector novo entra (ex: Shopee).
  const channels = Object.keys(POLLED);

  // Executa a cada 30 segundos
  cron.schedule('*/30 * * * * *', async () => {
    const accounts = channels.flatMap((type) => getActiveAccounts(type));
    await Promise.allSettled(accounts.map(pollAccount));
  });

  console.log(`[poller] Polling iniciado — ${channels.join(', ')} a cada 30s`);
}

module.exports = { startPolling };
