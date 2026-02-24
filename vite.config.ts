import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WeldTrack',
        short_name: 'WeldTrack',
        description: 'Приложение для учета работы сварщиков',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            // Убрал purpose: 'any maskable' — оставь, только если иконки реально maskable
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Простая конфигурация как в рабочем проекте
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      // Помогает отлаживать PWA локально
      devOptions: {
        enabled: true,
      },
    }),
  ],
});