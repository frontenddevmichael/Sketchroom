import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PaintBucket,
  Copy,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import type { CanvasApi } from '../canvas/api';
import { INK, OBJECT_COLORS, fillForWeight } from '../canvas/ink';
import { FONT_FAMILY_ID, boundTextOf } from '../canvas/elements';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import './ToolOptions.css';

export type ToolStyleMode = 'selection' | 'next';

const TOOL_TITLES: Record<string, string> = {
  select: 'Select',
  draw: 'Draw',
  sticky: 'Sticky note',
  text: 'Text',
  connector: 'Connector',
  shapes: 'Shapes',
};

const DEFAULTS_KEY = 'sketchroom.toolDefaults.v2.';

/**
 * Objects on the board carry their own colour: that is the user's content, and
 * a diagram is easier to read in colour. The ink ramp is only for text, which
 * stays monochrome along with the rest of the interface.
 */
const OBJECT_SWATCHES = OBJECT_COLORS;

/** Text ink: a step of the ramp, never a hue. */
const TEXT_INKS: { value: string; label: string }[] = [
  { value: INK.ink, label: 'Ink' },
  { value: INK.ink2, label: 'Ink 2' },
  { value: INK.ink3, label: 'Ink 3' },
  { value: INK.ink4, label: 'Ink 4' },
];

/** Fill is a weight of wash over the object's own colour, not a separate palette. */
const FILLS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'wash', label: 'Wash' },
  { value: 'tint', label: 'Tint' },
  { value: 'solid', label: 'Solid' },
];

const DASHES: { value: string; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const SIZES: { value: string; label: string }[] = [
  { value: '1', label: 'S' },
  { value: '1.25', label: 'M' },
  { value: '2', label: 'L' },
  { value: '3', label: 'XL' },
];

const FONT_SIZES: { value: string; label: string }[] = [
  { value: '12', label: 'S' },
  { value: '16', label: 'M' },
  { value: '24', label: 'L' },
  { value: '36', label: 'XL' },
];

const FONTS: { value: string; label: string }[] = [
  { value: String(FONT_FAMILY_ID.hand), label: 'Hand' },
  { value: String(FONT_FAMILY_ID.sans), label: 'Sans' },
  { value: String(FONT_FAMILY_ID.mono), label: 'Mono' },
  { value: String(FONT_FAMILY_ID.liberation), label: 'Board' },
];

const ALIGN_H: { value: string; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenterHorizontal },
  { value: 'right', label: 'Align right', icon: AlignRight },
];

const GEO_OPTIONS: { value: string; label: string }[] = [
  { value: 'rectangle', label: 'Rect' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'diamond', label: 'Diamond' },
];

const ARROWHEADS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'bar', label: 'Bar' },
  { value: 'dot', label: 'Dot' },
  { value: 'triangle', label: 'Triangle' },
];

const ALIGN_OPS_H: { value: 'left' | 'center-horizontal' | 'right'; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center-horizontal', label: 'Align center', icon: AlignCenterHorizontal },
  { value: 'right', label: 'Align right', icon: AlignRight },
];

const ALIGN_OPS_V: { value: 'top' | 'center-vertical' | 'bottom'; label: string; icon: typeof AlignStartVertical }[] = [
  { value: 'top', label: 'Align top', icon: AlignStartVertical },
  { value: 'center-vertical', label: 'Align middle', icon: AlignCenterVertical },
  { value: 'bottom', label: 'Align bottom', icon: AlignEndVertical },
];

type StyleKey =
  | 'stroke'
  | 'textInk'
  | 'fill'
  | 'strokeWidth'
  | 'strokeStyle'
  | 'fontFamily'
  | 'fontSize'
  | 'textAlign'
  | 'roundness'
  | 'startArrowhead'
  | 'endArrowhead';

/** Which element types a key can actually be written to. */
function applies(key: StyleKey, element: ExcalidrawElement): boolean {
  switch (key) {
    case 'stroke':
      // A hue never lands on text: text is ink-only.
      return element.type !== 'text';
    case 'textInk':
      return element.type === 'text';
    case 'fontFamily':
    case 'fontSize':
    case 'textAlign':
      return element.type === 'text';
    case 'roundness':
      return element.type === 'rectangle';
    case 'startArrowhead':
    case 'endArrowhead':
    case 'strokeStyle':
      return element.type === 'arrow' || element.type === 'line';
    default:
      return true;
  }
}

