import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { compression } from 'vite-plugin-compression2'

/**
 * SEO plugin. All of the site-URL-dependent bits (canonical, og:url, the
 * sitemap) come from VITE_SITE_URL so nothing ships with a placeholder
 * domain baked in:
 *   - VITE_SITE_URL set to a real https URL → canonical + og:url injected,
 *     robots.txt gets a sitemap line, sitemap.xml is emitted.
 *   - VITE_SITE_URL unset/placeholder → tags omitted, robots.txt still ships
 *     (allow all), no sitemap. Safe to build in any environment.
 */
function seoPlugin(): Plugin {
  const SITE_URL = (process.env.VITE_SITE_URL ?? '').trim()
  const valid = /^https:\/\/[a-z0-9.-]+$/i.test(SITE_URL)
  const base = valid ? SITE_URL.replace(/\/+$/, '') : null

  return {
    name: 'sketchroom-seo',
    transformIndexHtml(html) {
      if (!base) return html
      const url = base
      const tags = [
        { tag: 'link', attrs: { rel: 'canonical', href: `${url}/` } },
        { tag: 'meta', attrs: { property: 'og:url', content: `${url}/` } },
        { tag: 'meta', attrs: { name: 'twitter:url', content: `${url}/` } },
      ]
      return {
        html,
        tags,
      }
    },
    generateBundle() {
      // Plain allow-all robots; the sitemap line only when we know the domain.
      const robots = ['User-agent: *', 'Allow: /', ...(base ? [`Sitemap: ${base}/sitemap.xml`] : [])].join('\n') + '\n'
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      if (base) {
        const today = new Date().toISOString().slice(0, 10)
        const pages = ['', 'auth']
        const sitemap = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...pages.map(
            (p) =>
              `  <url><loc>${base}/${p}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${p === '' ? '1.0' : '0.8'}</priority></url>`,
          ),
          '</urlset>',
        ].join('\n')
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPlugin(), compression(), sentryVitePlugin({
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Only upload source maps in production
    disable: process.env.NODE_ENV !== 'production',
  })],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
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
