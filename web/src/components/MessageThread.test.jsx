import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MessageThread from './MessageThread.jsx';

afterEach(cleanup);

describe('MessageThread', () => {
  it('mostra estado vazio sem mensagens', () => {
    render(<MessageThread messages={[]} />);
    expect(screen.getByText(/nenhuma mensagem ainda/i)).toBeTruthy();
  });

  it('renderiza as mensagens; outgoing alinha à direita (chat-end) e tem horário', () => {
    render(<MessageThread messages={[
      { id: 'm1', content: 'oi do cliente', message_type: 'incoming', created_at: '2026-06-01T12:00:00Z' },
      { id: 'm2', content: 'resposta da loja', message_type: 'outgoing', created_at: '2026-06-01T12:01:00Z' },
    ]} />);

    expect(screen.getByText('oi do cliente')).toBeTruthy();
    const bubble = screen.getByText('resposta da loja');
    expect(bubble.className).toMatch(/chat-bubble-primary/);
    const row = bubble.closest('.chat');
    expect(row.className).toMatch(/chat-end/);          // alinhada à direita
    expect(row.textContent).toMatch(/\d{2}:\d{2}/);     // horário (HH:MM)
  });
});
