import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'frontend',
  base: '/admin/', // Matches mux.Handle("GET /admin/", ...) in Go
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'frontend/index.html'),
        chat: resolve(__dirname, 'frontend/chat.html'),
        login: resolve(__dirname, 'frontend/login.html'),
        landing: resolve(__dirname, 'frontend/landing.html'),
        docs: resolve(__dirname, 'frontend/docs.html'),
        dashboard: resolve(__dirname, 'frontend/dashboard.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('highlight.js')) {
              return 'highlight';
            }
            if (id.includes('marked')) {
              return 'marked';
            }
            if (id.includes('lucide')) {
              return 'lucide';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
