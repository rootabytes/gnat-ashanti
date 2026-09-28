import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The admin dashboard (and its chart library) is lazy-loaded in App.tsx, so
// chairmen on mobile data only download the small form bundle.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
