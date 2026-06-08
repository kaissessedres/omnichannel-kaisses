import { describe, it, expect } from 'vitest';
import { conversationGroup, accountTabs, filterByTab } from './inboxes.js';

const conv = (over) => ({ id: Math.random(), ...over });
const ml1 = { id: 3, channel_type: 'mercadolivre', name: 'Mercado Livre 1' };
const ml2 = { id: 4, channel_type: 'mercadolivre', name: 'Mercado Livre 2' };

describe('conversationGroup', () => {
  it('agrupa por conta/inbox quando há inbox (duas contas do mesmo canal são distintas)', () => {
    const a = conversationGroup(conv({ inbox: ml1 }));
    const b = conversationGroup(conv({ inbox: ml2 }));
    expect(a).toMatchObject({ key: 'inbox:3', label: 'Mercado Livre 1', channel: 'mercadolivre' });
    expect(b.key).toBe('inbox:4');
    expect(a.key).not.toBe(b.key); // ML 1 ≠ ML 2
  });

  it('cai para o canal quando não há inbox', () => {
    expect(conversationGroup(conv({ channel: 'whatsapp' }))).toMatchObject({ key: 'channel:whatsapp', label: 'WhatsApp' });
  });
});

describe('accountTabs', () => {
  it('monta "Todos" primeiro + uma aba por conta, com contagem', () => {
    const tabs = accountTabs([
      conv({ inbox: ml1 }), conv({ inbox: ml1 }), conv({ inbox: ml2 }), conv({ channel: 'whatsapp' }),
    ]);
    expect(tabs[0]).toMatchObject({ key: 'all', label: 'Todos', count: 4 });
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t]));
    expect(byKey['inbox:3'].count).toBe(2);
    expect(byKey['inbox:4'].count).toBe(1);
    expect(byKey['channel:whatsapp'].count).toBe(1);
  });
});

describe('filterByTab', () => {
  const list = [conv({ id: 1, inbox: ml1 }), conv({ id: 2, inbox: ml2 })];
  it('"all" devolve tudo; uma aba filtra pela conta', () => {
    expect(filterByTab(list, 'all')).toHaveLength(2);
    const only = filterByTab(list, 'inbox:4');
    expect(only).toHaveLength(1);
    expect(only[0].id).toBe(2);
  });
});
