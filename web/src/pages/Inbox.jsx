import { useEffect, useState } from 'react';
import { listConversations, clearAuth } from '../api/libredesk.js';
import ConversationList from '../components/ConversationList.jsx';

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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <h1 className="text-lg font-semibold">Conversas</h1>
        <div className="flex gap-3 text-sm text-slate-400">
          <button onClick={load}>Atualizar</button>
          <button onClick={logout}>Sair</button>
        </div>
      </header>
      {loading && <p className="p-4 text-slate-400">Carregando…</p>}
      {error && <p className="p-4 text-red-400">Erro: {error}</p>}
      {!loading && !error && <ConversationList conversations={conversations} onOpen={onOpen} />}
    </div>
  );
}
