// Conector Shopee via Open Platform v2 (https://open.shopee.com)
// Auth: assinatura HMAC-SHA256 por requisição + access_token de 4h (refresh de
//   30 dias). Diferente do ML/IG, a Shopee assina cada chamada à mão:
//   sign = HMAC-SHA256(partner_key, partner_id + path + timestamp + access_token + shop_id).
// Chat (sellerchat v2): get_conversation_list, get_message, send_message.
//
// ⚠️ NÃO verificável sem app aprovado na Open Platform (partner_id/key + escopo
//    de chat). O contrato (assinatura, host, endpoints, params) foi confirmado
//    contra a doc/SDK oficial v2; os NOMES DOS CAMPOS de resposta do chat devem
//    ser reconferidos contra a doc viva quando as credenciais existirem.
//    Credenciais por conta (em ChannelAccount.credentials): { shop_id,
//    access_token, refresh_token } — obtidas no fluxo OAuth de shop da Shopee.

const crypto = require('crypto');
const { getCredentials } = require('../db/crypto');
const { saveCredentials } = require('../db/queries');

const HOST = 'https://partner.shopeemobile.com';

function appCreds() {
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!partnerId || !partnerKey) {
    throw new Error('SHOPEE_PARTNER_ID/SHOPEE_PARTNER_KEY ausentes — configure o app da Open Platform');
  }
  return { partnerId, partnerKey };
}

// Assinatura shop-level. Exportada para teste (é a parte mais fácil de errar).
function signRequest(path, timestamp, accessToken, shopId) {
  const { partnerId, partnerKey } = appCreds();
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(base).digest('hex');
}

function signedUrl(path, creds, extra = {}) {
  const { partnerId } = appCreds();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    access_token: creds.access_token,
    shop_id: String(creds.shop_id),
    sign: signRequest(path, timestamp, creds.access_token, creds.shop_id),
    ...extra,
  });
  return `${HOST}${path}?${params.toString()}`;
}

// Resposta da Shopee: { error, message, response }. error vazio = sucesso.
function isTokenError(body) {
  return !!body?.error && /token|auth/i.test(body.error);
}

function shopeeGet(path, creds, extra) {
  return fetch(signedUrl(path, creds, extra)).then((r) => r.json());
}

function shopeePost(path, creds, payload) {
  return fetch(signedUrl(path, creds), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

// Renova o access_token (expira em 4h). Endpoint público — assinatura curta
// (partner_id + path + timestamp). Persiste os tokens novos (refresh rotaciona).
async function refreshAccessToken(channelAccount, creds) {
  const { partnerId, partnerKey } = appCreds();
  const path = '/api/v2/auth/access_token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = crypto.createHmac('sha256', partnerKey).update(`${partnerId}${path}${timestamp}`).digest('hex');
  const url = `${HOST}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
  const body = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: creds.refresh_token, partner_id: Number(partnerId), shop_id: Number(creds.shop_id) }),
  }).then((r) => r.json());

  if (!body.access_token) throw new Error(`Shopee refresh de token falhou: ${body.error || body.message || 'sem access_token'}`);
  const updated = { ...creds, access_token: body.access_token, refresh_token: body.refresh_token || creds.refresh_token };
  if (channelAccount.id) saveCredentials(channelAccount.id, updated);
  return updated;
}

// Roda run(creds); se a Shopee responder erro de token, renova, persiste e refaz.
async function callWithRefresh(channelAccount, run) {
  const creds = getCredentials(channelAccount);
  const body = await run(creds);
  if (!isTokenError(body)) return body;
  const fresh = await refreshAccessToken(channelAccount, creds);
  return run(fresh);
}

async function init(channelAccount) {
  const body = await callWithRefresh(channelAccount, (creds) =>
    shopeeGet('/api/v2/sellerchat/get_conversation_list', creds, { page_size: '1' }));
  if (body.error) throw new Error(`Shopee init falhou: ${body.error} ${body.message || ''}`.trim());
  return body;
}

async function fetchNewMessages(channelAccount, lastMessageId) {
  const body = await callWithRefresh(channelAccount, (creds) =>
    shopeeGet('/api/v2/sellerchat/get_conversation_list', creds, { page_size: '25' }));

  const messages = [];
  for (const c of (body?.response?.conversations || [])) {
    const id = String(c.latest_message_id || '');
    if (!id || (lastMessageId && id <= lastMessageId)) continue;
    messages.push({
      id,
      // Usamos o id do comprador como chave da conversa: a resposta do lojista
      // (send_message) vai por `to_id`, então o mapeamento já guarda o que envia.
      conversationId: String(c.to_id || ''),
      contactId: String(c.to_id || ''),
      contactName: c.to_name || String(c.to_id || ''),
      text: c.latest_message_content?.text || '',
      createdAt: c.last_message_timestamp,
    });
  }
  return messages;
}

async function sendMessage(channelAccount, toId, text) {
  const body = await callWithRefresh(channelAccount, (creds) =>
    shopeePost('/api/v2/sellerchat/send_message', creds, {
      to_id: Number(toId),
      message_type: 'text',
      content: { text },
    }));
  if (body.error) throw new Error(`Shopee sendMessage falhou: ${body.error} ${body.message || ''}`.trim());
  return body;
}

async function getContact(channelAccount, userId) {
  // O chat não tem endpoint simples de perfil; o nome real já chega em
  // fetchNewMessages (to_name). Devolve neutro para não quebrar quem chamar.
  return { name: String(userId), identifier: String(userId) };
}

module.exports = { init, fetchNewMessages, sendMessage, getContact, signRequest };
