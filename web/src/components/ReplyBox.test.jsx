import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ReplyBox from './ReplyBox.jsx';

beforeEach(() => {
  // jsdom não implementa createObjectURL — stub para a prévia funcionar.
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ReplyBox', () => {
  it('envia texto simples chamando onSend(texto, undefined)', async () => {
    const onSend = vi.fn().mockResolvedValue();
    render(<ReplyBox onSend={onSend} />);
    fireEvent.change(screen.getByPlaceholderText('Responder…'), { target: { value: 'olá' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onSend.mock.calls[0][0]).toBe('olá');
  });

  it('anexa um arquivo, mostra a prévia e envia com o anexo', async () => {
    const onSend = vi.fn().mockResolvedValue();
    const { container } = render(<ReplyBox onSend={onSend} />);

    const input = container.querySelector('input[type=file]');
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    // prévia (imagem) aparece — busca o <img> real (os ícones Lucide são <svg>)
    expect(container.querySelector('img')).toBeTruthy();

    // envia mesmo sem texto, com o anexo
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    const [text, attachment] = onSend.mock.calls[0];
    expect(text).toBe('');
    expect(attachment).toMatchObject({ type: 'image', name: 'foto.png' });
  });

  it('remove o anexo ao clicar no X', async () => {
    render(<ReplyBox onSend={vi.fn()} />);
    const input = document.querySelector('input[type=file]');
    fireEvent.change(input, { target: { files: [new File(['x'], 'v.mp4', { type: 'video/mp4' })] } });
    expect(screen.getByText(/v\.mp4/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remover anexo/i }));
    expect(screen.queryByText(/v\.mp4/)).toBeNull();
  });
});
