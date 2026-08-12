import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const stub = (name: string) => new URL(`./stubs/${name}`, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  resolve: {
    alias: [
      { find: 'convex/react', replacement: stub('convex-react.tsx') },
      { find: '@convex-dev/auth/react', replacement: stub('convex-auth-react.tsx') },
      // The generated api is `anyApi` (a Proxy producing a fresh object per
      // access) — unusable as a Map key. The stub uses stable string keys so
      // the harness can seed per-query results that the real components see.
      //
      // NOTE: this import is RELATIVE from src (`../../convex/_generated/api`),
      // so the alias plugin matches the raw specifier, not a resolved path.
      // The regex must span the WHOLE specifier (leading `../` and all) so
      // the `.replace(find, replacement)` leaves no relative prefix behind.
      { find: /^.*convex\/_generated\/api$/, replacement: stub('api.ts') },
    ],
  },
});
