// Thread de mensagens. Mensagens do lojista (outgoing) vão à direita; do
// cliente, à esquerda. O critério de "outgoing" depende do formato da API real.
export default function MessageThread({ messages }) {
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {messages.map((m) => {
        const outgoing = m.message_type === 'outgoing' || m.outgoing;
        return (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${outgoing ? 'ml-auto bg-indigo-600' : 'bg-slate-700'}`}
          >
            {m.content}
          </div>
        );
      })}
    </div>
  );
}
