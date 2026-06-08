// Categorias de conversa (no lugar do antigo "Resolver"). No Libredesk real
// mapeiam pra labels/tags ou status — a validar quando o servidor subir. Puro.

export const CATEGORIES = [
  { key: 'primeiro_contato', label: 'Primeiro contato', cls: 'badge-info' },
  { key: 'orcamento', label: 'Orçamento enviado', cls: 'badge-warning' },
  { key: 'pedido_feito', label: 'Pedido feito', cls: 'badge-success' },
  { key: 'resolvido', label: 'Resolvido', cls: 'badge-neutral' },
];

export function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.label || null;
}
export function categoryClass(key) {
  return CATEGORIES.find((c) => c.key === key)?.cls || 'badge-ghost';
}

// Filtra por categoria. 'all' = tudo; 'unread' = não-lidas; senão a categoria.
export function filterByCategory(conversations, value) {
  if (!value || value === 'all') return conversations;
  if (value === 'unread') return conversations.filter((c) => (c.unread_count || 0) > 0);
  return conversations.filter((c) => c.category === value);
}

// Chips do filtro: Todas + Não lidas (se houver) + as categorias presentes, com contagem.
export function categoryFilters(conversations) {
  const counts = {};
  for (const c of conversations) if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
  const unread = conversations.filter((c) => (c.unread_count || 0) > 0).length;

  const chips = [{ key: 'all', label: 'Todas', count: conversations.length }];
  if (unread) chips.push({ key: 'unread', label: 'Não lidas', count: unread });
  for (const cat of CATEGORIES) if (counts[cat.key]) chips.push({ key: cat.key, label: cat.label, count: counts[cat.key] });
  return chips;
}
