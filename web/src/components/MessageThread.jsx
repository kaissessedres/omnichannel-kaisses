import { useEffect, useRef } from 'react';
import { formatTime } from '../lib/time.js';
import { messageMedia } from '../lib/media.js';

// Thread de mensagens com as bolhas de chat do daisyUI. Mensagens do lojista
// (outgoing) vão à direita (chat-end); do cliente, à esquerda (chat-start).
export default function MessageThread({ messages }) {
  const endRef = useRef(null);

  // Rola pro fim quando chega mensagem nova. O `?.()` evita quebrar no jsdom
  // (testes), que não implementa scrollIntoView.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  if (!messages.length) {
    return <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">Nenhuma mensagem ainda.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((m) => {
        const outgoing = m.message_type === 'outgoing' || m.outgoing;
        const time = formatTime(m.created_at || m.created_time);
        const media = messageMedia(m);
        return (
          <div key={m.id} className={`chat ${outgoing ? 'chat-end' : 'chat-start'}`}>
            <div className={`chat-bubble whitespace-pre-wrap break-words ${outgoing ? 'chat-bubble-primary' : ''}`}>
              {media && (media.type === 'video'
                ? <video src={media.url} controls className="mb-1 max-h-60 rounded-lg" />
                : <img src={media.url} alt={media.name || 'anexo'} className="mb-1 max-h-60 rounded-lg object-cover" />)}
              {m.content}
            </div>
            {time && <div className="chat-footer mt-0.5 text-[10px] opacity-50">{time}</div>}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
