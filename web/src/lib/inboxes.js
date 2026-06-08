// Agrupa conversas por conta/inbox para as abas da Inbox. Puro e testável.
// Cada conta conectada no Libredesk é um inbox; quando a conversa traz `inbox`
// (id + nome + canal), a aba é por conta (ex: "Mercado Livre 1"/"2"). Sem isso,
// cai pro canal (ex: "WhatsApp").

export const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
};

// Devolve { key, label, channel } do grupo (conta/inbox ou canal) de uma conversa.
export function conversationGroup(c) {
  const inbox = c?.inbox;
  if (inbox && inbox.id != null) {
    return {
      key: `inbox:${inbox.id}`,
      label: inbox.name || CHANNEL_LABELS[inbox.channel_type] || inbox.channel_type,
      channel: inbox.channel_type,
    };
  }
  const ch = c?.channel || 'outros';
  return { key: `channel:${ch}`, label: CHANNEL_LABELS[ch] || ch, channel: ch };
}

// Monta as abas a partir das conversas: "Todos" + uma por conta, com contagem.
export function accountTabs(conversations) {
  const groups = new Map();
  for (const c of conversations) {
    const g = conversationGroup(c);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, count: 0 });
    groups.get(g.key).count += 1;
  }
  return [
    { key: 'all', label: 'Todos', channel: null, count: conversations.length },
    ...groups.values(),
  ];
}

// Filtra a lista pela aba selecionada ('all' = tudo).
export function filterByTab(conversations, tabKey) {
  if (tabKey === 'all') return conversations;
  return conversations.filter((c) => conversationGroup(c).key === tabKey);
}
