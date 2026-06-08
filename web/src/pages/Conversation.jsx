import { useEffect, useState } from 'react';
import { ChevronLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { listMessages, sendReply, resolveConversation } from '../api/libredesk.js';
import MessageThread from '../components/MessageThread.jsx';
import ReplyBox from '../components/ReplyBox.jsx';
import ChannelBadge from '../components/ChannelBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import StateView from '../components/StateView.jsx';

// Conversa aberta: thread de mensagens + caixa de resposta fixa no rodapé.
export default function Conversation({ conversation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, [conversation.id]);

  async function reply(text) {
    await sendReply(conversation.id, text);
    await load();
  }

  async function resolve() {
    await resolveConversation(conversation.id);
    onBack();
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-3 py-3 backdrop-blur">
        <button onClick={onBack} className="flex items-center px-1 text-slate-400 hover:text-slate-100" aria-label="Voltar">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <ChannelBadge channel={conversation.channel || conversation.inbox?.channel_type} />
        <span className="flex-1 truncate font-medium">{conversation.contact?.name || `#${conversation.id}`}</span>
        <button onClick={resolve} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100">
          <CheckCircle2 className="h-4 w-4" /> Resolver
        </button>
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
