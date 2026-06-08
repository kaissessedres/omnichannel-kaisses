import { useEffect, useState } from 'react';
import { RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { listConversations, clearAuth } from '../api/libredesk.js';
import { accountTabs, filterByTab } from '../lib/inboxes.js';
import ConversationList from '../components/ConversationList.jsx';
import Spinner from '../components/Spinner.jsx';
import StateView from '../components/StateView.jsx';

// Tela principal: lista as conversas abertas, com abas por conta (Todos + cada
// canal/conta conectada).
export default function Inbox({ onOpen, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listConversations('open');
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

  const tabs = accountTabs(conversations);
  // Se a aba selecionada sumiu (ex: depois de um refresh), volta pra "Todos".
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'all';
  const visible = filterByTab(conversations, activeTab);

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

      {!loading && !error && conversations.length > 0 && (
        <nav className="sticky top-[57px] z-10 flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900/95 px-2 py-2 backdrop-blur">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                activeTab === t.key ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t.label}
              <span className={activeTab === t.key ? 'opacity-80' : 'text-slate-500'}>{t.count}</span>
            </button>
          ))}
        </nav>
      )}

      {loading ? (
        <Spinner label="Carregando conversas…" />
      ) : error ? (
        <StateView icon={AlertTriangle} title="Não consegui carregar as conversas" hint={error} action={load} />
      ) : (
        <ConversationList conversations={visible} onOpen={onOpen} />
      )}
    </div>
  );
}
