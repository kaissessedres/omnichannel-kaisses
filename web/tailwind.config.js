import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [daisyui],
  // Tema próprio casando com a paleta que já usávamos (slate + indigo), pra os
  // componentes do daisyUI (btn, chat-bubble…) ficarem consistentes com o resto.
  daisyui: {
    logs: false,
    themes: [
      {
        kaichat: {
          primary: '#6366f1',          // indigo-500
          'primary-content': '#ffffff',
          secondary: '#475569',        // slate-600
          accent: '#6366f1',
          neutral: '#1e293b',          // slate-800
          'base-100': '#0f172a',       // slate-900
          'base-200': '#1e293b',       // slate-800
          'base-300': '#334155',       // slate-700
          'base-content': '#e2e8f0',   // slate-200
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',            // red-400
        },
      },
    ],
  },
};
