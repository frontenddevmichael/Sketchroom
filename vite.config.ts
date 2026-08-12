import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split heavy, stable vendors into their own cacheable chunks. tldraw is
    // ~1.3 MB raw and only used by the room screen; without this the room
    // route chunk is ~2 MB and re-downloads on every deploy even when the app
    // code barely changed.
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/tldraw') || id.includes('node_modules/@tldraw')) {
            return 'tldraw'
          }
          if (id.includes('node_modules/convex') || id.includes('node_modules/@convex-dev')) {
            return 'convex'
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
            return 'motion'
          }
          if (id.includes('node_modules/gsap')) {
            return 'gsap'
          }
          if (
            id.includes('node_modules/html2canvas') ||
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/dompurify')
          ) {
            return 'export'
          }
        },
      },
    },
  },
})
