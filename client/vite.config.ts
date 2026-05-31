import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'write-version',
      apply: 'build',
      closeBundle() {
        writeFileSync(
          path.resolve(__dirname, 'dist/version.json'),
          JSON.stringify({ buildTime: Date.now() })
        );
      },
    },
  ],
  resolve: {
    alias: {
      '@program-timer/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
