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

// Um chime curtinho e agradável (duas notas ascendentes) via Web Audio —
// sem precisar de arquivo de som.
export function playDing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // A5 → D6: "ti-lim" suave
    for (const [freq, at] of [[880, 0], [1174.66, 0.12]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + at;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.start(start);
      osc.stop(start + 0.3);
    }
    setTimeout(() => ctx.close?.(), 700);
  } catch {
    /* sem áudio disponível */
  }
}

// Vibra no celular (Vibration API). Guardado — ignora onde não há suporte (iOS).
export function vibrate(pattern = [40, 30, 60]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
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
