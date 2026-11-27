import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    // In development the API runs separately on PORT (default 3000).
    proxy: { '/api': 'http://localhost:3000', '/twilio': { target: 'http://localhost:3000', ws: true } },
  },
});
