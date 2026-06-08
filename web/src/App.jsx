import { useState } from 'react';
import { getAuth } from './api/libredesk.js';
import { isDemo } from './api/demo.js';
import Login from './pages/Login.jsx';
import Inbox from './pages/Inbox.jsx';
import Conversation from './pages/Conversation.jsx';

// Roteamento simples por estado (sem react-router — operação de 1 usuário, 3
// telas): login → inbox → conversa aberta. Mantém as dependências enxutas,
// no espírito de "fetch nativo, sem biblioteca extra" do projeto.
export default function App() {
  const [authed, setAuthed] = useState(() => !!getAuth() || isDemo());
  const [openConversation, setOpenConversation] = useState(null);

  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  if (openConversation) {
    return <Conversation conversation={openConversation} onBack={() => setOpenConversation(null)} />;
  }

  return <Inbox onOpen={setOpenConversation} onLogout={() => setAuthed(false)} />;
}
