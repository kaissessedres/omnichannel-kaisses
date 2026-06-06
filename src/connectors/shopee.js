// Conector Shopee — P2 (Fase 10)
// Requer aprovação na Shopee Open Platform: https://open.shopee.com
// Não implementar até as fases anteriores estarem funcionando em produção.

async function init() {
  throw new Error('Shopee connector not implemented (P2 — Fase 10)');
}

async function fetchNewMessages() {
  return [];
}

async function sendMessage() {
  throw new Error('Shopee connector not implemented (P2 — Fase 10)');
}

async function getContact() {
  return { name: 'unknown', identifier: 'unknown' };
}

module.exports = { init, fetchNewMessages, sendMessage, getContact };
