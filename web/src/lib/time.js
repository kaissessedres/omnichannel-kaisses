// Formatação de datas para a UI. Puro e sem dependências — testável.

// "14:05" (hora local). Vazio se a data for inválida/ausente.
export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Tempo relativo curto para a lista: "agora", "5 min", "2 h", "ontem", "3 d" ou
// a data (dd/mm) para mais de uma semana. `now` é injetável para testes.
export function formatRelative(iso, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((now - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `${days} d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
