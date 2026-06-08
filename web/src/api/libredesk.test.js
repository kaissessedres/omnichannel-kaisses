import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  getAuth, saveAuth, clearAuth,
  listConversations, listMessages, sendReply, resolveConversation,
} from './libredesk.js';

const AUTH = { url: 'https://ld.example', apiKey: 'secret', accountId: '9' };

// Mocka o fetch global devolvendo `body` com status `ok`. Retorna o vi.fn pra
// inspecionar a URL/opções da chamada.
function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('auth (localStorage)', () => {
  it('saveAuth → getAuth → clearAuth fazem o roundtrip', () => {
    expect(getAuth()).toBeNull();
    saveAuth(AUTH);
    expect(getAuth()).toEqual(AUTH);
    clearAuth();
    expect(getAuth()).toBeNull();
  });

  it('getAuth devolve null quando o localStorage tem JSON inválido', () => {
    localStorage.setItem('megachat.auth', 'isto-não-é-json');
    expect(getAuth()).toBeNull();
  });
});

describe('chamadas à API', () => {
  it('listConversations monta a URL da conta e envia o Bearer', async () => {
    saveAuth(AUTH);
    const fetchFn = mockFetch({ data: [] });
    const result = await listConversations('open');

    expect(result).toEqual({ data: [] });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://ld.example/api/v1/accounts/9/conversations?status=open');
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe('Bearer secret');
  });

  it('tira a barra final da base URL antes de montar o caminho', async () => {
    saveAuth({ ...AUTH, url: 'https://ld.example/' });
    const fetchFn = mockFetch({});
    await listMessages('c1');
    expect(fetchFn.mock.calls[0][0]).toBe('https://ld.example/api/v1/accounts/9/conversations/c1/messages');
  });

  it('sendReply faz POST com { content }', async () => {
    saveAuth(AUTH);
    const fetchFn = mockFetch({ id: 'm1' });
    await sendReply('c1', 'olá');

    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://ld.example/api/v1/accounts/9/conversations/c1/messages');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ content: 'olá' });
  });

  it('resolveConversation faz PATCH com { status: resolved }', async () => {
    saveAuth(AUTH);
    const fetchFn = mockFetch({});
    await resolveConversation('c1');

    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://ld.example/api/v1/accounts/9/conversations/c1');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ status: 'resolved' });
  });

  it('204 (sem corpo) devolve null', async () => {
    saveAuth(AUTH);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 204, json: async () => { throw new Error('sem corpo'); },
    }));
    expect(await resolveConversation('c1')).toBeNull();
  });

  it('lança "Não autenticado" (amigável) quando não há auth — não um TypeError críptico', () => {
    // Lançado de forma síncrona (antes de virar promise); o componente chama
    // com `await` dentro de try/catch, então o erro é capturado normalmente.
    expect(() => listConversations()).toThrow(/Não autenticado/);
  });

  it('lança quando a resposta não é ok', async () => {
    saveAuth(AUTH);
    mockFetch(null, { ok: false, status: 500 });
    await expect(listConversations()).rejects.toThrow(/500/);
  });
});
