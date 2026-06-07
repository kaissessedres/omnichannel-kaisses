import { useState } from 'react';
import { saveAuth } from '../api/libredesk.js';

// Primeira abertura: pede URL + API key + accountId do Libredesk e guarda no
// localStorage (ver "Autenticação" em docs/CLAUDE-pwa.md). VITE_LIBREDESK_URL,
// se definida no build, só pré-preenche o campo.
export default function Login({ onAuthed }) {
  const [url, setUrl] = useState(import.meta.env.VITE_LIBREDESK_URL || '');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('1');

  function submit(e) {
    e.preventDefault();
    saveAuth({ url: url.trim(), apiKey: apiKey.trim(), accountId: accountId.trim() || '1' });
    onAuthed();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-800 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Megachat</h1>
        <p className="text-sm text-slate-400">Conecte-se ao seu Libredesk.</p>
        <label className="block text-sm">
          URL do Libredesk
          <input className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required />
        </label>
        <label className="block text-sm">
          API key
          <input className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
        </label>
        <label className="block text-sm">
          Account ID
          <input className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        </label>
        <button className="w-full rounded-lg bg-indigo-500 py-2 font-medium">Entrar</button>
      </form>
    </div>
  );
}
