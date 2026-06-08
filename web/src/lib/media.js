// Normaliza o anexo de uma mensagem para a UI. O formato real do Libredesk
// (nomes dos campos) deve ser confirmado quando o servidor subir — por isso os
// vários fallbacks. Puro e testável.

export function messageMedia(m) {
  const a = m?.attachments?.[0] || m?.attachment;
  if (!a) return null;
  const url = a.data_url || a.url || a.file_url || a.thumb_url;
  if (!url) return null;
  const raw = String(a.file_type || a.content_type || a.type || '').toLowerCase();
  return { type: raw.includes('video') ? 'video' : 'image', url, name: a.file_name || a.name || '' };
}

// 'image' | 'video' a partir do MIME do arquivo escolhido no picker.
export function fileKind(file) {
  return file?.type?.startsWith('video') ? 'video' : 'image';
}
