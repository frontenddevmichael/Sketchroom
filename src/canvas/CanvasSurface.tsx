// Must evaluate before the editor package: Excalidraw reads its asset base
// (fonts, locales) from `window.EXCALIDRAW_ASSET_PATH` at module load.
import './assets';
import { useCallback, useEffect, useRef } from 'react';
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { SceneDocument } from './scene';
import { CanvasApi } from './api';
import { INK } from './ink';
import '@excalidraw/excalidraw/index.css';
import './canvas.css';

export interface CanvasSurfaceProps {
  /** Read once on mount. Remount with `key` to load a different room. */
  scene: SceneDocument;
  theme: 'light' | 'dark';
  readOnly?: boolean;
  onApiReady?: (api: CanvasApi) => void;
  onChange?: (elements: readonly ExcalidrawElement[]) => void;
  /** Scene-space pointer, for presence cursors. */
  onPointerUpdate?: (point: { x: number; y: number }, pointerDown: boolean) => void;
  /** First press on the canvas — the room retires onboarding on it. */
  onPointerDown?: () => void;
  className?: string;
}

/**
 * The room's canvas surface: Excalidraw (MIT) mounted with our scene document,
 * our theme, and the self-hosted asset path from `./assets`.
 *
 * Everything above this component talks to `CanvasApi`, never to tldraw and
 * never to a private deep import, so the rest of the room does not grow a
 * second engine dependency. The engine's own toolbar, menu, zoom cluster and
 * sidebar are hidden here: the room ships that chrome itself, and two toolbars
 * in one product is not a design.
 */
export function CanvasSurface({
  scene,
  theme,
  readOnly = false,
  onApiReady,
  onChange,
  onPointerUpdate,
  onPointerDown,
  className,
}: CanvasSurfaceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<CanvasApi | null>(null);

  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      const host = rootRef.current;
      if (!host) return;
      const wrapper = new CanvasApi(api, host);
      wrapperRef.current = wrapper;
      onApiReady?.(wrapper);
    },
    [onApiReady],
  );

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      wrapperRef.current?.handleChange(elements);
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

  const handlePointerDown = useCallback(() => {
    onPointerDown?.();
  }, [onPointerDown]);

  useEffect(() => {
    return () => {
      wrapperRef.current?.destroy();
      wrapperRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`sk-canvas sk-canvas--${theme}${className ? ` ${className}` : ''}`}
    >
      <Excalidraw
        initialData={{
          elements: scene.elements,
          appState: {
            viewBackgroundColor: theme === 'dark' ? INK.ink : INK.paper,
            theme,
            gridSize: 20,
            currentItemStrokeColor: INK.ink,
            currentItemBackgroundColor: 'transparent',
            currentItemFillStyle: 'solid',
            currentItemStrokeWidth: 1.25,
            currentItemRoughness: 0,
            currentItemFontFamily: 9,
          },
          scrollToContent: true,
        }}
        theme={theme}
        langCode="en"
        viewModeEnabled={readOnly}
        gridModeEnabled={false}
        excalidrawAPI={handleApi}
        onChange={handleChange}
        onPointerUpdate={handlePointer}
        onPointerDown={handlePointerDown}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: false,
            clearCanvas: false,
            changeViewBackgroundColor: false,
            toggleTheme: false,
          },
          welcomeScreen: false,
        }}
        autoFocus={false}
      />
    </div>
  );
}

/** Exposed so the room can bump the scene version when it swaps documents. */
export { CaptureUpdateAction };
