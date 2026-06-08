// Modo demonstração — deixa o app navegável/clicável com dados de exemplo, SEM
// backend nenhum (tipo um protótipo). Ativado pelo botão "Ver demonstração" no
// login; o cliente da API (libredesk.js) desvia para estes dados quando isDemo().

const KEY = 'megachat.demo';

export function isDemo() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
export function enableDemo() { localStorage.setItem(KEY, '1'); }
export function disableDemo() { localStorage.removeItem(KEY); }

const min = 60_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

export const demoConversations = [
  { id: 'c1', channel: 'whatsapp',     contact: { name: 'Marina Souza' },  last_message: 'Oi! A caneca personalizada já saiu?', last_activity_at: ago(3 * min), unread_count: 2 },
  { id: 'c2', channel: 'instagram',    contact: { name: 'ateliê.gabi' },    last_message: 'Amei o orçamento, vou fechar 💜',       last_activity_at: ago(40 * min) },
  { id: 'c3', channel: 'mercadolivre', contact: { name: 'João P.' },        last_message: 'Consigo retirar amanhã de manhã?',     last_activity_at: ago(3 * 60 * min) },
  { id: 'c4', channel: 'shopee',       contact: { name: 'Loja do Léo' },    last_message: 'Tem desconto pra pedido no atacado?',  last_activity_at: ago(26 * 60 * min), unread_count: 1 },
];

export const demoMessages = {
  c1: [
    { id: 'c1m1', message_type: 'incoming', content: 'Oi! A caneca personalizada já saiu?', created_at: ago(8 * min) },
    { id: 'c1m2', message_type: 'outgoing', content: 'Oi Marina! Saiu sim 😊 Posto o código de rastreio ainda hoje.', created_at: ago(6 * min) },
    { id: 'c1m3', message_type: 'incoming', content: 'Perfeito, obrigada! E a segunda caneca?', created_at: ago(3 * min) },
  ],
  c2: [
    { id: 'c2m1', message_type: 'incoming', content: 'Oii, vi o post das canecas de casal', created_at: ago(55 * min) },
    { id: 'c2m2', message_type: 'outgoing', content: 'Oi Gabi! O par sai por R$ 79, com a arte que você quiser.', created_at: ago(45 * min) },
    { id: 'c2m3', message_type: 'incoming', content: 'Amei o orçamento, vou fechar 💜', created_at: ago(40 * min) },
  ],
  c3: [
    { id: 'c3m1', message_type: 'incoming', content: 'Consigo retirar amanhã de manhã?', created_at: ago(3 * 60 * min) },
  ],
  c4: [
    { id: 'c4m1', message_type: 'incoming', content: 'Tem desconto pra pedido no atacado?', created_at: ago(26 * 60 * min) },
  ],
};

// Simula o envio: acrescenta a mensagem do lojista à conversa em memória (reseta
// ao recarregar a página — é só demonstração).
export function demoSend(conversationId, content) {
  (demoMessages[conversationId] ||= []).push({
    id: `d${Date.now()}`,
    message_type: 'outgoing',
    content,
    created_at: new Date().toISOString(),
  });
}
