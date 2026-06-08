import { useEffect, useState } from 'react';
import { RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { listConversations, clearAuth } from '../api/libredesk.js';
import ConversationList from '../components/ConversationList.jsx';
import Spinner from '../components/Spinner.jsx';
import StateView from '../components/StateView.jsx';

// Tela principal: lista as conversas abertas de todos os canais.
export default function Inbox({ onOpen, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listConversations('open');
      // o envelope exato depende da API real do Libredesk (a validar) — aceita
      // as formas mais prováveis sem casar com um formato específico
      setConversations(data?.data || data?.conversations || data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function logout() {
    clearAuth();
    onLogout();
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Conversas</h1>
        <div className="flex items-center gap-1 text-slate-400">
          <button onClick={load} className="btn btn-ghost btn-sm btn-square" aria-label="Atualizar">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button onClick={logout} className="btn btn-ghost btn-sm btn-square" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {loading ? (
        <Spinner label="Carregando conversas…" />
      ) : error ? (
        <StateView icon={AlertTriangle} title="Não consegui carregar as conversas" hint={error} action={load} />
      ) : (
        <ConversationList conversations={conversations} onOpen={onOpen} />
      )}
    </div>
  );
}
