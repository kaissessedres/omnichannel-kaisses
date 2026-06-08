import { Inbox } from 'lucide-react';
import ChannelBadge from './ChannelBadge.jsx';
import StateView from './StateView.jsx';
import { formatRelative } from '../lib/time.js';

// Lista de conversas. Os nomes de campo (contact, channel, last_message) ainda
// dependem do formato real da API do Libredesk — por isso os vários fallbacks.
export default function ConversationList({ conversations, onOpen }) {
  if (!conversations.length) {
    return <StateView icon={Inbox} title="Nenhuma conversa aberta" hint="As novas mensagens aparecem aqui." />;
  }

  return (
    <ul className="divide-y divide-slate-800">
      {conversations.map((c) => {
        const name = c.contact?.name || c.meta?.sender?.name || `#${c.id}`;
        const preview = c.last_message || c.messages?.[0]?.content || '';
        const when = formatRelative(c.last_activity_at || c.updated_at || c.created_at);
        return (
          <li key={c.id}>
            <button onClick={() => onOpen(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-800">
              <ChannelBadge channel={c.channel || c.inbox?.channel_type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{name}</span>
                  {when && <span className="shrink-0 text-xs text-slate-500">{when}</span>}
                </span>
                <span className="block truncate text-sm text-slate-400">{preview}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
