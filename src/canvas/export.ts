/**
 * Export is the engine's own renderer, driven by our scene and paper colour.
 * These wrappers keep the three call sites (thumbnail capture, the export
 * dialog, version history) on one set of options, and keep the monochrome
 * background guaranteed: an export is always the paper, never a screenshot of
 * whatever the viewer's theme happens to be.
 */
import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { CanvasApi } from './api';
import { INK } from './ink';

function picked(api: CanvasApi, ids?: readonly string[]): ExcalidrawElement[] {
  const elements = api.elements.filter((element) => !element.isDeleted);
  if (!ids || ids.length === 0) return elements;
  const set = new Set(ids);
  return elements.filter((element) => set.has(element.id));
}

function exportState(api: CanvasApi) {
  return {
    ...api.appState,
    exportBackground: true,
    viewBackgroundColor: INK.paper,
    exportWithDarkMode: false,
    theme: 'light' as const,
  };
}

export interface SceneImageOptions {
  ids?: readonly string[];
  maxWidthOrHeight?: number;
  padding?: number;
}

/** PNG bytes for the current scene (or a selection of it). */
export async function scenePng(api: CanvasApi, options: SceneImageOptions = {}): Promise<Blob> {
  const elements = picked(api, options.ids);
  if (elements.length === 0) throw new Error('Nothing to export');
  return exportToBlob({
    elements,
    appState: exportState(api),
    files: api.files,
    mimeType: 'image/png',
    quality: 1,
    exportPadding: options.padding ?? 24,
    maxWidthOrHeight: options.maxWidthOrHeight,
  });
}

/** Clean, standalone SVG markup for the current scene (or a selection). */
export async function sceneSvg(api: CanvasApi, options: SceneImageOptions = {}): Promise<string> {
  const elements = picked(api, options.ids);
  if (elements.length === 0) throw new Error('Nothing to export');
  const svg = await exportToSvg({
    elements,
    appState: exportState(api),
    files: api.files,
    exportPadding: options.padding ?? 24,
    skipInliningFonts: true,
  });
  // Serialising the engine's own node drops its React wrappers and leaves a
  // file Figma and Illustrator both open without a stray attribute map.
  const xml = new XMLSerializer().serializeToString(svg);
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

/** A small JPEG data URL for the room card and the loading blur-up. */
export async function sceneThumbnail(api: CanvasApi): Promise<string | null> {
  const elements = api.elements.filter((element) => !element.isDeleted);
  if (elements.length === 0) return null;
  const blob = await exportToBlob({
    elements,
    appState: exportState(api),
    files: api.files,
    mimeType: 'image/jpeg',
    quality: 0.6,
    exportPadding: 16,
    maxWidthOrHeight: 512,
  });
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the rendered image'));
    reader.readAsDataURL(blob);
  });
}
