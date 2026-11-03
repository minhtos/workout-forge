import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], globIgnores: ['og-image.svg'], navigateFallbackDenylist: [/^\/(robots\.txt|sitemap\.xml|llms\.txt)$/] },
      manifest: {
        name: 'Workout Forge',
        short_name: 'Workout Forge',
        description: 'Free workout planner and training log. Build 2-, 3- or 4-day programs in 4- to 12-week blocks, log sets offline and get your next targets. No account needed.',
        categories: ['fitness', 'health'],
        theme_color: '#16181b',
        background_color: '#16181b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
