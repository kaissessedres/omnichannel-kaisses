import ChannelBadge from './ChannelBadge.jsx';

// Lista de conversas. Os nomes de campo (contact, channel, last_message) ainda
// dependem do formato real da API do Libredesk — por isso os vários fallbacks.
export default function ConversationList({ conversations, onOpen }) {
  if (!conversations.length) {
    return <p className="p-4 text-slate-400">Nenhuma conversa aberta.</p>;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {conversations.map((c) => (
        <li key={c.id}>
          <button onClick={() => onOpen(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-800">
            <ChannelBadge channel={c.channel || c.inbox?.channel_type} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.contact?.name || c.meta?.sender?.name || `#${c.id}`}</span>
              <span className="block truncate text-sm text-slate-400">{c.last_message || c.messages?.[0]?.content || ''}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
