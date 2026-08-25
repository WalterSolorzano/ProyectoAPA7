/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    nodePolyfills(),
    electron([
      {
        // Main process entry file of the Electron App.
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          }
        }
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8742',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
    // word-addin es un sub-proyecto con su propio package.json, vitest.config.ts
    // y su propia copia de React. Ejecutar sus tests desde la raiz rompe por:
    //   1) nodePolyfills() shimmea `fs` (→ null) en el test de tipografias CSS, y
    //   2) dos copias de React (root vs word-addin) → "Invalid hook call".
    // Sus tests corren con `cd word-addin && npm test` (41 tests, 6 archivos).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/dist-electron-builder/**',
      'word-addin/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
  },
}) satisfies import('vite').UserConfig & { test: import('vitest/config').UserConfig['test'] };
