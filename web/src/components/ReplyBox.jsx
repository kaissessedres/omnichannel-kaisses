import { useState } from 'react';

// Caixa de resposta fixa no rodapé. O padding extra com env(safe-area-inset)
// evita que o botão fique embaixo da barra de gestos do iPhone.
export default function ReplyBox({ onSend, disabled = false }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending || disabled) return;
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
        className="flex-1 rounded-full bg-slate-700 px-4 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Responder…"
        disabled={disabled || sending}
      />
      <button
        disabled={disabled || sending || !text.trim()}
        className="flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-50"
      >
        {sending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {sending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}
