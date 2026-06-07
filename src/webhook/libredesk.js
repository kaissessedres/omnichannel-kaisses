// Recebe replies do lojista via webhook do Libredesk
// Libredesk chama POST /webhook/libredesk quando o agente envia uma mensagem

const crypto = require('crypto');
const express = require('express');
const { findMappingByLibredesk } = require('../db/queries');
const { ALL: CONNECTORS } = require('../connectors');

const router = express.Router();

// O secret é opcional na configuração do Libredesk (Admin → Integrations →
// Webhooks) — só quando preenchido lá (e espelhado aqui em WEBHOOK_SECRET) é
// que ele assina as chamadas com HMAC-SHA256 no header X-Libredesk-Signature
// no formato "sha256=<hex>" (ver docs.libredesk.io/configuration/webhooks).
// Sem secret configurado dos dois lados não tem assinatura pra checar — o
// melhor que dá pra fazer é avisar no log que o endpoint está sem proteção.
function isValidSignature(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers['x-libredesk-signature'];
  if (!signature) return false;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.alloc(0)).digest('hex')}`;
  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);
  // Tamanhos diferentes quebrariam timingSafeEqual com RangeError — e já
  // são prova suficiente de que a assinatura não bate.
  return received.length === computed.length && crypto.timingSafeEqual(received, computed);
}

router.post('/', async (req, res) => {
  if (!process.env.WEBHOOK_SECRET) {
    console.warn('[libredesk] WEBHOOK_SECRET não configurado — assinatura do webhook não está sendo validada');
  } else if (!isValidSignature(req)) {
    console.warn('[libredesk] Webhook rejeitado: assinatura ausente ou inválida');
    return res.sendStatus(401);
  }

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
