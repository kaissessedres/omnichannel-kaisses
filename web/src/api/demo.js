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

const INBOX = {
  whatsapp: { id: 7, channel_type: 'whatsapp', name: 'WhatsApp' },
  instagram: { id: 5, channel_type: 'instagram', name: 'Instagram' },
  ml1: { id: 3, channel_type: 'mercadolivre', name: 'Mercado Livre 1' },
  ml2: { id: 4, channel_type: 'mercadolivre', name: 'Mercado Livre 2' },
  shopee: { id: 8, channel_type: 'shopee', name: 'Shopee 1' },
};

export const demoConversations = [
  { id: 'c1', channel: 'whatsapp',     inbox: INBOX.whatsapp,  contact: { name: 'Marina Souza' }, last_message: 'Oi! A caneca personalizada já saiu?', last_activity_at: ago(3 * min), unread_count: 2 },
  { id: 'c2', channel: 'instagram',    inbox: INBOX.instagram, contact: { name: 'ateliê.gabi' },   last_message: 'Amei o orçamento, vou fechar 💜',      last_activity_at: ago(40 * min) },
  { id: 'c3', channel: 'mercadolivre', inbox: INBOX.ml1,       contact: { name: 'João P.' },       last_message: 'Consigo retirar amanhã de manhã?',    last_activity_at: ago(3 * 60 * min) },
  { id: 'c5', channel: 'mercadolivre', inbox: INBOX.ml2,       contact: { name: 'Bruna L.' },      last_message: 'Chega quando pro CEP 30110-000?',     last_activity_at: ago(5 * 60 * min), unread_count: 3 },
  { id: 'c4', channel: 'shopee',       inbox: INBOX.shopee,    contact: { name: 'Loja do Léo' },   last_message: 'Tem desconto pra pedido no atacado?', last_activity_at: ago(26 * 60 * min), unread_count: 1 },
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
  c5: [
    { id: 'c5m1', message_type: 'incoming', content: 'Oi! Comprei a moldura personalizada', created_at: ago(6 * 60 * min) },
    { id: 'c5m2', message_type: 'outgoing', content: 'Oi Bruna! Já está em produção 🙌', created_at: ago(5.2 * 60 * min) },
    { id: 'c5m3', message_type: 'incoming', content: 'Chega quando pro CEP 30110-000?', created_at: ago(5 * 60 * min) },
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
