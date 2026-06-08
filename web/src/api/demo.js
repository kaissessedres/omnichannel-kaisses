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

// "Foto de produto" de exemplo (SVG inline — funciona offline, sem asset).
const PRODUCT_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="180">'
  + '<rect width="260" height="180" rx="14" fill="#6366f1"/>'
  + '<circle cx="130" cy="78" r="34" fill="#fff" opacity="0.9"/>'
  + '<rect x="150" y="64" width="22" height="28" rx="4" fill="#fff" opacity="0.9"/>'
  + '<text x="130" y="150" font-size="18" fill="#fff" text-anchor="middle" font-family="sans-serif">Arte das canecas</text>'
  + '</svg>'
);

const INBOX = {
  whatsapp: { id: 7, channel_type: 'whatsapp', name: 'WhatsApp' },
  instagram: { id: 5, channel_type: 'instagram', name: 'Instagram' },
  ml1: { id: 3, channel_type: 'mercadolivre', name: 'Mercado Livre 1' },
  ml2: { id: 4, channel_type: 'mercadolivre', name: 'Mercado Livre 2' },
  shopee: { id: 8, channel_type: 'shopee', name: 'Shopee 1' },
};

export const demoConversations = [
  { id: 'c1', channel: 'whatsapp',     inbox: INBOX.whatsapp,  contact: { name: 'Marina Souza' }, last_message: 'Oi! A caneca personalizada já saiu?', last_activity_at: ago(3 * min), unread_count: 2, category: 'pedido_feito' },
  { id: 'c2', channel: 'instagram',    inbox: INBOX.instagram, contact: { name: 'ateliê.gabi' },   last_message: 'Amei o orçamento, vou fechar 💜',      last_activity_at: ago(40 * min), category: 'orcamento' },
  { id: 'c3', channel: 'mercadolivre', inbox: INBOX.ml1,       contact: { name: 'João P.' },       last_message: 'Consigo retirar amanhã de manhã?',    last_activity_at: ago(3 * 60 * min), category: 'primeiro_contato' },
  { id: 'c5', channel: 'mercadolivre', inbox: INBOX.ml2,       contact: { name: 'Bruna L.' },      last_message: 'Chega quando pro CEP 30110-000?',     last_activity_at: ago(5 * 60 * min), unread_count: 3, category: 'pedido_feito' },
  { id: 'c4', channel: 'shopee',       inbox: INBOX.shopee,    contact: { name: 'Loja do Léo' },   last_message: 'Tem desconto pra pedido no atacado?', last_activity_at: ago(26 * 60 * min), unread_count: 1, category: 'primeiro_contato' },
];

export const demoMessages = {
  c1: [
    { id: 'c1m1', message_type: 'incoming', content: 'Oi! A caneca personalizada já saiu?', created_at: ago(8 * min) },
    { id: 'c1m2', message_type: 'outgoing', content: 'Oi Marina! Saiu sim 😊 Posto o código de rastreio ainda hoje.', created_at: ago(6 * min) },
    { id: 'c1m3', message_type: 'incoming', content: 'Perfeito, obrigada! E a segunda caneca?', created_at: ago(3 * min) },
  ],
  c2: [
    { id: 'c2m1', message_type: 'incoming', content: 'Oii, vi o post das canecas de casal', created_at: ago(55 * min) },
    { id: 'c2m2', message_type: 'outgoing', content: 'Oi Gabi! Olha como ficou a arte 👇', created_at: ago(50 * min), attachments: [{ file_type: 'image', data_url: PRODUCT_IMG, file_name: 'arte-canecas.png' }] },
    { id: 'c2m3', message_type: 'outgoing', content: 'O par sai por R$ 79, com a arte que você quiser.', created_at: ago(45 * min) },
    { id: 'c2m4', message_type: 'incoming', content: 'Amei o orçamento, vou fechar 💜', created_at: ago(40 * min) },
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
export function demoSend(conversationId, content, attachment) {
  const msg = {
    id: `d${Date.now()}`,
    message_type: 'outgoing',
    content: content || '',
    created_at: new Date().toISOString(),
  };
  if (attachment?.url) {
    msg.attachments = [{ file_type: attachment.type, data_url: attachment.url, file_name: attachment.name }];
  }
  (demoMessages[conversationId] ||= []).push(msg);
}

const SAMPLE_INCOMING = [
  'Oi! Ainda dá tempo de mudar a arte?',
  'Bom dia, chegou meu pedido?',
  'Consigo um brinde no combo? 🙏',
  'Vocês fazem entrega hoje?',
];

// Marca a conversa como lida (zera não-lidas) — ao abri-la.
export function demoMarkRead(id) {
  const c = demoConversations.find((x) => x.id === id);
  if (c) c.unread_count = 0;
}

// Define a categoria da conversa.
export function demoSetCategory(id, category) {
  const c = demoConversations.find((x) => x.id === id);
  if (c) c.category = category;
}

// Simula uma mensagem nova chegando: escolhe uma conversa, incrementa não-lidas,
// atualiza a prévia e acrescenta a mensagem (incoming). Usado pelo botão
// "simular mensagem" no modo demo, pra disparar o som/notificação.
export function demoSimulateIncoming() {
  const c = demoConversations[Math.floor(Math.random() * demoConversations.length)];
  const text = SAMPLE_INCOMING[Math.floor(Math.random() * SAMPLE_INCOMING.length)];
  c.unread_count = (c.unread_count || 0) + 1;
  c.last_message = text;
  c.last_activity_at = new Date().toISOString();
  (demoMessages[c.id] ||= []).push({ id: `sim${Date.now()}`, message_type: 'incoming', content: text, created_at: new Date().toISOString() });
  return c;
}
