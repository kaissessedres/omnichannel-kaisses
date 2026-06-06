// Conector WhatsApp via Evolution API
// Recepção: webhook (src/webhook/evolution.js) — sem polling
// Envio: POST /message/sendText/{instance}

const EVOLUTION_URL = () => process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = () => process.env.EVOLUTION_API_KEY;

function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_KEY(),
  };
}

async function init(channelAccount) {
  const res = await fetch(`${EVOLUTION_URL()}/instance/fetchInstances`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Evolution API unreachable: ${res.status}`);
  const instances = await res.json();
  const found = instances.find(i => i.instance?.instanceName === channelAccount.evolution_instance_id);
  if (!found) throw new Error(`Instance "${channelAccount.evolution_instance_id}" not found in Evolution API`);
}

// WhatsApp não usa polling — mensagens chegam via webhook do Evolution API
async function fetchNewMessages() {
  return [];
}

async function sendMessage(channelAccount, phoneNumber, text) {
  const instance = channelAccount.evolution_instance_id;
  const res = await fetch(`${EVOLUTION_URL()}/message/sendText/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: phoneNumber, text }),
  });
  if (!res.ok) throw new Error(`Evolution sendMessage failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getContact(channelAccount, phoneNumber) {
  const instance = channelAccount.evolution_instance_id;
  const res = await fetch(`${EVOLUTION_URL()}/chat/fetchProfile/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: phoneNumber }),
  });
  if (!res.ok) return { name: phoneNumber, identifier: phoneNumber };
  const data = await res.json();
  return { name: data.name || phoneNumber, identifier: phoneNumber };
}

module.exports = { init, fetchNewMessages, sendMessage, getContact };
