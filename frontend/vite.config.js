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
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Leaflet is deliberately NOT named here. Naming a chunk promotes it
          // into the initial graph, so map-vendor was preloaded on every page
          // even once the map itself was lazy. Left alone, the bundler puts it
          // in the map's own dynamic chunk, which is the point.
          if (id.includes('leaflet')) return undefined;
          if (id.includes('react-router')) return 'react-vendor';
          // Match the package directory, not any path containing "react", so
          // lucide-react and friends are not swept in here too.
          if (/node_modules[\/]react(-dom)?[\/]/.test(id)) return 'react-vendor';
          if (id.includes('lucide-react')) return 'ui-vendor';
          if (id.includes('@react-oauth')) return 'auth-vendor';
          return undefined;
        },
      },
    },
  },
})
