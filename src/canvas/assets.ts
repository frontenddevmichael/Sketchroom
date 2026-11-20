/**
 * Excalidraw loads its fonts, locales and assets from `EXCALIDRAW_ASSET_PATH`
 * at runtime. The default is a remote CDN, which the production CSP
 * (`font-src 'self'`, `default-src 'self'`) blocks. The fonts shipped in
 * `public/excalidraw/` are the package's own files, minus the 13 MB Xiaolai
 * CJK face; the room runs in English.
 */
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

if (typeof window !== 'undefined' && !window.EXCALIDRAW_ASSET_PATH) {
  window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';
}

export {};
