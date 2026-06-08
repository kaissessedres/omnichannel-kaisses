import { useEffect, useRef } from 'react';
import { formatTime } from '../lib/time.js';

// Thread de mensagens. Mensagens do lojista (outgoing) vão à direita; do
// cliente, à esquerda. O critério de "outgoing" depende do formato da API real.
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
    <div className="flex-1 space-y-1.5 overflow-y-auto p-4">
      {messages.map((m) => {
        const outgoing = m.message_type === 'outgoing' || m.outgoing;
        const time = formatTime(m.created_at || m.created_time);
        return (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${outgoing ? 'ml-auto bg-indigo-600' : 'bg-slate-700'}`}
          >
            <span className="whitespace-pre-wrap break-words">{m.content}</span>
            {time && <span className="mt-0.5 block text-right text-[10px] text-white/50">{time}</span>}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
