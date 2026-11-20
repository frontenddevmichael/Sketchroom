import { useCallback, useRef, useState } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { CanvasSurface, SCENE_FORMAT, parseScene, serializeScene } from '../canvas';
import type { CanvasApi } from '../canvas/api';
import { createShapeElements } from '../canvas/elements';
import { INK } from '../canvas/ink';
import { convertLegacyScene } from '../canvas/convert';
import { SAMPLE_LEGACY_RECORDS } from '../canvas/sample';
import { useTheme } from '../lib/useTheme';
import './canvas-harness.css';

/**
 * Dev-only harness for the canvas engine. It proves the parts the room will
 * depend on before the room is rebuilt on them: mounting Excalidraw on the
 * self-hosted asset path, reading a legacy tldraw blob through the converter,
 * drawing with our ink tokens, and persisting the new scene format.
 *
 * Reachable at /dev/canvas in development builds only.
 */
const STORAGE_KEY = 'sketchroom.canvas.harness.v1';

function sampleScene() {
  const { elements, skipped } = convertLegacyScene(SAMPLE_LEGACY_RECORDS);
  return { format: SCENE_FORMAT as typeof SCENE_FORMAT, elements, skipped };
}

export function CanvasScreen() {
  const { theme } = useTheme();
  const [reloadKey, setReloadKey] = useState(0);
  const [scene, setScene] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseScene(stored) : sampleScene();
    } catch {
      return sampleScene();
    }
  });
  const [count, setCount] = useState(scene.elements.length);
  const [savedAt, setSavedAt] = useState<string>('—');
  const apiRef = useRef<CanvasApi | null>(null);
  const saveTimer = useRef<number | null>(null);

  const onApiReady = useCallback((canvas: CanvasApi) => {
    apiRef.current = canvas;
  }, []);

  const onChange = useCallback((elements: readonly ExcalidrawElement[]) => {
    setCount(elements.length);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serializeScene(elements));
        setSavedAt(new Date().toLocaleTimeString());
      } catch {
        // Storage can be unavailable in private mode; the harness still draws.
      }
    }, 400);
  }, []);

  const addBlock = () => {
    const api = apiRef.current;
    if (!api) return;
    api.addElements(
      createShapeElements({
        kind: 'rectangle',
        x: 120,
        y: 120,
        width: 180,
        height: 90,
        label: 'New block',
        style: { stroke: INK.ink, fill: INK.fill1 },
      }),
    );
  };

  const fit = () => {
    apiRef.current?.zoomToFit();
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setScene(sampleScene());
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="sk-harness">
      <header className="sk-harness__bar">
        <div>
          <strong>Canvas engine</strong>
          <span className="sk-harness__meta">
            Excalidraw 0.18 (MIT) · {count} elements · saved {savedAt}
          </span>
        </div>
        <div className="sk-harness__actions">
          <button type="button" onClick={addBlock}>
            Insert block
          </button>
          <button type="button" onClick={fit}>
            Fit
          </button>
          <button type="button" onClick={reset}>
            Reset to converted sample
          </button>
        </div>
      </header>
      {Object.keys(scene.skipped).length > 0 && (
        <p className="sk-harness__note">
          Legacy shapes with no free-engine equivalent:{' '}
          {Object.entries(scene.skipped)
            .map(([type, n]) => `${type} × ${n}`)
            .join(', ')}
        </p>
      )}
      <div className="sk-harness__canvas">
        <CanvasSurface
          key={`${reloadKey}-${theme}`}
          scene={scene}
          theme={theme}
          onApiReady={onApiReady}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
