# Stack for the refactor (researched Nov 2026; versions to be pinned at install)

| Need | Choice | Why / note |
|---|---|---|
| Scroll + SVG animation | **gsap** (+ DrawSVG, MorphSVG, MotionPath, SplitText, Flip, ScrollTrigger) | Verified: all plugins free incl. commercial since Webflow's acquisition; one `npm i gsap`. DrawSVG is the core of the line-draw look. Official GSAP agent skills exist at github.com/greensock/gsap-skills; install them for the agent. |
| UI/React motion | keep **framer-motion** for layout/presence in product, GSAP only for illustration/scroll | Avoid two engines animating one element. |
| Smooth scroll | **lenis** (already installed) | Sync with ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)`. |
| Illustrations | in-repo isometric kit (`ILLUSTRATION-SYSTEM.md`) + optional **Recraft V4/V4.1 Vector** | Native SVG output, custom styles from reference images. Check current pricing before batch use. |
| SVG tooling | **svgo**, **vite-plugin-svgr** | Cleanup + import as components so layers are targetable. |
| Icons | **lucide-react** (installed) at `strokeWidth={1.5}` | Matches the monoline tiles in ref 2. Don't mix a second set. |
| Fonts | **@fontsource-variable/geist**, **@fontsource-variable/geist-mono** | Self-hosted, fixes the audit's undeclared-font bug and CSP. |
| Canvas theming | **tldraw** `assetUrls` (self-host via `@tldraw/assets`), custom `components`, CSS vars | Needed so canvas chrome matches the blueprint and CDN isn't required. Confirm exact helper names in the installed tldraw 5.x docs before coding. |
| Payments | **Paystack** (default) via Convex HTTP action webhook + signature check | NGN-native. Stripe is the alternative if USD-first. Ask the user before wiring. |
| Quality gates | **@axe-core/playwright**, Playwright visual snapshots, Lighthouse CI, **vite-bundle-visualizer** | Visual regression against the refs and a11y/perf budgets. |
| Real e2e | Playwright with two browser contexts against a Convex dev deployment | Proves multi-user sync, which current stub-based smoke tests cannot. |

Do not add: Three.js/R3F (3D look contradicts refs), Lottie for illustration (opaque, un-themeable), any component kit with its own theme (shadcn is fine only as unstyled primitives re-skinned to tokens; Radix tooltip/accordion already present).
