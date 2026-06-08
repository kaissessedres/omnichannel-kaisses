import { describe, it, expect } from 'vitest';
import { newIncoming } from './notify.js';

describe('newIncoming', () => {
  it('detecta conversa nova que já chega com não-lida', () => {
    const prev = [{ id: 1, unread_count: 0 }];
    const next = [{ id: 1, unread_count: 0 }, { id: 2, unread_count: 1 }];
    const r = newIncoming(prev, next);
    expect(r.map((c) => c.id)).toEqual([2]);
  });

  it('detecta aumento de não-lidas numa conversa existente', () => {
    const prev = [{ id: 1, unread_count: 1 }];
    const next = [{ id: 1, unread_count: 3 }];
    expect(newIncoming(prev, next)).toHaveLength(1);
  });

  it('não dispara quando nada mudou (ou não-lidas diminuíram, ex: você leu)', () => {
    const prev = [{ id: 1, unread_count: 2 }];
    expect(newIncoming(prev, [{ id: 1, unread_count: 2 }])).toEqual([]);
    expect(newIncoming(prev, [{ id: 1, unread_count: 0 }])).toEqual([]);
  });

  it('lida com prev nulo (primeira carga) sem quebrar', () => {
    expect(newIncoming(null, [{ id: 1, unread_count: 1 }]).map((c) => c.id)).toEqual([1]);
  });
});
