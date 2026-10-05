import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      manifest: {
        name: 'Workout Forge',
        short_name: 'Workout Forge',
        description: 'A focused, local-first workout planner and training log.',
        theme_color: '#16181b',
        background_color: '#16181b',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/workout-forge-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
