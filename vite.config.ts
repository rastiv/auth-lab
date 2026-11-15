import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    // BETTER_AUTH_URL in .dev.vars points at this port; silently moving to
    // another one would make every auth request fail with "Invalid origin".
    port: 5173,
    strictPort: true,
  },
})
