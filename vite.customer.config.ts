import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function renameOutputHtml(): Plugin {
  return {
    name: 'rename-output-html',
    closeBundle() {
      const src = path.resolve('dist-cliente', 'index.customer.html');
      const dst = path.resolve('dist-cliente', 'index.html');
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), renameOutputHtml()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  optimizeDeps: {
    exclude: ['electron'],
  },
  build: {
    outDir: 'dist-cliente',
    rollupOptions: {
      input: 'index.customer.html',
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          }
        },
      },
    },
  },
});
