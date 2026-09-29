import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The admin dashboard (and its chart library) is lazy-loaded in App.tsx, so
// chairmen on mobile data only download the small form bundle.
//
// Browser floor: Android 7+ phones (Chrome 99+, which they still receive) and iPhone 6s+
// (Safari 15.4+). Tailwind's styles need cascade layers, which begin at those versions,
// so the JavaScript is compiled down to the same floor.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: ['chrome99', 'edge99', 'firefox97', 'safari15.4', 'ios15.4'] },
  server: { port: 5173 },
});
