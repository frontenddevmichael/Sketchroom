// Must evaluate before the editor package: Excalidraw reads its asset base
// (fonts, locales) from `window.EXCALIDRAW_ASSET_PATH` at module load.
import './assets';
import { useCallback, useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { SceneDocument } from './scene';
import { INK } from './ink';
import '@excalidraw/excalidraw/index.css';
import './canvas.css';

export interface CanvasSurfaceProps {
  /** Read once on mount. Remount with `key` to load a different room. */
  scene: SceneDocument;
  theme: 'light' | 'dark';
  readOnly?: boolean;
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
  onChange?: (elements: readonly ExcalidrawElement[]) => void;
  /** Scene-space pointer, for presence cursors. */
  onPointerUpdate?: (point: { x: number; y: number }, pointerDown: boolean) => void;
  className?: string;
}

/**
 * The room's canvas surface: Excalidraw (MIT) mounted with our scene document,
 * our theme, and the self-hosted asset path from `./assets`.
 *
 * Everything above this component talks to Excalidraw's imperative API, never
 * to tldraw and never to a private deep import, so the rest of the room does
 * not grow a second engine dependency.
 */
export function CanvasSurface({
  scene,
  theme,
  readOnly = false,
  onApiReady,
  onChange,
  onPointerUpdate,
  className,
}: CanvasSurfaceProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      onApiReady?.(api);
    },
    [onApiReady],
  );

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      onChange?.(elements);
    },
    [onChange],
  );

  const handlePointer = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) => {
      onPointerUpdate?.(payload.pointer, payload.button === 'down');
    },
    [onPointerUpdate],
  );

  useEffect(() => {
    return () => {
      apiRef.current = null;
    };
  }, []);

  return (
    <div className={`sk-canvas sk-canvas--${theme}${className ? ` ${className}` : ''}`}>
      <Excalidraw
        initialData={{
          elements: scene.elements,
          appState: {
            viewBackgroundColor: theme === 'dark' ? INK.ink : INK.paper,
            theme,
            currentItemStrokeColor: INK.ink,
            currentItemBackgroundColor: 'transparent',
            currentItemFillStyle: 'solid',
            currentItemStrokeWidth: 1.25,
            currentItemRoughness: 0,
          },
          scrollToContent: true,
        }}
        theme={theme}
        langCode="en"
        viewModeEnabled={readOnly}
        excalidrawAPI={handleApi}
        onChange={handleChange}
        onPointerUpdate={handlePointer}
      />
    </div>
  );
}