function patchFor(
  key: StyleKey,
  value: string,
  element?: ExcalidrawElement,
): Record<string, unknown> {
  switch (key) {
    case 'stroke':
    case 'textInk':
      return { strokeColor: value };
    case 'fill':
      return {
        backgroundColor: fillForWeight(
          value as 'none' | 'wash' | 'tint' | 'solid',
          element?.strokeColor ?? INK.ink,
        ),
      };
    case 'strokeWidth':
      return { strokeWidth: Number(value) };
    case 'strokeStyle':
      return { strokeStyle: value };
    case 'fontFamily':
      return { fontFamily: Number(value) };
    case 'fontSize':
      return { fontSize: Number(value) };
    case 'textAlign':
      return { textAlign: value };
    case 'roundness':
      return { roundness: value === 'round' ? { type: 3, value: 8 } : null };
    case 'startArrowhead':
      return { startArrowhead: value === 'none' ? null : value };
    case 'endArrowhead':
      return { endArrowhead: value === 'none' ? null : value };
    default:
      return {};
  }
}

function defaultsFor(key: StyleKey, value: string): Record<string, unknown> {
  switch (key) {
    case 'stroke':
    case 'textInk':
      return { currentItemStrokeColor: value };
    case 'fill':
      return { currentItemBackgroundColor: value };
    case 'strokeWidth':
      return { currentItemStrokeWidth: Number(value) };
    case 'strokeStyle':
      return { currentItemStrokeStyle: value };
    case 'fontFamily':
      return { currentItemFontFamily: Number(value) };
    case 'fontSize':
      return { currentItemFontSize: Number(value) };
    case 'textAlign':
      return { currentItemTextAlign: value };
    case 'roundness':
      return { currentItemRoundness: value };
    case 'startArrowhead':
      return { currentItemArrowType: 'sharp' };
    case 'endArrowhead':
      return { currentItemArrowType: 'round' };
    default:
      return {};
  }
}

/** Which app-state field each key arms for the next stroke. */
const NEXT_KEY: Record<StyleKey, string> = {
  stroke: 'currentItemStrokeColor',
  textInk: 'currentItemStrokeColor',
  fill: 'currentItemFillWeight',
  strokeWidth: 'currentItemStrokeWidth',
  strokeStyle: 'currentItemStrokeStyle',
  fontFamily: 'currentItemFontFamily',
  fontSize: 'currentItemFontSize',
  textAlign: 'currentItemTextAlign',
  roundness: 'currentItemRoundness',
  startArrowhead: 'currentItemArrowType',
  endArrowhead: 'currentItemArrowType',
};

/** A background colour read back as one of the four fill weights. */
function weightOf(background: string, stroke: string): string {
  if (!background || background === 'transparent') return 'none';
  for (const weight of ['wash', 'tint', 'solid'] as const) {
    if (sameColor(background, fillForWeight(weight, stroke))) return weight;
  }
  return 'solid';
}

function loadDefaults(tool: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY + tool);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The engine normalises hex to lower case, so a swatch has to compare
 * case-insensitively or the colour you just picked looks unpicked.
 */
function sameColor(a: string | 'mixed', b: string): boolean {
  if (a === 'mixed') return false;
  return a.toLowerCase() === b.toLowerCase();
}

function shared<T>(values: readonly T[]): T | 'mixed' {
  const first = values[0];
  return values.every((value) => value === first) ? first : 'mixed';
}

