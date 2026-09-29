import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Open the connection to the API while the JavaScript is still downloading.
 *
 * The first request goes out only once React has mounted and the auth context
 * has run, and it pays for DNS, TCP and TLS before it can even ask - a few
 * hundred milliseconds on a phone, spent in series with everything else. This
 * moves that handshake into the parse, so the request lands on a socket that
 * is already open.
 *
 * The origin is read from VITE_API_URL at build time rather than written here,
 * because it is set by the host, not the repo. No variable, no tag: a
 * preconnect to the wrong place would waste a connection rather than save one.
 */
function preconnectApi(mode) {
  const url = loadEnv(mode, process.cwd(), '').VITE_API_URL
  let origin = null
  try {
    origin = url ? new URL(url).origin : null
  } catch {
    origin = null   // a malformed value must not fail the build
  }
  return {
    name: 'preconnect-api',
    transformIndexHtml() {
      if (!origin || origin.startsWith('http://localhost')) return []
      return [
        { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head-prepend' },
        { tag: 'link', attrs: { rel: 'dns-prefetch', href: origin }, injectTo: 'head-prepend' },
      ]
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    preconnectApi(mode),
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
}))
