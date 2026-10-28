import { productPages } from './vite.productPages.js';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), productPages()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Separate React runtime from storefront code without changing
            // route mount timing or introducing Suspense into existing tests.
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  server: {
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false, xfwd: true } },
  },
});
