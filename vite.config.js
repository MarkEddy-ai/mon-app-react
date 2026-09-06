// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration optimisée pour bundler Vite + React
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // Ajuste le seuil d'avertissement de chunking
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});
