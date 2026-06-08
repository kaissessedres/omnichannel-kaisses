// Conector Instagram via Meta Graph API
// Auth: OAuth 2.0 — token de longa duração (~60 dias). Diferente do ML, NÃO há
//   um refresh_token separado: é o próprio token válido que se troca por outro
//   (grant fb_exchange_token). Por isso renovamos ANTES de expirar (proativo,
//   em ensureFreshToken) — depois de expirar, só re-autenticando do zero.
// Polling: GET /me/conversations a cada 30s

const { getCredentials } = require('../db/crypto');
const { saveCredentials } = require('../db/queries');

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

// Renova quando faltam menos que isto pra expirar (folga de 7 dias).
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function getToken(channelAccount) {
  const creds = getCredentials(channelAccount);
  return creds.access_token || process.env.INSTAGRAM_ACCESS_TOKEN;
}

function metaCreds() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_APP_ID/META_APP_SECRET ausentes — configure o app da Meta');
  return { appId, appSecret };
}

// Troca um token (curto ou longo) por um de longa duração (~60d) via grant
// fb_exchange_token. Devolve { access_token, expires_at } — não persiste.
async function fbExchangeToken(token) {
  const { appId, appSecret } = metaCreds();
  const url = `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token`
    + `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instagram exchange de token falhou: ${res.status} ${await res.text()}`);
  const data = await res.json(); // { access_token, token_type, expires_in }
  return {
    access_token: data.access_token,
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

// Renova o token de longa duração (troca o atual por outro de ~60d) e persiste
// o novo + expires_at cifrados. Devolve as creds atualizadas.
async function refreshLongLivedToken(channelAccount) {
  const creds = getCredentials(channelAccount);
  const updated = { ...creds, ...(await fbExchangeToken(creds.access_token)) };
  if (channelAccount.id) saveCredentials(channelAccount.id, updated);
  return updated;
}

// URL pra onde o lojista é mandado pra autorizar a conta (1ª etapa do OAuth).
// O `state` volta no callback e identifica qual ChannelAccount está conectando.
function getAuthUrl(redirectUri, state) {
  const { appId } = metaCreds();
  const scope = 'pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages';
  return 'https://www.facebook.com/v19.0/dialog/oauth'
    + `?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&state=${encodeURIComponent(state)}&response_type=code&scope=${encodeURIComponent(scope)}`;
}

// Troca o `code` do redirect pelo token: primeiro o de curta duração, depois o
// de longa (~60d). Devolve { access_token, expires_at } em texto plano — quem
// chama persiste cifrado via saveCredentials.
async function exchangeCode(code, redirectUri) {
  const { appId, appSecret } = metaCreds();
  const url = `${GRAPH_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instagram authorize falhou: ${res.status} ${await res.text()}`);
  const short = await res.json(); // { access_token, expires_in }
  return fbExchangeToken(short.access_token); // curto → longo
}

// Renova proativamente e devolve o token a usar agora. Pula quando não dá pra
// persistir (sem id), faltam app creds, ou o token ainda está longe de expirar.
// Não-fatal: se a renovação falhar, loga e segue com o token atual.
async function ensureFreshToken(channelAccount) {
  const currentToken = getToken(channelAccount);
  if (!channelAccount.id || !process.env.META_APP_ID || !process.env.META_APP_SECRET) return currentToken;

  const creds = getCredentials(channelAccount);
  if (!creds.access_token) return currentToken;

  const needsRefresh = !creds.expires_at || (creds.expires_at - Date.now()) < REFRESH_THRESHOLD_MS;
  if (!needsRefresh) return currentToken;

  try {
    const updated = await refreshLongLivedToken(channelAccount);
    return updated.access_token;
  } catch (err) {
    console.warn(`[instagram] Falha ao renovar token (segue com o atual): ${err.message}`);
    return currentToken;
  }
}

async function init(channelAccount) {
  const token = getToken(channelAccount);
  const res = await fetch(`${GRAPH_URL}/me?access_token=${token}`);
  if (!res.ok) throw new Error(`Instagram init failed: ${res.status}`);
  return res.json();
}

async function fetchNewMessages(channelAccount, lastMessageId) {
  // Aproveita o polling pra manter o token de longa duração vivo (renova se
  // estiver perto de expirar) — devolve o token efetivo a usar agora.
  const token = await ensureFreshToken(channelAccount);
  const res = await fetch(
    `${GRAPH_URL}/me/conversations?fields=id,messages{id,message,from,created_time}&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Instagram fetchMessages failed: ${res.status}`);
  const data = await res.json();

  const messages = [];
  for (const conv of (data.data || [])) {
    for (const msg of (conv.messages?.data || [])) {
      if (lastMessageId && msg.id <= lastMessageId) continue;
      messages.push({
        id: msg.id,
        conversationId: conv.id,
        contactId: msg.from?.id,
        contactName: msg.from?.name || msg.from?.id,
        text: msg.message,
        createdAt: msg.created_time,
      });
    }
  }
  return messages;
}

async function sendMessage(channelAccount, conversationId, text) {
  const token = getToken(channelAccount);
  const res = await fetch(`${GRAPH_URL}/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, access_token: token }),
  });
  if (!res.ok) throw new Error(`Instagram sendMessage failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getContact(channelAccount, contactId) {
  const token = getToken(channelAccount);
  const res = await fetch(`${GRAPH_URL}/${contactId}?fields=name&access_token=${token}`);
  if (!res.ok) return { name: contactId, identifier: contactId };
  const data = await res.json();
  return { name: data.name || contactId, identifier: contactId };
}

module.exports = { init, fetchNewMessages, sendMessage, getContact, refreshLongLivedToken, getAuthUrl, exchangeCode };
