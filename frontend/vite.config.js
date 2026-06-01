import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor':     ['lucide-react', '@fortawesome/fontawesome-free'],
          'auth-vendor':   ['@react-oauth/google'],
          'map-vendor':    ['leaflet'],
        },
      },
    },
  },
})
