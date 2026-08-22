import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import path from 'path'

// ── WordAPA7 Add-in — Vite config ───────────────────────────────────
// Office Add-ins REQUIEREN HTTPS (incluso en localhost) para que Word
// confíe en el dominio.  vite-plugin-mkcert genera automáticamente un
// certificado de desarrollo de confianza.
// El servidor escucha en el puerto 3000 (coincide con manifest.xml).
//
// ⚠️ base: './' — CRÍTICO: los assets deben usar paths RELATIVOS porque
// el backend sirve el add-in bajo /addin/ (no en la raíz /).  Sin esto,
// Vite genera <script src="/taskpane.js"> que se resuelve a la raíz del
// servidor y el panel queda en blanco dentro de Word.
export default defineConfig({
  base: './',
  plugins: [react(), mkcert()],
  server: {
    port: 3000,
    https: true,
    strictPort: true,
    headers: {
      // Permite que Office cargue el panel en un iframe
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'default-src \'self\' https://localhost:3000 https://127.0.0.1:8742 http://127.0.0.1:8742 http://localhost:8742 https://localhost:8742; img-src \'self\' data: https:; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://localhost:3000 https://appsforoffice.microsoft.com;',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        taskpane: path.resolve(__dirname, 'taskpane.html'),
        commands: path.resolve(__dirname, 'commands.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