// One shared style engine for the rail: reads the live selection (or the
// engine's next-shape defaults), writes back through the canvas API, and keeps
// per-tool defaults persisted so a pick survives a reload.
function useToolStyles(api: CanvasApi | null, tool: string, mode: ToolStyleMode) {
  const [, setTick] = useState(0);
  const copiedRef = useRef<{ props: Record<string, string>; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    return api.subscribe(() => setTick((t) => t + 1));
  }, [api]);

  // Re-apply this tool's persisted defaults whenever the tool changes.
  useEffect(() => {
    if (!api) return;
    const saved = loadDefaults(tool);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key === 'fill') {
        // Fill is stored as a weight and armed against this tool's stroke.
        Object.assign(patch, {
          currentItemBackgroundColor: fillForWeight(
            value as 'none' | 'wash' | 'tint' | 'solid',
            saved.stroke ?? INK.ink,
          ),
          currentItemFillWeight: value,
        });
        continue;
      }
      Object.assign(patch, defaultsFor(key as StyleKey, value));
    }
    if (Object.keys(patch).length > 0) api.setCurrentStyle(patch);
  }, [api, tool]);

  const selection = api?.selection ?? [];
  const selectedIdsKey = selection.map((element) => element.id).join(',');
  const isSelectionMode = mode === 'selection' && selection.length > 0;
  const appState = api?.appState;

  const read = (key: StyleKey): string | 'mixed' => {
    if (!api) return 'mixed';
    if (key === 'fill') {
      if (isSelectionMode) {
        const values = selection
          .filter((element) => element.type !== 'text')
          .map((element) => weightOf(element.backgroundColor, element.strokeColor));
        return values.length === 0 ? 'mixed' : shared(values);
      }
      const armed = api.nextStyle.currentItemFillWeight;
      if (typeof armed === 'string') return armed;
      const stroke =
        (api.nextStyle.currentItemStrokeColor as string | undefined) ?? appState?.currentItemStrokeColor ?? INK.ink;
      return weightOf(appState?.currentItemBackgroundColor ?? 'transparent', stroke);
    }
    if (isSelectionMode) {
      const values = selection.filter((element) => applies(key, element)).map((element) => {
        switch (key) {
          case 'stroke':
          case 'textInk':
            return element.strokeColor;
          case 'strokeWidth':
            return String(element.strokeWidth);
          case 'strokeStyle':
            return element.strokeStyle;
          case 'fontFamily':
            return String((element as { fontFamily?: number }).fontFamily ?? FONT_FAMILY_ID.liberation);
          case 'fontSize':
            return String((element as { fontSize?: number }).fontSize ?? 16);
          case 'textAlign':
            return (element as { textAlign?: string }).textAlign ?? 'left';
          case 'roundness':
            return element.roundness ? 'round' : 'sharp';
          case 'startArrowhead':
            return (element as { startArrowhead?: string | null }).startArrowhead ?? 'none';
          case 'endArrowhead':
            return (element as { endArrowhead?: string | null }).endArrowhead ?? 'none';
          default:
            return '';
        }
      });
      if (values.length === 0) return 'mixed';
      return shared(values);
    }
    if (!appState) return 'mixed';
    // The rail prefers what it just armed: an app-state-only update is not
    // always reflected back by the engine (see CanvasApi.setCurrentStyle).
    const armed = api.nextStyle[NEXT_KEY[key]];
    if (armed !== undefined && armed !== null && armed !== '') return String(armed);
    switch (key) {
      case 'stroke':
      case 'textInk':
        return appState.currentItemStrokeColor;
      case 'strokeWidth':
        return String(appState.currentItemStrokeWidth);
      case 'strokeStyle':
        return appState.currentItemStrokeStyle;
      case 'fontFamily':
        return String(appState.currentItemFontFamily);
      case 'fontSize':
        return String(appState.currentItemFontSize);
      case 'textAlign':
        return appState.currentItemTextAlign;
      case 'roundness':
        return appState.currentItemRoundness;
      default:
        return 'none';
    }
  };

  const saveDefault = useCallback(
    (key: StyleKey, value: string) => {
      const saved = loadDefaults(tool);
      saved[key] = value;
      try {
        localStorage.setItem(DEFAULTS_KEY + tool, JSON.stringify(saved));
      } catch {
        // ignore
      }
    },
    [tool],
  );

  const apply = useCallback(
    (key: StyleKey, value: string) => {
      if (!api) return;
      if (isSelectionMode) {
        // Read the live selection: this callback must not close over a render's
        // snapshot of it, or a fast drag can style the previous shape.
        const current = api.selection;
        // Text styles on a labelled shape must reach the label too.
        const ids = new Set(current.filter((element) => applies(key, element)).map((el) => el.id));
        if (key === 'fontFamily' || key === 'fontSize' || key === 'textAlign') {
          for (const element of current) {
            for (const text of boundTextOf(api.elements, element)) {
              ids.add(text.id);
              api.updateElements([text.id], (el) => patchFor(key, value, el));
            }
          }
        }
        api.updateElements([...ids], (element) =>
          applies(key, element) ? patchFor(key, value, element) : null,
        );
      } else {
        if (key === 'fill') {
          const stroke =
            (api.nextStyle.currentItemStrokeColor as string | undefined) ??
            api.appState.currentItemStrokeColor ??
            INK.ink;
          api.setCurrentStyle({
            currentItemBackgroundColor: fillForWeight(
              value as 'none' | 'wash' | 'tint' | 'solid',
              stroke,
            ),
            currentItemFillWeight: value,
          });
        } else {
          api.setCurrentStyle(defaultsFor(key, value));
        }
        saveDefault(key, value);
        if (key === 'stroke' || key === 'fill' || key === 'textInk') {
          // A colour or fill pick arms the tool for the next stroke; the engine
          // reads these as the current item, so no extra bookkeeping is needed.
        }
      }
    },
    [api, isSelectionMode, saveDefault],
  );

  const copyStyles = () => {
    if (!api || selection.length === 0) return;
    const source = selection[0];
    copiedRef.current = {
      props: {
        stroke: source.strokeColor,
        fill: source.backgroundColor,
        strokeWidth: String(source.strokeWidth),
        strokeStyle: source.strokeStyle,
      },
      key: selectedIdsKey,
    };
    setCopiedKey(selectedIdsKey);
  };

  const applyCopied = () => {
    if (!api || !copiedRef.current || selection.length === 0) return;
    const props = copiedRef.current.props;
    api.updateElements(
      selection.map((element) => element.id),
      () => ({
        strokeColor: props.stroke,
        backgroundColor: props.fill,
        strokeWidth: Number(props.strokeWidth),
        strokeStyle: props.strokeStyle,
      }),
    );
  };

  const resetStyles = () => {
    if (!api) return;
    api.setCurrentStyle({
      currentItemStrokeColor: INK.ink,
      currentItemBackgroundColor: 'transparent',
      currentItemStrokeWidth: 1.25,
      currentItemStrokeStyle: 'solid',
      currentItemFontFamily: FONT_FAMILY_ID.liberation,
      currentItemFontSize: 16,
      currentItemTextAlign: 'left',
      currentItemRoundness: 'sharp',
    });
    try {
      localStorage.removeItem(DEFAULTS_KEY + tool);
    } catch {
      // ignore
    }
  };

  return {
    selection,
    selectedIdsKey,
    isSelectionMode,
    hasSelection: selection.length > 0,
    selectionCount: selection.length,
    stroke: read('stroke'),
    textInk: read('textInk'),
    fill: read('fill'),
    strokeWidth: read('strokeWidth'),
    strokeStyle: read('strokeStyle'),
    fontFamily: read('fontFamily'),
    fontSize: read('fontSize'),
    textAlign: read('textAlign'),
    roundness: read('roundness'),
    startArrowhead: read('startArrowhead'),
    endArrowhead: read('endArrowhead'),
    apply,
    copyStyles,
    applyCopied,
    resetStyles,
    copiedKey,
  };
}

