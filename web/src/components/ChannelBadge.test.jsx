import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ChannelBadge from './ChannelBadge.jsx';

afterEach(cleanup);

describe('ChannelBadge', () => {
  it('mostra a sigla do canal conhecido', () => {
    render(<ChannelBadge channel="whatsapp" />);
    expect(screen.getByText('WA')).toBeTruthy();
  });

  it('mapeia cada canal para sua sigla', () => {
    for (const [channel, label] of [['instagram', 'IG'], ['mercadolivre', 'ML'], ['shopee', 'SH']]) {
      cleanup();
      render(<ChannelBadge channel={channel} />);
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('cai para ?? em canal desconhecido ou ausente', () => {
    render(<ChannelBadge channel="telegram" />);
    expect(screen.getByText('??')).toBeTruthy();
    cleanup();
    render(<ChannelBadge />);
    expect(screen.getByText('??')).toBeTruthy();
  });
});
