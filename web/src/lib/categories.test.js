import { describe, it, expect } from 'vitest';
import { categoryLabel, filterByCategory, categoryFilters } from './categories.js';

describe('categorias', () => {
  it('categoryLabel resolve a label (ou null)', () => {
    expect(categoryLabel('pedido_feito')).toBe('Pedido feito');
    expect(categoryLabel('inexistente')).toBeNull();
  });

  it('filterByCategory cobre all / unread / categoria', () => {
    const list = [
      { id: 1, category: 'pedido_feito', unread_count: 0 },
      { id: 2, category: 'orcamento', unread_count: 2 },
      { id: 3, unread_count: 0 },
    ];
    expect(filterByCategory(list, 'all')).toHaveLength(3);
    expect(filterByCategory(list, 'unread').map((c) => c.id)).toEqual([2]);
    expect(filterByCategory(list, 'pedido_feito').map((c) => c.id)).toEqual([1]);
  });

  it('categoryFilters monta Todas + Não lidas + categorias presentes (com contagem)', () => {
    const chips = categoryFilters([
      { id: 1, category: 'pedido_feito', unread_count: 0 },
      { id: 2, category: 'pedido_feito', unread_count: 1 },
      { id: 3, category: 'orcamento' },
    ]);
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c]));
    expect(chips[0].key).toBe('all');
    expect(byKey.all.count).toBe(3);
    expect(byKey.unread.count).toBe(1);
    expect(byKey.pedido_feito.count).toBe(2);
    expect(byKey.orcamento.count).toBe(1);
  });
});
