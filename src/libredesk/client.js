// Wrapper da API REST do Libredesk
// ⚠️  Os endpoints abaixo seguem o padrão da documentação do Libredesk.
//     Validar contra o Swagger da instância no Oracle Cloud antes da Fase 3.

const BASE       = () => process.env.LIBREDESK_URL;
const KEY        = () => process.env.LIBREDESK_API_KEY;
const ACCOUNT_ID = () => process.env.LIBREDESK_ACCOUNT_ID || '1';

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${KEY()}`,
  };
}

async function request(method, path, body) {
  const url = `${BASE()}/api/v1/accounts/${ACCOUNT_ID()}${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Libredesk ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function createConversation({ inboxId, contactName, contactIdentifier, channelLabel, initialMessage }) {
  return request('POST', '/conversations', {
    inbox_id: inboxId,
    contact: {
      name: contactName,
      identifier: contactIdentifier,
    },
    message: {
      content: initialMessage,
    },
    additional_attributes: {
      channel_label: channelLabel,
    },
  });
}

async function sendMessage(conversationId, content) {
  return request('POST', `/conversations/${conversationId}/messages`, {
    content,
    message_type: 'incoming',
  });
}

async function getConversation(conversationId) {
  return request('GET', `/conversations/${conversationId}`);
}

module.exports = { createConversation, sendMessage, getConversation };
