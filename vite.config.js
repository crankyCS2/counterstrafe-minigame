import { defineConfig } from 'vite';
export default defineConfig({
  base: '/counterstrafe-minigame/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'esnext'
  }
});
