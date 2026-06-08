import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ConversationList from './ConversationList.jsx';

afterEach(cleanup);

describe('ConversationList', () => {
  it('mostra estado vazio quando não há conversas', () => {
    render(<ConversationList conversations={[]} onOpen={() => {}} />);
    expect(screen.getByText(/nenhuma conversa aberta/i)).toBeTruthy();
  });

  it('renderiza itens com nome e badge do canal, e chama onOpen ao clicar', () => {
    const onOpen = vi.fn();
    const convs = [{ id: 1, contact: { name: 'Cliente A' }, channel: 'whatsapp', last_message: 'olá' }];
    render(<ConversationList conversations={convs} onOpen={onOpen} />);

    expect(screen.getByText('Cliente A')).toBeTruthy();
    expect(screen.getByText('WA')).toBeTruthy(); // ChannelBadge
    expect(screen.getByText('olá')).toBeTruthy();

    fireEvent.click(screen.getByText('Cliente A'));
    expect(onOpen).toHaveBeenCalledWith(convs[0]);
  });
});
