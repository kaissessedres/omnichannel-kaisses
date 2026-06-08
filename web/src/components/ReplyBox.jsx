import { useState } from 'react';
import { Send } from 'lucide-react';

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
        className="input flex-1 rounded-full bg-slate-700 text-sm focus:outline-none disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Responder…"
        disabled={disabled || sending}
      />
      <button
        type="submit"
        disabled={disabled || sending || !text.trim()}
        className="btn btn-primary btn-circle"
        aria-label="Enviar"
      >
        {sending ? <span className="loading loading-spinner loading-sm" /> : <Send className="h-5 w-5" />}
      </button>
    </form>
  );
}
