import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    target: 'es2022', // cho phép await ở cấp cao nhất của module
  },
  server: {
    port: 5173,
    host: true, // cho máy khác trong mạng LAN (điện thoại) truy cập được
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/api': { target: 'http://localhost:3000' },
    },
  },
});
