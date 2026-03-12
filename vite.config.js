import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.VITE_BASE || process.env.BASE_PATH || '/counterstrafe-minigame/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'esnext'
  }
});
