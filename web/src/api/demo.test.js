import { afterEach, describe, it, expect } from 'vitest';
import { isDemo, enableDemo, disableDemo } from './demo.js';
import { listConversations, listMessages, sendReply, markRead, setCategory } from './libredesk.js';

afterEach(() => localStorage.clear());

describe('modo demonstração', () => {
  it('isDemo/enable/disable controlam a flag no localStorage', () => {
    expect(isDemo()).toBe(false);
    enableDemo();
    expect(isDemo()).toBe(true);
    disableDemo();
    expect(isDemo()).toBe(false);
  });

  it('com demo ligado, o cliente devolve as conversas e mensagens de exemplo (sem fetch)', async () => {
    enableDemo();
    const convs = await listConversations('open');
    expect(convs.data.length).toBeGreaterThan(0);
    expect(convs.data[0]).toHaveProperty('contact');

    const msgs = await listMessages(convs.data[0].id);
    expect(Array.isArray(msgs.data)).toBe(true);
    expect(msgs.data.length).toBeGreaterThan(0);
  });

  it('markRead zera as não-lidas da conversa (visualizou)', async () => {
    enableDemo();
    await markRead('c1');
    const c1 = (await listConversations()).data.find((c) => c.id === 'c1');
    expect(c1.unread_count).toBe(0);
  });

  it('setCategory define a categoria da conversa', async () => {
    enableDemo();
    await setCategory('c3', 'resolvido');
    const c3 = (await listConversations()).data.find((c) => c.id === 'c3');
    expect(c3.category).toBe('resolvido');
  });

  it('sendReply em demo acrescenta a mensagem do lojista (outgoing) à conversa', async () => {
    enableDemo();
    const before = (await listMessages('c1')).data.length;
    await sendReply('c1', 'mensagem de teste do lojista');
    const after = await listMessages('c1');
    expect(after.data.length).toBe(before + 1);
    const last = after.data[after.data.length - 1];
    expect(last).toMatchObject({ message_type: 'outgoing', content: 'mensagem de teste do lojista' });
  });
});
