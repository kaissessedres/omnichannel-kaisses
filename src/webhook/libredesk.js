// Recebe replies do lojista via webhook do Libredesk
// Libredesk chama POST /webhook/libredesk quando o agente envia uma mensagem

const express = require('express');
const { findMappingByLibredesk } = require('../db/queries');
const whatsapp    = require('../connectors/whatsapp');
const instagram   = require('../connectors/instagram');
const mercadolivre = require('../connectors/mercadolivre');
const shopee      = require('../connectors/shopee');

const router = express.Router();

const CONNECTORS = { whatsapp, instagram, mercadolivre, shopee };

router.post('/', async (req, res) => {
  res.sendStatus(200);

  try {
    const { conversation_id, content, message_type } = req.body;

    // Só roteia mensagens enviadas pelo agente (lojista)
    if (message_type !== 'outgoing') return;
    if (!content || !conversation_id) return;

    const mapping = findMappingByLibredesk(conversation_id);
    if (!mapping) {
      console.warn(`[libredesk] Mapeamento não encontrado para conversa: ${conversation_id}`);
      return;
    }

    const connector = CONNECTORS[mapping.channel_type];
    if (!connector) {
      console.error(`[libredesk] Tipo de canal desconhecido: ${mapping.channel_type}`);
      return;
    }

    await connector.sendMessage(mapping, mapping.external_conversation_id, content);
    console.log(`[libredesk] Resposta roteada via ${mapping.channel_type} para ${mapping.external_conversation_id}`);
  } catch (err) {
    console.error('[libredesk] Erro no webhook:', err.message);
  }
});

module.exports = router;
