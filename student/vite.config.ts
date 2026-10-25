import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Local development: the browser talks only to this dev server, which forwards
// /api to the backend (default http://127.0.0.1:3002). Same-origin requests avoid
// CORS, localhost/127.0.0.1 mix-ups and browsers (such as the VS Code built-in
// browser) that cannot reach a second port. Production does not use this.
const proxy = {
  '/api': {
    target: process.env.MEDIFY_API_TARGET || 'http://127.0.0.1:3002',
    changeOrigin: false,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {proxy},
  preview: {proxy},
});
