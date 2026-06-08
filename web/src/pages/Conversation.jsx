import { useEffect, useState } from 'react';
import { ChevronLeft, AlertTriangle, Tag } from 'lucide-react';
import { listMessages, sendReply, markRead, setCategory } from '../api/libredesk.js';
import { conversationGroup } from '../lib/inboxes.js';
import { CATEGORIES } from '../lib/categories.js';
import MessageThread from '../components/MessageThread.jsx';
import ReplyBox from '../components/ReplyBox.jsx';
import ChannelBadge from '../components/ChannelBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import StateView from '../components/StateView.jsx';

// Conversa aberta: thread de mensagens + caixa de resposta. Ao abrir, marca como
// lida (zera não-lidas). O header tem um seletor de categoria (no lugar do antigo
// botão "Resolver").
export default function Conversation({ conversation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCat] = useState(conversation.category || '');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listMessages(conversation.id);
      setMessages(data?.data || data?.messages || data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    markRead(conversation.id); // visualizou → zera não-lidas
    load();
  }, [conversation.id]);

  async function reply(text, attachment) {
    await sendReply(conversation.id, text, attachment);
    await load();
  }

  function changeCategory(value) {
    setCat(value);
    setCategory(conversation.id, value);
  }

  return (
    <div className="flex min-h-screen flex-col bg-app text-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-3 backdrop-blur">
        <button onClick={onBack} className="flex items-center px-1 text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <ChannelBadge channel={conversation.channel || conversation.inbox?.channel_type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium leading-tight">{conversation.contact?.name || `#${conversation.id}`}</span>
          <span className="block truncate text-xs text-slate-400">{conversationGroup(conversation).label}</span>
        </span>
        <label className="flex items-center gap-1 text-slate-400" title="Categoria">
          <Tag className="h-4 w-4" />
          <select
            value={category}
            onChange={(e) => changeCategory(e.target.value)}
            aria-label="Categoria"
            className="select select-xs max-w-[8.5rem] bg-slate-800 text-slate-200"
          >
            <option value="">Categoria…</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </header>

      {loading ? (
        <Spinner label="Carregando mensagens…" />
      ) : error ? (
        <StateView icon={AlertTriangle} title="Não consegui carregar as mensagens" hint={error} action={load} />
      ) : (
        <MessageThread messages={messages} />
      )}

      <ReplyBox onSend={reply} disabled={loading || !!error} />
    </div>
  );
}
