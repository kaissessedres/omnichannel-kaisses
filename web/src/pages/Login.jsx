import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { saveAuth, verifyConnection } from '../api/libredesk.js';
import { enableDemo } from '../api/demo.js';

// Primeira abertura: pede o endereço do Libredesk + a chave de acesso (API key)
// e guarda no localStorage (ver "Autenticação" em docs/CLAUDE-pwa.md). Ao entrar,
// testa a conexão pra avisar cedo se algo está errado; se o backend ainda não
// estiver no ar, dá pra "entrar mesmo assim". VITE_LIBREDESK_URL pré-preenche.
export default function Login({ onAuthed }) {
  const [url, setUrl] = useState(import.meta.env.VITE_LIBREDESK_URL || '');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('1');
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canForce, setCanForce] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setCanForce(false);

    if (!/^https?:\/\//i.test(url.trim())) {
      setError('O endereço deve começar com http:// ou https://');
      return;
    }

    saveAuth({ url: url.trim(), apiKey: apiKey.trim(), accountId: accountId.trim() || '1' });
    setLoading(true);
    try {
      await verifyConnection();
      onAuthed();
    } catch (err) {
      setError(`Não consegui conectar — confira o endereço e a chave. (${err.message})`);
      setCanForce(true);
    } finally {
      setLoading(false);
    }
  }

  const field = 'mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 outline-none ring-indigo-500 focus:ring-2';

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl bg-slate-800 p-6 text-slate-100 shadow-xl">
        <header className="flex flex-col items-center gap-2 text-center">
          <img src="/icons/icon.svg" alt="" className="h-14 w-14" />
          <h1 className="text-2xl font-semibold">Megachat</h1>
          <p className="text-sm text-slate-400">Seu inbox de todos os canais, num só lugar.</p>
        </header>

        <label className="block text-sm font-medium">
          Endereço do atendimento
          <input
            className={field}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            inputMode="url"
            autoComplete="url"
            required
          />
          <span className="mt-1 block text-xs text-slate-500">O endereço do seu Libredesk.</span>
        </label>

        <label className="block text-sm font-medium">
          Chave de acesso
          <div className="relative mt-1">
            <input
              className={`${field} mt-0 pr-10`}
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"
              aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
            >
              {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <span className="mt-1 block text-xs text-slate-500">A API key gerada no Libredesk.</span>
        </label>

        <div>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-slate-400">
            {showAdvanced ? '▾' : '▸'} Avançado
          </button>
          {showAdvanced && (
            <label className="mt-2 block text-sm font-medium">
              Account ID
              <input
                className={field}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                inputMode="numeric"
              />
              <span className="mt-1 block text-xs text-slate-500">Normalmente 1.</span>
            </label>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>
        )}

        <button disabled={loading} className="btn btn-primary w-full">
          {loading && <span className="loading loading-spinner loading-sm" />}
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        {canForce && (
          <button type="button" onClick={onAuthed} className="block w-full text-center text-xs text-slate-400 underline">
            Entrar mesmo assim
          </button>
        )}

        <div className="divider text-xs text-slate-500">ou</div>
        <button
          type="button"
          onClick={() => { enableDemo(); onAuthed(); }}
          className="btn btn-ghost btn-sm w-full text-slate-300"
        >
          Ver demonstração (sem conta)
        </button>
      </form>
    </div>
  );
}
