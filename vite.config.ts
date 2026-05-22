import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// HTTPS só é ativado quando VITE_HTTPS=true (script dev:mobile)
// O dev normal permanece HTTP para não quebrar o Electron
const useHttps = process.env.VITE_HTTPS === 'true';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isElectron = process.env.BUILD_TARGET === 'electron';
  return {
    plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
    base: isElectron ? './' : '/',
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['electron'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/dist-electron/**',
          '**/electron/**',
          '**/android/**',
          '**/arttburger-bot/**',
        ],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('lucide-react')) return 'icons';
              if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
