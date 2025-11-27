import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true
  },
  // For GitHub Pages deployment
  base: process.env.NODE_ENV === 'production' ? '/Video-Call-App/' : '/'
})

