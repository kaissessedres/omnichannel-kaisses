// Cliente da API REST do Libredesk — única camada que fala com o backend.
// O PWA não tem servidor próprio: lê e responde conversas direto no Libredesk
// (o bridge alimenta o Libredesk; este app só apresenta/responde).
//
// ⚠️ ENDPOINTS A VALIDAR: os caminhos seguem o padrão Chatwoot (ver
//    docs/CLAUDE-pwa.md) e PRECISAM ser conferidos contra a API real do
//    Libredesk antes de produção — https://libredesk.io/docs ou o Swagger da
//    instância. Estão centralizados aqui de propósito: quando a API real for
//    confirmada, o ajuste é só neste arquivo.

import { isDemo, disableDemo, demoConversations, demoMessages, demoSend, demoMarkRead, demoSetCategory } from './demo.js';

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
  disableDemo();
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
  // Cópias a cada chamada pra detecção de "mensagem nova" enxergar mudanças
  // (o demo muta o array em memória; sem copiar, prev e next seriam o mesmo ref).
  if (isDemo()) return Promise.resolve({ data: demoConversations.map((c) => ({ ...c })) });
  return request(`${accountPath('/conversations')}?status=${encodeURIComponent(status)}`);
}

// Testa a conexão com uma chamada leve autenticada — usado pela tela de login
// para avisar cedo se a URL/chave estão erradas (best-effort; lança em falha).
export async function verifyConnection() {
  await listConversations('open');
}

// Mensagens de uma conversa (thread)
export function listMessages(conversationId) {
  if (isDemo()) return Promise.resolve({ data: [...(demoMessages[conversationId] || [])] });
  return request(accountPath(`/conversations/${conversationId}/messages`));
}

// Enviar resposta do lojista (com anexo opcional de imagem/vídeo)
export function sendReply(conversationId, content, attachment) {
  if (isDemo()) { demoSend(conversationId, content, attachment); return Promise.resolve({}); }

  // Com anexo: upload multipart. ⚠️ Os nomes dos campos (content/attachments[])
  // seguem o padrão Chatwoot e PRECISAM ser validados contra a API real do
  // Libredesk — centralizados aqui pra ajuste trivial.
  if (attachment?.file) {
    const auth = getAuth();
    if (!auth) throw new Error('Não autenticado — configure URL e API key do Libredesk');
    const form = new FormData();
    if (content) form.append('content', content);
    form.append('attachments[]', attachment.file);
    const base = auth.url.replace(/\/$/, '');
    return fetch(`${base}${accountPath(`/conversations/${conversationId}/messages`)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.apiKey}` }, // sem Content-Type: o browser põe o boundary do multipart
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Libredesk POST → ${res.status}`);
      return res.status === 204 ? null : res.json();
    });
  }

  return request(accountPath(`/conversations/${conversationId}/messages`), {
    method: 'POST',
    body: { content },
  });
}

// Marcar conversa como lida (zera não-lidas) — ao abri-la.
export function markRead(conversationId) {
  if (isDemo()) { demoMarkRead(conversationId); return Promise.resolve(); }
  // ⚠️ endpoint real de "marcar como lida" a validar contra o Libredesk.
  return request(accountPath(`/conversations/${conversationId}`), {
    method: 'PATCH',
    body: { unread_count: 0 },
  }).catch(() => {});
}

// Definir a categoria da conversa (no real, mapeia pra label/status — a validar).
export function setCategory(conversationId, category) {
  if (isDemo()) { demoSetCategory(conversationId, category); return Promise.resolve(); }
  return request(accountPath(`/conversations/${conversationId}`), {
    method: 'PATCH',
    body: { category },
  });
}
