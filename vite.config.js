import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configurado con base relativa './' para compatibilidad total con GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    open: false
  }
});
