import { useEffect, useState } from 'react';
import { listMessages, sendReply, resolveConversation } from '../api/libredesk.js';
import MessageThread from '../components/MessageThread.jsx';
import ReplyBox from '../components/ReplyBox.jsx';

// Conversa aberta: thread de mensagens + caixa de resposta fixa no rodapé.
export default function Conversation({ conversation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      const data = await listMessages(conversation.id);
      setMessages(data?.data || data?.messages || data || []);
    } catch (err) {
      setError(err.message);
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
      <header className="sticky top-0 flex items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <button onClick={onBack} className="text-slate-400">‹ Voltar</button>
        <span className="flex-1 truncate font-medium">{conversation.contact?.name || `#${conversation.id}`}</span>
        <button onClick={resolve} className="text-sm text-slate-400">Resolver</button>
      </header>
      {error && <p className="p-4 text-red-400">Erro: {error}</p>}
      <MessageThread messages={messages} />
      <ReplyBox onSend={reply} />
    </div>
  );
}
