import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages hosts the site at https://<user>.github.io/<repo>/
  base: '/MP2025-26_Deimling-Harry_RC-model-s-ridicim-systemem/',
})
