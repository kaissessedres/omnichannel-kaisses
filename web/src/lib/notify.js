// Alertas de mensagem nova: detecção (pura) + som + notificação do navegador.
// As partes que tocam o ambiente (áudio/Notification) são defensivas — não
// quebram onde a API não existe (ex: jsdom nos testes).

// Conversas que ficaram com MAIS não-lidas (ou conversa nova já com não-lida)
// entre `prev` e `next`. Puro e testável — é o gatilho do ding/notificação.
export function newIncoming(prev, next) {
  const prevById = new Map((prev || []).map((c) => [c.id, c]));
  return (next || []).filter((c) => {
    const before = prevById.get(c.id);
    const now = c.unread_count || 0;
    if (!before) return now > 0;           // conversa nova com não-lida
    return now > (before.unread_count || 0); // não-lidas aumentaram
  });
}

// Um "ding" curto via Web Audio (sem precisar de arquivo de som).
export function playDing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close?.();
  } catch {
    /* sem áudio disponível */
  }
}

export function notificationsGranted() {
  try {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export function requestNotificationPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}

export function notify(title, body) {
  try {
    if (!notificationsGranted()) return;
    new Notification(title, { body, icon: '/icons/icon.svg' });
  } catch {
    /* ignore */
  }
}
