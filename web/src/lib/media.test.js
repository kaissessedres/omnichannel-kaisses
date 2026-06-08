import { describe, it, expect } from 'vitest';
import { messageMedia, fileKind } from './media.js';

describe('messageMedia', () => {
  it('devolve null quando não há anexo', () => {
    expect(messageMedia({ content: 'só texto' })).toBeNull();
    expect(messageMedia({ attachments: [] })).toBeNull();
  });

  it('reconhece imagem (vários nomes de campo)', () => {
    expect(messageMedia({ attachments: [{ file_type: 'image/png', data_url: 'x.png', file_name: 'foto.png' }] }))
      .toEqual({ type: 'image', url: 'x.png', name: 'foto.png' });
    expect(messageMedia({ attachment: { content_type: 'image/jpeg', url: 'y.jpg' } }))
      .toMatchObject({ type: 'image', url: 'y.jpg' });
  });

  it('reconhece vídeo', () => {
    expect(messageMedia({ attachments: [{ file_type: 'video/mp4', url: 'v.mp4' }] }))
      .toMatchObject({ type: 'video', url: 'v.mp4' });
  });
});

describe('fileKind', () => {
  it('classifica pelo MIME do arquivo', () => {
    expect(fileKind({ type: 'image/png' })).toBe('image');
    expect(fileKind({ type: 'video/mp4' })).toBe('video');
    expect(fileKind({})).toBe('image');
  });
});
