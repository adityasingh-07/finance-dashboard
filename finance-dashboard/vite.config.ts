/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Unit tests live next to the code; e2e/ is Playwright's (npm run test:e2e).
  test: { include: ['src/**/*.test.ts'] },
  build: {
    rolldownOptions: {
      output: {
        // Third-party libraries change far less often than app code, so they
        // get their own long-cached chunks instead of one large main bundle.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'data', test: /node_modules[\\/](react-router|@tanstack|zod)[\\/]/ },
          ],
        },
      },
    },
  },
})
