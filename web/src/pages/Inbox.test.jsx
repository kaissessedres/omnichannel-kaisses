import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import Inbox from './Inbox.jsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function auth() {
  localStorage.setItem('megachat.auth', JSON.stringify({ url: 'https://ld', apiKey: 'k', accountId: '1' }));
}

describe('Inbox', () => {
  it('mostra spinner enquanto carrega e depois a lista', async () => {
    auth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: 1, contact: { name: 'Cliente A' }, channel: 'whatsapp' }] }),
    }));
    render(<Inbox onOpen={() => {}} onLogout={() => {}} />);

    expect(screen.getByText(/carregando conversas/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeTruthy());
  });

  it('mostra erro com "Tentar de novo" quando a carga falha', async () => {
    auth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<Inbox onOpen={() => {}} onLogout={() => {}} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeTruthy());
  });

  it('mostra estado vazio quando não há conversas', async () => {
    auth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    render(<Inbox onOpen={() => {}} onLogout={() => {}} />);

    await waitFor(() => expect(screen.getByText(/nenhuma conversa aberta/i)).toBeTruthy());
  });

  it('tem botão de alertas (sino) que alterna', async () => {
    auth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    render(<Inbox onOpen={() => {}} onLogout={() => {}} />);

    await waitFor(() => expect(screen.getByText(/nenhuma conversa aberta/i)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /desativar alertas/i }));
    expect(screen.getByRole('button', { name: /ativar alertas/i })).toBeTruthy();
  });

  it('mostra abas por conta e filtra a lista ao trocar de aba', async () => {
    auth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [
        { id: 1, channel: 'whatsapp', inbox: { id: 7, channel_type: 'whatsapp', name: 'WhatsApp' }, contact: { name: 'Cliente WA' } },
        { id: 2, channel: 'mercadolivre', inbox: { id: 3, channel_type: 'mercadolivre', name: 'Mercado Livre 1' }, contact: { name: 'Cliente ML' } },
      ] }),
    }));
    render(<Inbox onOpen={() => {}} onLogout={() => {}} />);

    // ambos aparecem na aba "Todos"
    await waitFor(() => expect(screen.getByText('Cliente WA')).toBeTruthy());
    expect(screen.getByText('Cliente ML')).toBeTruthy();

    // troca pra aba "Mercado Livre 1" → some o de WhatsApp
    fireEvent.click(screen.getByRole('button', { name: /Mercado Livre 1/ }));
    expect(screen.getByText('Cliente ML')).toBeTruthy();
    expect(screen.queryByText('Cliente WA')).toBeNull();
  });
});
