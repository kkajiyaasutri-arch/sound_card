import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/sound_card/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '絵カードコミュニケーション',
        short_name: '絵カード',
        description: '声に出して伝えたいカードを選んで、音声で読み上げるアプリです。',
        start_url: '/sound_card/',
        scope: '/sound_card/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#f8fafc',
        icons: [{
          src: 'icon.svg',
          sizes: '192x192 512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}'],
        navigateFallback: '/sound_card/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
