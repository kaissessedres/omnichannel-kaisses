import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Config separada do vite.config.js (que carrega o plugin PWA, desnecessário
// nos testes). jsdom dá localStorage + DOM para testar o cliente da API e os
// componentes; o plugin do React transforma o JSX igual ao app.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
