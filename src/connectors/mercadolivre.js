// Conector Mercado Livre via SDK oficial
// npm: mercadolibre (github.com/mercadolibre/nodejs-sdk)
// Auth: OAuth 2.0 — access token expira em 6h. ATENÇÃO: o SDK NÃO faz refresh
//   sozinho (só quando chamamos refreshAccessToken explicitamente); e o ML
//   rotaciona o refresh_token a cada uso (single-use). Por isso o conector
//   detecta o token expirado, renova e PERSISTE os tokens novos — ver
//   callWithRefresh abaixo.
// Polling: GET /messages/unread a cada 30s

const Meli = require('mercadolibre');
const { getCredentials } = require('../db/crypto');
const { saveCredentials } = require('../db/queries');

function getClient(creds) {
  return new Meli.Meli(
    process.env.ML_APP_ID,
    process.env.ML_APP_SECRET,
    creds.access_token,
    creds.refresh_token
  );
}

// Um 401 do ML não chega como erro do needle — vem no corpo da resposta
// ({ message: 'invalid_token', status: 401 }). É assim que detectamos expiração.
function isTokenExpired(body) {
  return !!body && (body.status === 401 || body.message === 'invalid_token');
}

// Promisifica refreshAccessToken. Em sucesso, o SDK já atualiza o token interno
// do client; devolvemos o corpo ({ access_token, refresh_token, ... }).
function refreshAccessToken(client) {
  return new Promise((resolve, reject) => {
    client.refreshAccessToken((err, body) => {
      if (err || !body || !body.access_token) {
        return reject(new Error(`ML refresh de token falhou: ${err || body?.message || 'sem access_token'}`));
      }
      resolve(body);
    });
  });
}

// Executa run(client, creds) com o token atual. Se o ML responder "token
// expirado", renova, PERSISTE os tokens rotacionados (o refresh_token é
// single-use — não persistir quebra a próxima renovação) e tenta uma vez mais.
async function callWithRefresh(channelAccount, run) {
  const creds = getCredentials(channelAccount);
  const client = getClient(creds);

  const result = await run(client, creds);
  if (!isTokenExpired(result)) return result;

  const fresh = await refreshAccessToken(client);
  const rotated = { ...creds, access_token: fresh.access_token, refresh_token: fresh.refresh_token };
  if (channelAccount.id) saveCredentials(channelAccount.id, rotated);

  return run(client, rotated); // client já está com o token novo no _parameters
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
    // Assinatura do SDK é (path, body, params, callback) — body vai pro
    // corpo da requisição, params vira query string (?access_token=...).
    // Trocar a ordem faz o texto da mensagem virar "[object Object]" na
    // query string e o corpo sair vazio (bug pego pelos testes do conector).
    client.post(path, body, {}, (err, res) => {
      if (err) return reject(new Error(`ML POST ${path} failed: ${err}`));
      resolve(typeof res === 'string' ? JSON.parse(res) : res);
    });
  });
}

async function init(channelAccount) {
  await callWithRefresh(channelAccount, (client) => meliGet(client, '/users/me'));
}

async function fetchNewMessages(channelAccount, lastMessageId) {
  const data = await callWithRefresh(channelAccount, (client) => meliGet(client, '/messages/unread'));

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
  return callWithRefresh(channelAccount, (client, creds) =>
    meliPost(client, `/messages/packs/${conversationId}/sellers/${creds.seller_id}`, {
      text: { plain: text },
    })
  );
}

async function getContact(channelAccount, userId) {
  const client = getClient(getCredentials(channelAccount));
  const data = await meliGet(client, `/users/${userId}`).catch(() => null);
  if (!data || isTokenExpired(data)) return { name: userId, identifier: userId };
  return { name: data.nickname || userId, identifier: userId };
}

module.exports = { init, fetchNewMessages, sendMessage, getContact };
