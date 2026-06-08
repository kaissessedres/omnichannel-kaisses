import { Inbox } from 'lucide-react';
import ChannelBadge from './ChannelBadge.jsx';
import StateView from './StateView.jsx';
import { formatRelative } from '../lib/time.js';
import { categoryLabel, categoryClass } from '../lib/categories.js';

// Lista de conversas. Os nomes de campo (contact, channel, last_message) ainda
// dependem do formato real da API do Libredesk — por isso os vários fallbacks.
export default function ConversationList({ conversations, onOpen }) {
  if (!conversations.length) {
    return <StateView icon={Inbox} title="Nenhuma conversa aberta" hint="As novas mensagens aparecem aqui." />;
  }

  return (
    // Superfície translúcida (fosca) sobre o fundo texturizado: as conversas
    // ficam num "painel" e os pontinhos do fundo não aparecem atrás delas.
    // Como a lista só tem a altura do conteúdo, a textura aparece no espaço que
    // sobra abaixo (ex: filtrado, com poucas conversas) — igual ao card do login.
    <ul className="divide-y divide-slate-800/80 bg-slate-900/80 backdrop-blur-sm">
      {conversations.map((c) => {
        const name = c.contact?.name || c.meta?.sender?.name || `#${c.id}`;
        const preview = c.last_message || c.messages?.[0]?.content || '';
        const when = formatRelative(c.last_activity_at || c.updated_at || c.created_at);
        const unread = c.unread_count || 0;
        return (
          <li key={c.id}>
            <button
              onClick={() => onOpen(c)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/60 active:bg-slate-800"
            >
              <ChannelBadge channel={c.channel || c.inbox?.channel_type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${unread ? 'font-semibold text-slate-100' : 'font-medium'}`}>{name}</span>
                  {when && <span className="shrink-0 text-xs text-slate-500">{when}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`block flex-1 truncate text-sm ${unread ? 'text-slate-300' : 'text-slate-400'}`}>{preview}</span>
                  {unread > 0 && <span className="badge badge-primary badge-sm shrink-0">{unread}</span>}
                </span>
                {c.category && (
                  <span className={`badge badge-sm mt-1 ${categoryClass(c.category)}`}>{categoryLabel(c.category)}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
