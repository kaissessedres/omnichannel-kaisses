import { useState } from 'react';

// Caixa de resposta fixa no rodapé. O padding extra com env(safe-area-inset)
// evita que o botão fique embaixo da barra de gestos do iPhone.
export default function ReplyBox({ onSend }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 flex gap-2 border-t border-slate-800 bg-slate-900 p-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <input
        className="flex-1 rounded-full bg-slate-700 px-4 py-2 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Responder…"
      />
      <button disabled={sending} className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium disabled:opacity-50">
        Enviar
      </button>
    </form>
  );
}
