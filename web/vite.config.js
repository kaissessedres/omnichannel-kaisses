import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalável na homescreen — vite-plugin-pwa gera o manifest e o service
// worker (leitura offline das conversas já carregadas). Mobile-first: theme_color
// casa com a status bar do celular; display 'standalone' tira a barra do browser.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'KaiChat',
        short_name: 'KaiChat',
        description: 'Inbox omnichannel da loja — WhatsApp, Instagram, Mercado Livre e Shopee',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // ⚠️ TODO produção: gerar PNGs 192x192 e 512x512 (iOS na homescreen não
        // usa SVG). O SVG abaixo cobre o build e o Android; troque antes da Fase 11.
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
