// Ícone curto por canal: sigla + cor. Cai num genérico quando o canal é
// desconhecido (ex: a API ainda não rotulou, ou um canal novo).
const CHANNELS = {
  whatsapp: { label: 'WA', color: 'bg-green-600' },
  instagram: { label: 'IG', color: 'bg-pink-600' },
  mercadolivre: { label: 'ML', color: 'bg-yellow-500' },
  shopee: { label: 'SH', color: 'bg-orange-600' },
};

export default function ChannelBadge({ channel }) {
  const c = CHANNELS[channel] || { label: '??', color: 'bg-slate-600' };
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${c.color}`}>
      {c.label}
    </span>
  );
}
