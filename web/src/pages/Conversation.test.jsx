import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import Conversation from './Conversation.jsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function auth() {
  localStorage.setItem('megachat.auth', JSON.stringify({ url: 'https://ld', apiKey: 'k', accountId: '1' }));
}

describe('Conversation', () => {
  it('mostra o nome do cliente e a ORIGEM (conta/canal) no header', async () => {
    auth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    const conversation = {
      id: 'c5',
      contact: { name: 'Bruna L.' },
      channel: 'mercadolivre',
      inbox: { id: 4, channel_type: 'mercadolivre', name: 'Mercado Livre 2' },
    };
    render(<Conversation conversation={conversation} onBack={() => {}} />);

    expect(screen.getByText('Bruna L.')).toBeTruthy();
    expect(screen.getByText('Mercado Livre 2')).toBeTruthy(); // de onde o cliente vem
    await waitFor(() => expect(screen.getByText(/nenhuma mensagem ainda/i)).toBeTruthy());
  });
});
