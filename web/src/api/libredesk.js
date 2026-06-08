// Cliente da API REST do Libredesk — única camada que fala com o backend.
// O PWA não tem servidor próprio: lê e responde conversas direto no Libredesk
// (o bridge alimenta o Libredesk; este app só apresenta/responde).
//
// ⚠️ ENDPOINTS A VALIDAR: os caminhos seguem o padrão Chatwoot (ver
//    docs/CLAUDE-pwa.md) e PRECISAM ser conferidos contra a API real do
//    Libredesk antes de produção — https://libredesk.io/docs ou o Swagger da
//    instância. Estão centralizados aqui de propósito: quando a API real for
//    confirmada, o ajuste é só neste arquivo.

const STORAGE_KEY = 'megachat.auth';

// Autenticação fica no localStorage (ver "Autenticação" em docs/CLAUDE-pwa.md):
// a tela de login guarda URL + API key + accountId do Libredesk. Não há backend
// de auth próprio — a API key é a do próprio Libredesk.
export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveAuth({ url, apiKey, accountId }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, apiKey, accountId }));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function request(path, { method = 'GET', body } = {}) {
  const auth = getAuth();
  if (!auth) throw new Error('Não autenticado — configure URL e API key do Libredesk');
  const base = auth.url.replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Libredesk ${method} ${path} → ${res.status}`);
    return res.status === 204 ? null : res.json();
  });
}

function accountPath(suffix = '') {
  const auth = getAuth();
  // Mesma checagem do request(): sem isto, getAuth() nulo estouraria com um
  // "Cannot destructure ... of null" críptico antes de chegar lá.
  if (!auth) throw new Error('Não autenticado — configure URL e API key do Libredesk');
  return `/api/v1/accounts/${auth.accountId}${suffix}`;
}

// Conversas abertas (tela principal)
export function listConversations(status = 'open') {
  return request(`${accountPath('/conversations')}?status=${encodeURIComponent(status)}`);
}

// Mensagens de uma conversa (thread)
export function listMessages(conversationId) {
  return request(accountPath(`/conversations/${conversationId}/messages`));
}

// Enviar resposta do lojista
export function sendReply(conversationId, content) {
  return request(accountPath(`/conversations/${conversationId}/messages`), {
    method: 'POST',
    body: { content },
  });
}

// Marcar conversa como resolvida
export function resolveConversation(conversationId) {
  return request(accountPath(`/conversations/${conversationId}`), {
    method: 'PATCH',
    body: { status: 'resolved' },
  });
}
