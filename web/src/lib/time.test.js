import { describe, it, expect } from 'vitest';
import { formatTime, formatRelative } from './time.js';

describe('formatTime', () => {
  it('formata como HH:MM', () => {
    expect(formatTime('2026-06-01T12:00:00Z')).toMatch(/^\d{2}:\d{2}$/);
  });
  it('devolve vazio para data inválida/ausente', () => {
    expect(formatTime('nada')).toBe('');
    expect(formatTime(undefined)).toBe('');
  });
});

describe('formatRelative', () => {
  // `now` injetado torna os ramos relativos independentes de fuso/relógio.
  const base = Date.parse('2026-06-08T12:00:00Z');
  const ago = (ms) => new Date(base - ms).toISOString();
  const MIN = 60_000, H = 60 * MIN, D = 24 * H;

  it('cobre agora / minutos / horas / ontem / dias', () => {
    expect(formatRelative(ago(10_000), base)).toBe('agora');
    expect(formatRelative(ago(5 * MIN), base)).toBe('5 min');
    expect(formatRelative(ago(2 * H), base)).toBe('2 h');
    expect(formatRelative(ago(1 * D), base)).toBe('ontem');
    expect(formatRelative(ago(3 * D), base)).toBe('3 d');
  });

  it('mais de uma semana vira data (dd/mm)', () => {
    expect(formatRelative(ago(10 * D), base)).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('devolve vazio para data inválida', () => {
    expect(formatRelative('nada', base)).toBe('');
  });
});
