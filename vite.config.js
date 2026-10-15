import { productPages } from './vite.productPages.js';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), productPages()],
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false, xfwd: true } },
  },
});
