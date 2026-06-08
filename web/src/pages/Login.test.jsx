import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Login from './Login.jsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function fill(container, { url, key }) {
  fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: url } });
  fireEvent.change(container.querySelector('input[type=password]'), { target: { value: key } });
}

describe('Login', () => {
  it('mostra o título e os campos principais', () => {
    render(<Login onAuthed={() => {}} />);
    expect(screen.getByRole('heading', { name: 'KaiChat' })).toBeTruthy();
    expect(screen.getByPlaceholderText('https://...')).toBeTruthy();
  });

  it('URL sem http(s) mostra erro e não autentica', () => {
    const onAuthed = vi.fn();
    const { container } = render(<Login onAuthed={onAuthed} />);
    fill(container, { url: 'meu-libredesk.errado', key: 'k' });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/http/);
    expect(onAuthed).not.toHaveBeenCalled();
  });

  it('mostrar/ocultar revela a chave (password → text)', () => {
    const { container } = render(<Login onAuthed={() => {}} />);
    expect(container.querySelector('input[type=password]')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/mostrar chave/i));
    expect(container.querySelector('input[type=password]')).toBeNull();
  });

  it('credenciais válidas + conexão ok chamam onAuthed e salvam a auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    const onAuthed = vi.fn();
    const { container } = render(<Login onAuthed={onAuthed} />);
    fill(container, { url: 'https://ld.example', key: 'secret' });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(onAuthed).toHaveBeenCalledOnce());
    expect(JSON.parse(localStorage.getItem('kaichat.auth')).url).toBe('https://ld.example');
  });

  it('"Ver demonstração" entra sem conta e liga o modo demo', () => {
    const onAuthed = vi.fn();
    render(<Login onAuthed={onAuthed} />);
    fireEvent.click(screen.getByRole('button', { name: /ver demonstração/i }));
    expect(onAuthed).toHaveBeenCalledOnce();
    expect(localStorage.getItem('kaichat.demo')).toBe('1');
  });

  it('quando a conexão falha, mostra erro e oferece "Entrar mesmo assim"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const onAuthed = vi.fn();
    const { container } = render(<Login onAuthed={onAuthed} />);
    fill(container, { url: 'https://ld.example', key: 'errada' });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(onAuthed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /entrar mesmo assim/i }));
    expect(onAuthed).toHaveBeenCalledOnce();
  });
});