interface ToolOptionsRailProps {
  api: CanvasApi | null;
  tool: string;
  mode: ToolStyleMode;
  onModeChange: (mode: ToolStyleMode) => void;
}

// The right tool rail: the full per-tool options as a vertical dock — paint
// format, ink, fill, dash, size, shape, type, arrange.
export function ToolOptionsRail({ api, tool, mode, onModeChange }: ToolOptionsRailProps) {
  const s = useToolStyles(api, tool, mode);
  const ids = s.selection.map((element) => element.id);
  const [pickedFill, setPickedFill] = useState<string | null>(null);

  /** The object palette: full colour for shapes, blocks and strokes. */
  const renderColourRow = (label: string) => (
    <Section label={label}>
      <div className="tool-options-color-row" role="group" aria-label={label}>
        {OBJECT_SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            className={`tool-options-color ${sameColor(s.stroke, swatch.value) ? 'active' : ''}`}
            style={{ background: swatch.value }}
            title={swatch.name}
            aria-label={`${label}: ${swatch.name}`}
            onClick={() => s.apply('stroke', swatch.value)}
          />
        ))}
      </div>
    </Section>
  );

  /** Text ink: the monochrome ramp, applied to text elements only. */
  const renderTextInkRow = (label: string) => (
    <Section label={label}>
      <div className="tool-options-color-row" role="group" aria-label={label}>
        {TEXT_INKS.map((ink) => (
          <button
            key={ink.value}
            className={`tool-options-color ${sameColor(s.textInk, ink.value) ? 'active' : ''}`}
            style={{ background: ink.value }}
            title={ink.label}
            aria-label={`${label}: ${ink.label}`}
            onClick={() => s.apply('textInk', ink.value)}
          />
        ))}
      </div>
    </Section>
  );

  /**
   * Fill is the weight itself. While arming (no selection) the rail remembers
   * the pick locally: the engine's background colour is not guaranteed to read
   * back after an app-state-only update, and a pill that forgets your choice is
   * worse than one that trusts the last pick.
   */
  const fillActive = (weight: string) =>
    s.isSelectionMode ? s.fill === weight : (pickedFill ?? (s.fill === 'mixed' ? 'none' : s.fill)) === weight;

  const pickFill = (weight: string) => {
    setPickedFill(weight);
    s.apply('fill', weight);
  };

  return (
    <div
      className="tool-options-rail glass"
      role="dialog"
      aria-label={`${TOOL_TITLES[tool] ?? 'Tool'} options`}
    >
      <header className="tool-options-rail-header">
        <div className="tool-options-rail-title">
          <span>{TOOL_TITLES[tool] ?? 'Tool'}</span>
          {tool === 'select' && s.hasSelection && (
            <span className="tool-options-count">{s.selectionCount}</span>
          )}
        </div>
        {tool !== 'select' && (
          <div className="tool-options-mode" role="group" aria-label="Apply styles to">
            <button
              className={`tool-options-mode-btn ${mode === 'selection' ? 'active' : ''}`}
              onClick={() => onModeChange('selection')}
              disabled={!s.hasSelection}
              title={s.hasSelection ? 'Apply to selected shapes' : 'Select shapes first'}
            >
              Selection
            </button>
            <button
              className={`tool-options-mode-btn ${mode === 'next' ? 'active' : ''}`}
              onClick={() => onModeChange('next')}
              title="Set defaults for new shapes"
            >
              New shapes
            </button>
          </div>
        )}
      </header>

      <div className="tool-options-rail-body no-scrollbar">
        {tool === 'select' && s.hasSelection && (
          <>
            <Section label="Paint format">
              <div className="tool-options-row">
                <button
                  className="tool-options-paint-btn"
                  onClick={s.copyStyles}
                  title="Copy styles from the first selected shape"
                >
                  <Copy size={14} />
                  Copy
                </button>
                <button
                  className="tool-options-paint-btn"
                  onClick={s.applyCopied}
                  disabled={!s.copiedKey || s.copiedKey === s.selectedIdsKey}
                  title="Apply copied styles to the selection"
                >
                  <PaintBucket size={14} />
                  Apply
                </button>
              </div>
            </Section>

            {renderColourRow('Colour')}
            <Section label="Fill">
              <Segmented
                options={FILLS.map((o) => ({ ...o, active: fillActive(o.value) }))}
                onPick={pickFill}
              />
            </Section>
            {renderTextInkRow('Text ink')}
            <Section label="Weight">
              <Segmented
                options={SIZES.map((o) => ({ ...o, active: s.strokeWidth === o.value }))}
                onPick={(v) => s.apply('strokeWidth', v)}
              />
            </Section>
            <Section label="Dash">
              <Segmented
                options={DASHES.map((o) => ({ ...o, active: s.strokeStyle === o.value }))}
                onPick={(v) => s.apply('strokeStyle', v)}
              />
            </Section>

            <section className="tool-options-section">
              <h3 className="tool-options-section-title">Arrange</h3>
              <span className="tool-options-sub-label">Align</span>
              <div className="tool-options-icon-grid">
                {ALIGN_OPS_H.map((a) => {
                  const Icon = a.icon;
                  return (
                    <IconBtn
                      key={`h-${a.value}`}
                      title={a.label}
                      onClick={() => api?.align(ids, a.value)}
                      disabled={ids.length < 2}
                    >
                      <Icon size={15} />
                    </IconBtn>
                  );
                })}
                {ALIGN_OPS_V.map((a) => {
                  const Icon = a.icon;
                  return (
                    <IconBtn
                      key={`v-${a.value}`}
                      title={a.label}
                      onClick={() => api?.align(ids, a.value)}
                      disabled={ids.length < 2}
                    >
                      <Icon size={15} />
                    </IconBtn>
                  );
                })}
              </div>
              <span className="tool-options-sub-label">Distribute</span>
              <div className="tool-options-icon-grid">
                <IconBtn
                  title="Distribute horizontally"
                  onClick={() => api?.distribute(ids, 'horizontal')}
                  disabled={ids.length < 3}
                >
                  <AlignHorizontalDistributeCenter size={15} />
                </IconBtn>
                <IconBtn
                  title="Distribute vertically"
                  onClick={() => api?.distribute(ids, 'vertical')}
                  disabled={ids.length < 3}
                >
                  <AlignVerticalDistributeCenter size={15} />
                </IconBtn>
              </div>
              <span className="tool-options-sub-label">Order</span>
              <div className="tool-options-icon-grid">
                <IconBtn title="Bring to front" onClick={() => api?.order(ids, 'front')}>
                  <BringToFront size={15} />
                </IconBtn>
                <IconBtn title="Bring forward" onClick={() => api?.order(ids, 'forward')}>
                  <ArrowUp size={15} />
                </IconBtn>
                <IconBtn title="Send backward" onClick={() => api?.order(ids, 'backward')}>
                  <ArrowDown size={15} />
                </IconBtn>
                <IconBtn title="Send to back" onClick={() => api?.order(ids, 'back')}>
                  <SendToBack size={15} />
                </IconBtn>
              </div>
            </section>
          </>
        )}

        {tool === 'shapes' && (
          <>
            {renderColourRow('Colour')}
            <Section label="Fill">
              <Segmented
                options={FILLS.map((o) => ({ ...o, active: fillActive(o.value) }))}
                onPick={pickFill}
              />
            </Section>
            <Section label="Weight">
              <Segmented
                options={SIZES.map((o) => ({ ...o, active: s.strokeWidth === o.value }))}
                onPick={(v) => s.apply('strokeWidth', v)}
              />
            </Section>
            <Section label="Dash">
              <Segmented
                options={DASHES.map((o) => ({ ...o, active: s.strokeStyle === o.value }))}
                onPick={(v) => s.apply('strokeStyle', v)}
              />
            </Section>
            <Section label="Shape">
              <GridPicker
                options={GEO_OPTIONS}
                current={s.isSelectionMode ? 'mixed' : 'rectangle'}
                onPick={(value) => {
                  if (s.isSelectionMode) return;
                  api?.setShapeKind(value as 'rectangle' | 'ellipse' | 'diamond');
                }}
              />
              {s.isSelectionMode && (
                <p className="tool-options-hint">A drawn shape keeps its form.</p>
              )}
            </Section>
            <Section label="Corners">
              <Segmented
                options={[
                  { value: 'sharp', label: 'Sharp', active: s.roundness === 'sharp' },
                  { value: 'round', label: 'Round', active: s.roundness === 'round' },
                ]}
                onPick={(v) => s.apply('roundness', v)}
              />
            </Section>
          </>
        )}

        {tool === 'draw' && (
          <>
            {renderColourRow('Colour')}
            <Section label="Weight">
              <Segmented
                options={SIZES.map((o) => ({ ...o, active: s.strokeWidth === o.value }))}
                onPick={(v) => s.apply('strokeWidth', v)}
              />
            </Section>
            <Section label="Dash">
              <Segmented
                options={DASHES.map((o) => ({ ...o, active: s.strokeStyle === o.value }))}
                onPick={(v) => s.apply('strokeStyle', v)}
              />
            </Section>
          </>
        )}

        {tool === 'sticky' && (
          <>
            {renderColourRow('Colour')}
            <Section label="Paper">
              <Segmented
                options={FILLS.map((o) => ({ ...o, active: fillActive(o.value) }))}
                onPick={pickFill}
              />
            </Section>
            {renderTextInkRow('Text ink')}
            <Section label="Type">
              <Segmented
                options={FONT_SIZES.map((o) => ({ ...o, active: s.fontSize === o.value }))}
                onPick={(v) => s.apply('fontSize', v)}
              />
            </Section>
            <Section label="Font">
              <Segmented
                options={FONTS.map((o) => ({ ...o, active: s.fontFamily === o.value }))}
                onPick={(v) => s.apply('fontFamily', v)}
              />
            </Section>
          </>
        )}

        {tool === 'text' && (
          <>
            {renderTextInkRow('Ink')}
            <Section label="Font">
              <Segmented
                options={FONTS.map((o) => ({ ...o, active: s.fontFamily === o.value }))}
                onPick={(v) => s.apply('fontFamily', v)}
              />
            </Section>
            <Section label="Type">
              <Segmented
                options={FONT_SIZES.map((o) => ({ ...o, active: s.fontSize === o.value }))}
                onPick={(v) => s.apply('fontSize', v)}
              />
            </Section>
            <Section label="Align">
              <Segmented
                options={ALIGN_H.map((o) => ({
                  value: o.value,
                  label: o.label.replace('Align ', ''),
                  active: s.textAlign === o.value,
                }))}
                onPick={(v) => s.apply('textAlign', v)}
              />
            </Section>
          </>
        )}

        {tool === 'connector' && (
          <>
            {renderColourRow('Colour')}
            <Section label="Weight">
              <Segmented
                options={SIZES.map((o) => ({ ...o, active: s.strokeWidth === o.value }))}
                onPick={(v) => s.apply('strokeWidth', v)}
              />
            </Section>
            <Section label="Dash">
              <Segmented
                options={DASHES.map((o) => ({ ...o, active: s.strokeStyle === o.value }))}
                onPick={(v) => s.apply('strokeStyle', v)}
              />
            </Section>
            <Section label="Start arrowhead">
              <GridPicker
                options={ARROWHEADS}
                current={s.startArrowhead}
                onPick={(v) => s.apply('startArrowhead', v)}
              />
            </Section>
            <Section label="End arrowhead">
              <GridPicker
                options={ARROWHEADS}
                current={s.endArrowhead}
                onPick={(v) => s.apply('endArrowhead', v)}
              />
            </Section>
          </>
        )}
      </div>

      {tool !== 'select' && (
        <footer className="tool-options-rail-footer">
          <button
            className="tool-options-reset"
            onClick={s.resetStyles}
            title="Reset these styles to defaults"
          >
            <RotateCcw size={12} />
            Reset styles
          </button>
        </footer>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="tool-options-section">
      <h3 className="tool-options-section-title">{label}</h3>
      {children}
    </section>
  );
}

function Segmented({
  options,
  onPick,
  disabled,
}: {
  options: { value: string; label: string; active?: boolean }[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tool-options-segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          className={`tool-options-seg-btn ${o.active ? 'active' : ''}`}
          onClick={() => onPick(o.value)}
          title={o.label}
          disabled={disabled}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GridPicker({
  options,
  current,
  onPick,
}: {
  options: { value: string; label: string }[];
  current: string | 'mixed';
  onPick: (value: string) => void;
}) {
  return (
    <div className="tool-options-grid">
      {options.map((o) => (
        <button
          key={o.value}
          className={`tool-options-grid-btn ${current === o.value ? 'active' : ''}`}
          onClick={() => onPick(o.value)}
          title={o.label}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  active,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`tool-options-icon-btn ${active ? 'active' : ''}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
