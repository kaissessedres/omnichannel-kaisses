// Conector Instagram via Meta Graph API
// Auth: OAuth 2.0 — token de longa duração (60 dias, renovação manual)
// Polling: GET /me/conversations a cada 30s

const { getCredentials } = require('../db/crypto');

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

function getToken(channelAccount) {
  const creds = getCredentials(channelAccount);
  return creds.access_token || process.env.INSTAGRAM_ACCESS_TOKEN;
}

async function init(channelAccount) {
  const token = getToken(channelAccount);
  const res = await fetch(`${GRAPH_URL}/me?access_token=${token}`);
  if (!res.ok) throw new Error(`Instagram init failed: ${res.status}`);
  return res.json();
}

async function fetchNewMessages(channelAccount, lastMessageId) {
  const token = getToken(channelAccount);
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

module.exports = { init, fetchNewMessages, sendMessage, getContact };
