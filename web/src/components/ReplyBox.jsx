import { useRef, useState } from 'react';
import { Send, Paperclip, X, Film } from 'lucide-react';
import { fileKind } from '../lib/media.js';

// Caixa de resposta fixa no rodapé, com anexo (imagem/vídeo). O padding extra
// com env(safe-area-inset) evita o botão ficar embaixo da barra de gestos do iPhone.
export default function ReplyBox({ onSend, disabled = false }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null); // { file, url, type, name }
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL?.(file);
    setAttachment({ file, url, type: fileKind(file), name: file.name });
    e.target.value = ''; // permite re-selecionar o mesmo arquivo depois
  }

  function removeAttachment() {
    if (attachment?.url) URL.revokeObjectURL?.(attachment.url);
    setAttachment(null);
  }

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if ((!value && !attachment) || sending || disabled) return;
    setSending(true);
    try {
      await onSend(value, attachment);
      setText('');
      removeAttachment();
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-800 bg-slate-900 p-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      {attachment && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-2">
          {attachment.type === 'image' && attachment.url
            ? <img src={attachment.url} alt="" className="h-12 w-12 rounded object-cover" />
            : <Film className="h-6 w-6 shrink-0 text-slate-400" />}
          <span className="flex-1 truncate text-xs text-slate-400">{attachment.name}</span>
          <button type="button" onClick={removeAttachment} aria-label="Remover anexo" className="btn btn-ghost btn-xs btn-square">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pickFile} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || sending}
          aria-label="Anexar"
          className="btn btn-ghost btn-circle"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          className="input flex-1 rounded-full bg-slate-700 text-sm focus:outline-none disabled:opacity-50"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Responder…"
          disabled={disabled || sending}
        />
        <button
          type="submit"
          disabled={disabled || sending || (!text.trim() && !attachment)}
          className="btn btn-primary btn-circle"
          aria-label="Enviar"
        >
          {sending ? <span className="loading loading-spinner loading-sm" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
}
