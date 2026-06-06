// Recebe mensagens do Evolution API (WhatsApp)
// Evolution API chama POST /webhook/evolution para cada evento

const express = require('express');
const { findMapping, createMapping, updateLastSynced, getActiveAccounts } = require('../db/queries');
const libredesk = require('../libredesk/client');

const router = express.Router();

router.post('/', async (req, res) => {
  // Responde imediatamente — Evolution API retenta se demorar
  res.sendStatus(200);

  try {
    const event = req.body;
    if (event.event !== 'messages.upsert') return;

    const msg = event.data;
    if (!msg || msg.key?.fromMe) return; // ignora mensagens enviadas pelo lojista

    const instanceId = event.instance;
    const accounts = getActiveAccounts('whatsapp');
    const account = accounts.find(a => a.evolution_instance_id === instanceId);

    if (!account) {
      console.warn(`[evolution] Instância desconhecida: ${instanceId}`);
      return;
    }

    const phoneNumber = msg.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const text = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || '[mídia não suportada]';

    const externalConversationId = phoneNumber;
    const externalContactId = phoneNumber;

    let mapping = findMapping(account.id, externalConversationId);

    if (!mapping) {
      const conv = await libredesk.createConversation({
        inboxId: account.libredesk_inbox_id,
        contactName: phoneNumber,
        contactIdentifier: phoneNumber,
        channelLabel: 'WhatsApp',
        initialMessage: text,
      });
      createMapping({
        libredeskConversationId: conv.id,
        channelAccountId: account.id,
        externalConversationId,
        externalContactId,
      });
      console.log(`[evolution] Nova conversa WA criada no Libredesk: ${conv.id}`);
    } else {
      await libredesk.sendMessage(mapping.libredesk_conversation_id, text);
    }

    updateLastSynced(account.id);
  } catch (err) {
    console.error('[evolution] Erro no webhook:', err.message);
  }
});

module.exports = router;
