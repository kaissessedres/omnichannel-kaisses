// Conector Mercado Livre via SDK oficial
// npm: mercadolibre (github.com/mercadolibre/nodejs-sdk)
// Auth: OAuth 2.0 — access token expira em 6h, refresh automático pelo SDK
// Polling: GET /messages/unread a cada 30s

const Meli = require('mercadolibre');

function getClient(channelAccount) {
  const creds = JSON.parse(channelAccount.credentials || '{}');
  return new Meli.Meli(
    process.env.ML_APP_ID,
    process.env.ML_APP_SECRET,
    creds.access_token,
    creds.refresh_token
  );
}

function meliGet(client, path, params = {}) {
  return new Promise((resolve, reject) => {
    client.get(path, params, (err, res) => {
      if (err) return reject(new Error(`ML GET ${path} failed: ${err}`));
      resolve(typeof res === 'string' ? JSON.parse(res) : res);
    });
  });
}

function meliPost(client, path, body) {
  return new Promise((resolve, reject) => {
    client.post(path, {}, body, (err, res) => {
      if (err) return reject(new Error(`ML POST ${path} failed: ${err}`));
      resolve(typeof res === 'string' ? JSON.parse(res) : res);
    });
  });
}

async function init(channelAccount) {
  const client = getClient(channelAccount);
  await meliGet(client, '/users/me');
}

async function fetchNewMessages(channelAccount, lastMessageId) {
  const client = getClient(channelAccount);
  const data = await meliGet(client, '/messages/unread');

  const messages = [];
  for (const pack of (data.results || [])) {
    if (lastMessageId && pack.id <= lastMessageId) continue;
    messages.push({
      id: pack.id,
      conversationId: String(pack.pack_id || pack.id),
      contactId: String(pack.from?.user_id || ''),
      contactName: String(pack.from?.user_id || ''),
      text: pack.text?.plain || '',
      createdAt: pack.date_created,
    });
  }
  return messages;
}

async function sendMessage(channelAccount, conversationId, text) {
  const client = getClient(channelAccount);
  const creds = JSON.parse(channelAccount.credentials || '{}');
  return meliPost(client, `/messages/packs/${conversationId}/sellers/${creds.seller_id}`, {
    text: { plain: text },
  });
}

async function getContact(channelAccount, userId) {
  const client = getClient(channelAccount);
  const data = await meliGet(client, `/users/${userId}`).catch(() => null);
  if (!data) return { name: userId, identifier: userId };
  return { name: data.nickname || userId, identifier: userId };
}

module.exports = { init, fetchNewMessages, sendMessage, getContact };
