import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, LogOut, AlertTriangle, Bell, BellOff, MessageSquarePlus } from 'lucide-react';
import { listConversations, clearAuth } from '../api/libredesk.js';
import { isDemo, demoSimulateIncoming } from '../api/demo.js';
import { accountTabs, filterByTab } from '../lib/inboxes.js';
import { categoryFilters, filterByCategory } from '../lib/categories.js';
import { newIncoming, playDing, vibrate, notify, requestNotificationPermission } from '../lib/notify.js';
import ConversationList from '../components/ConversationList.jsx';
import Spinner from '../components/Spinner.jsx';
import StateView from '../components/StateView.jsx';

const POLL_MS = 15000; // auto-refresh da lista

function alertsInitial() {
  try { return localStorage.getItem('megachat.alerts') !== '0'; } catch { return true; }
}

// Tela principal: conversas abertas, com abas por conta, filtro por categoria e
// alertas (som + vibração + notificação) quando chega mensagem nova.
export default function Inbox({ onOpen, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [cat, setCatFilter] = useState('all');
  const [alerts, setAlerts] = useState(alertsInitial);

  const prevRef = useRef(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const load = useCallback(async () => {
    try {
      const data = await listConversations('open');
      const list = data?.data || data?.conversations || data || [];

      if (prevRef.current && alertsRef.current) {
        const novas = newIncoming(prevRef.current, list);
        if (novas.length) {
          playDing();
          vibrate();
          const nome = novas[0].contact?.name || 'cliente';
          notify('Nova mensagem', novas.length === 1 ? `De ${nome}` : `${novas.length} novas conversas`);
        }
      }
      prevRef.current = list;
      setConversations(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  function logout() {
    clearAuth();
    onLogout();
  }

  function toggleAlerts() {
    setAlerts((on) => {
      const next = !on;
      try { localStorage.setItem('megachat.alerts', next ? '1' : '0'); } catch { /* ignore */ }
      if (next) requestNotificationPermission();
      return next;
    });
  }

  async function simulate() {
    demoSimulateIncoming();
    await load();
  }

  const tabs = accountTabs(conversations);
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'all';
  const byAccount = filterByTab(conversations, activeTab);

  const catChips = categoryFilters(byAccount);
  const activeCat = catChips.some((c) => c.key === cat) ? cat : 'all';
  const visible = filterByCategory(byAccount, activeCat);

  return (
    <div className="flex min-h-screen flex-col bg-app text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Conversas</h1>
        <div className="flex items-center gap-0.5 text-slate-400">
          {isDemo() && (
            <button onClick={simulate} className="btn btn-ghost btn-sm btn-square" aria-label="Simular mensagem">
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          )}
          <button onClick={toggleAlerts} className="btn btn-ghost btn-sm btn-square" aria-label={alerts ? 'Desativar alertas' : 'Ativar alertas'}>
            {alerts ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </button>
          <button onClick={load} className="btn btn-ghost btn-sm btn-square" aria-label="Atualizar">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button onClick={logout} className="btn btn-ghost btn-sm btn-square" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {!loading && !error && conversations.length > 0 && (
        <>
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

          {catChips.length > 1 && (
            <nav className="flex gap-1 overflow-x-auto border-b border-slate-800/60 bg-slate-900/80 px-2 py-1.5">
              {catChips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCatFilter(c.key)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors ${
                    activeCat === c.key ? 'bg-slate-200 text-slate-900' : 'bg-slate-800/70 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {c.label} <span className="opacity-70">{c.count}</span>
                </button>
              ))}
            </nav>
          )}
        </>
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
