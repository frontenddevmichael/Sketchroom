import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Editor,
  type StyleProp,
  type TLDefaultColorStyle,
  type TLDefaultDashStyle,
  type TLDefaultFillStyle,
  type TLDefaultFontStyle,
  type TLDefaultSizeStyle,
  type TLRichText,
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  DefaultFontStyle,
  DefaultSizeStyle,
  DefaultTextAlignStyle,
  DefaultHorizontalAlignStyle,
  DefaultVerticalAlignStyle,
  GeoShapeGeoStyle,
  ArrowShapeArrowheadStartStyle,
  ArrowShapeArrowheadEndStyle,
} from 'tldraw';
import {
  PaintBucket,
  Copy,
  Focus,
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
  Bold,
  RotateCcw,
} from 'lucide-react';
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

const DEFAULTS_KEY = 'sketchroom.toolDefaults.v1.';
const RECENT_KEY = 'sketchroom.recentColors.v1';

const COLORS: TLDefaultColorStyle[] = [
  'black',
  'grey',
  'blue',
  'light-blue',
  'violet',
  'light-violet',
  'red',
  'light-red',
  'orange',
  'yellow',
  'green',
  'light-green',
  'white',
];

const COLOR_HEX: Record<TLDefaultColorStyle, string> = {
  black: '#1d1d1d',
  grey: '#9b9b9b',
  'light-violet': '#e3d9ff',
  violet: '#7b61ff',
  blue: '#3b82f6',
  'light-blue': '#c3e2ff',
  yellow: '#f3d53d',
  orange: '#ff943d',
  green: '#34c26b',
  'light-green': '#c9f2a0',
  'light-red': '#ffaaaa',
  red: '#ef4b4b',
  white: '#ffffff',
};

const DASHES: { value: TLDefaultDashStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'draw', label: 'Hand' },
];

const SIZES: { value: TLDefaultSizeStyle; label: string }[] = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];

const FILLS: { value: TLDefaultFillStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'semi', label: 'Semi' },
  { value: 'solid', label: 'Solid' },
  { value: 'pattern', label: 'Pattern' },
];

const FONTS: { value: TLDefaultFontStyle; label: string }[] = [
  { value: 'draw', label: 'Hand' },
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

const ALIGN_H: { value: 'start' | 'middle' | 'end'; label: string; icon: typeof AlignLeft }[] = [
  { value: 'start', label: 'Align left', icon: AlignLeft },
  { value: 'middle', label: 'Align center', icon: AlignCenterHorizontal },
  { value: 'end', label: 'Align right', icon: AlignRight },
];

const ALIGN_V: { value: 'start' | 'middle' | 'end'; label: string; icon: typeof AlignStartVertical }[] = [
  { value: 'start', label: 'Align top', icon: AlignStartVertical },
  { value: 'middle', label: 'Align middle', icon: AlignCenterVertical },
  { value: 'end', label: 'Align bottom', icon: AlignEndVertical },
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

const GEO_OPTIONS: { value: string; label: string }[] = [
  { value: 'rectangle', label: 'Rect' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'star', label: 'Star' },
  { value: 'x-box', label: 'X-box' },
  { value: 'check-box', label: 'Check' },
  { value: 'arrow-right', label: 'Arrow' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'heart', label: 'Heart' },
];

const ARROWHEADS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'dot', label: 'Dot' },
  { value: 'square', label: 'Square' },
  { value: 'bar', label: 'Bar' },
  { value: 'pipe', label: 'Pipe' },
  { value: 'inverted', label: 'Inverted' },
];

const KINDS: { value: string; label: string }[] = [
  { value: 'arc', label: 'Arc' },
  { value: 'elbow', label: 'Elbow' },
];

// Style props this panel manages, keyed by their stable style id so per-tool
// defaults can be persisted and re-applied without hardcoding ids.
const STYLE_BY_ID: Record<string, StyleProp<unknown>> = {
  [DefaultColorStyle.id]: DefaultColorStyle,
  [DefaultFillStyle.id]: DefaultFillStyle,
  [DefaultDashStyle.id]: DefaultDashStyle,
  [DefaultSizeStyle.id]: DefaultSizeStyle,
  [DefaultFontStyle.id]: DefaultFontStyle,
  [DefaultTextAlignStyle.id]: DefaultTextAlignStyle,
  [DefaultHorizontalAlignStyle.id]: DefaultHorizontalAlignStyle,
  [DefaultVerticalAlignStyle.id]: DefaultVerticalAlignStyle,
  [GeoShapeGeoStyle.id]: GeoShapeGeoStyle,
  [ArrowShapeArrowheadStartStyle.id]: ArrowShapeArrowheadStartStyle,
  [ArrowShapeArrowheadEndStyle.id]: ArrowShapeArrowheadEndStyle,
};

// Shape props that count as "styles" for the paint-format roller.
const STYLE_PROP_KEYS = new Set([
  'color',
  'fill',
  'dash',
  'size',
  'font',
  'textAlign',
  'align',
  'verticalAlign',
  'geo',
  'kind',
  'arrowheadStart',
  'arrowheadEnd',
  'labelColor',
]);

function loadDefaults(tool: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY + tool);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadRecent(): TLDefaultColorStyle[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TLDefaultColorStyle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface RichBlock {
  type: string;
  content: { type: string; text?: string; styles?: Record<string, boolean> }[];
}

function setRichBold(rich: TLRichText, bold: boolean): TLRichText {
  const blocks = rich.content as unknown as RichBlock[];
  return {
    ...rich,
    content: blocks.map((p) => ({
      ...p,
      content: p.content.map((run) =>
        run.type === 'text' ? { ...run, styles: { ...(run.styles ?? {}), bold } } : run
      ),
    })),
  } as TLRichText;
}

function richHasBold(rich: TLRichText): boolean {
  const blocks = rich.content as unknown as RichBlock[];
  return blocks.some((p) =>
    p.content.some((run) => run.type === 'text' && run.styles?.bold)
  );
}

// One shared style engine for both surfaces (quick strip + rail) so a pick in
// either stays consistent with the other: same selection, same mode, same
// persisted per-tool defaults.
function useToolStyles(editor: Editor | null, tool: string, mode: ToolStyleMode) {
  const [, setTick] = useState(0);
  const copiedRef = useRef<{ props: Record<string, unknown>; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selection = editor ? editor.getSelectedShapes() : [];
  const selectedIdsKey = selection.map((s) => s.id).join(',');

  // Re-render on any editor change (style/selection/camera) so the surfaces
  // reflect live state, throttled to animation frames.
  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setTick((t) => t + 1);
      });
    };
    const unlisten = editor.store.listen(schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      unlisten();
    };
  }, [editor]);

  // Re-apply this tool's persisted defaults whenever the tool changes.
  useEffect(() => {
    if (!editor) return;
    for (const [id, value] of Object.entries(loadDefaults(tool))) {
      const prop = STYLE_BY_ID[id];
      if (prop && value !== undefined) editor.setStyleForNextShapes(prop as StyleProp<never>, value as never);
    }
  }, [editor, tool]);

  const readStyle = <T,>(style: StyleProp<T>): T | 'mixed' => {
    if (!editor) return style.defaultValue;
    if (mode === 'selection' && selection.length > 0) {
      const shared = editor.getSharedStyles().get(style);
      if (shared?.type === 'shared') return shared.value;
      return 'mixed';
    }
    return editor.getStyleForNextShape(style);
  };

  const saveDefault = useCallback(
    (style: StyleProp<unknown>, value: unknown) => {
      const defaults = loadDefaults(tool);
      defaults[style.id] = value;
      try {
        localStorage.setItem(DEFAULTS_KEY + tool, JSON.stringify(defaults));
      } catch {
        // ignore
      }
    },
    [tool]
  );

  const pushRecentColor = useCallback((color: TLDefaultColorStyle) => {
    const list = loadRecent().filter((c) => c !== color);
    list.unshift(color);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
    } catch {
      // ignore
    }
  }, []);

  const applyStyle = useCallback(
    (style: StyleProp<unknown>, value: unknown) => {
      if (!editor) return;
      if (mode === 'selection' && selection.length > 0) {
        editor.setStyleForSelectedShapes(style, value as never);
      } else {
        editor.setStyleForNextShapes(style, value as never);
        saveDefault(style, value);
      }
      if (style === DefaultColorStyle) pushRecentColor(value as TLDefaultColorStyle);
    },
    [editor, mode, selection.length, saveDefault, pushRecentColor]
  );

  const isSelectionMode = mode === 'selection' && selection.length > 0;

  const toggleBold = () => {
    if (!editor || !isSelectionMode) return;
    const targets = selection.filter((s) => s.type === 'text' || s.type === 'note');
    if (targets.length === 0) return;
    const richTexts = targets.map((s) => (s.props as { richText: TLRichText }).richText);
    const allBold = richTexts.every((r) => richHasBold(r));
    const updates: Parameters<typeof editor.updateShapes>[0] = targets.map((s, i) => ({
      id: s.id,
      type: s.type,
      props: { richText: setRichBold(richTexts[i], !allBold) },
    }));
    editor.updateShapes(updates);
  };

  const copyStyles = () => {
    if (!editor || selection.length === 0) return;
    const src = selection[0];
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src.props)) {
      if (STYLE_PROP_KEYS.has(k)) props[k] = v;
    }
    copiedRef.current = { props, key: selectedIdsKey };
    setCopiedKey(selectedIdsKey);
  };

  const applyCopied = () => {
    if (!editor || !copiedRef.current || selection.length === 0) return;
    const { props } = copiedRef.current;
    const updates: Parameters<typeof editor.updateShapes>[0] = selection.map((s) => {
      const merged: Record<string, unknown> = { ...s.props };
      for (const [k, v] of Object.entries(props)) {
        if (STYLE_PROP_KEYS.has(k) && k in s.props) merged[k] = v;
      }
      return { id: s.id, type: s.type, props: merged };
    });
    editor.updateShapes(updates);
  };

  const applyConnectorKind = (value: string) => {
    if (!editor || !isSelectionMode) return;
    const arrows = selection.filter((s) => s.type === 'arrow');
    if (arrows.length === 0) return;
    const updates: Parameters<typeof editor.updateShapes>[0] = arrows.map((s) => ({
      id: s.id,
      type: 'arrow',
      props: { kind: value as 'arc' | 'elbow' },
    }));
    editor.updateShapes(updates);
  };

  const resetStyles = () => {
    if (!editor) return;
    for (const prop of Object.values(STYLE_BY_ID)) {
      editor.setStyleForNextShapes(prop as StyleProp<never>, prop.defaultValue as never);
    }
    try {
      localStorage.removeItem(DEFAULTS_KEY + tool);
    } catch {
      // ignore
    }
  };

  const runAlign = (op: 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom') => {
    if (editor && selection.length > 1) editor.alignShapes(selection.map((s) => s.id), op);
  };
  const runDistribute = (op: 'horizontal' | 'vertical') => {
    if (editor && selection.length > 2) editor.distributeShapes(selection.map((s) => s.id), op);
  };
  const runZ = (fn: (ids: ReturnType<Editor['getSelectedShapeIds']>) => void) => {
    if (editor) fn(editor.getSelectedShapeIds());
  };

  const color = readStyle(DefaultColorStyle);
  const fill = readStyle(DefaultFillStyle);
  const dash = readStyle(DefaultDashStyle);
  const size = readStyle(DefaultSizeStyle);
  const font = readStyle(DefaultFontStyle);
  const alignH = readStyle(DefaultHorizontalAlignStyle) as 'start' | 'middle' | 'end' | 'mixed';
  const textAlign = readStyle(DefaultTextAlignStyle) as 'start' | 'middle' | 'end' | 'mixed';
  const verticalAlign = readStyle(DefaultVerticalAlignStyle) as 'start' | 'middle' | 'end' | 'mixed';
  const geo = readStyle(GeoShapeGeoStyle) as string | 'mixed';
  const headStart = readStyle(ArrowShapeArrowheadStartStyle) as string | 'mixed';
  const headEnd = readStyle(ArrowShapeArrowheadEndStyle) as string | 'mixed';
  const selectedArrow = selection.find((s) => s.type === 'arrow') as
    | { props: { kind?: string } }
    | undefined;
  const kind = selectedArrow?.props.kind ?? 'arc';

  return {
    selection,
    selectedIdsKey,
    isSelectionMode,
    hasSelection: selection.length > 0,
    selectionCount: selection.length,
    recent: loadRecent(),
    color,
    fill,
    dash,
    size,
    font,
    alignH,
    textAlign,
    verticalAlign,
    geo,
    headStart,
    headEnd,
    kind,
    applyStyle,
    toggleBold,
    copyStyles,
    applyCopied,
    applyConnectorKind,
    resetStyles,
    runAlign,
    runDistribute,
    runZ,
    copiedKey,
  };
}

interface QuickStylesProps {
  editor: Editor | null;
  tool: string;
  mode: ToolStyleMode;
  /** Focus mode state + toggle (dim everything except the selection). */
  focusMode?: boolean;
  onToggleFocus?: () => void;
}

// The bottom-center quick strip: color swatches plus one primary control per
// tool, above the AI input. It never scrolls — rows wrap naturally within the
// pill — so it stays a calm surface next to the input bar.
export function QuickStyles({ editor, tool, mode, focusMode = false, onToggleFocus }: QuickStylesProps) {
  const s = useToolStyles(editor, tool, mode);
  const colorLabel = tool === 'sticky' ? 'Note color' : 'Color';

  const primaryControl =
    tool === 'shapes' ? (
      <GridPicker options={GEO_OPTIONS} current={s.geo} onPick={(v) => s.applyStyle(GeoShapeGeoStyle, v)} />
    ) : tool === 'draw' || tool === 'select' || tool === 'connector' ? (
      <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
    ) : (
      <Segmented options={FONTS.map((o) => ({ ...o, active: s.font === o.value }))} onPick={(v) => s.applyStyle(DefaultFontStyle, v)} />
    );

  return (
    <div
      className="quick-styles glass"
      role="group"
      aria-label={`${TOOL_TITLES[tool] ?? 'Tool'} styles`}
    >
      <div className="quick-styles-swatches">
        {s.recent.length > 0 && (
          <div className="quick-styles-swatch-row" role="group" aria-label="Recent colors">
            {s.recent.map((c) => (
              <button
                key={`recent-${c}`}
                className={`quick-styles-swatch ${s.color === c ? 'active' : ''}`}
                style={{ background: COLOR_HEX[c] }}
                title={c}
                aria-label={`Color: ${c}`}
                onClick={() => s.applyStyle(DefaultColorStyle, c)}
              />
            ))}
          </div>
        )}
        <div className="quick-styles-swatch-row" role="group" aria-label={colorLabel}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`quick-styles-swatch ${s.color === c ? 'active' : ''}`}
              style={{ background: COLOR_HEX[c] }}
              title={c}
              aria-label={`${colorLabel}: ${c}`}
              onClick={() => s.applyStyle(DefaultColorStyle, c)}
            />
          ))}
        </div>
      </div>
      <div className="quick-styles-primary">
        <div className="quick-styles-primary-control">{primaryControl}</div>
        {s.hasSelection && onToggleFocus && (
          <button
            className={`quick-styles-focus ${focusMode ? 'active' : ''}`}
            onClick={onToggleFocus}
            title="Focus mode (F) — dim everything except the selection"
            aria-pressed={focusMode}
          >
            <Focus size={13} />
            {focusMode ? 'Focused' : 'Focus'}
          </button>
        )}
      </div>
    </div>
  );
}

interface ToolOptionsRailProps {
  editor: Editor | null;
  tool: string;
  mode: ToolStyleMode;
  onModeChange: (mode: ToolStyleMode) => void;
}

// The right tool rail: the full per-tool options as a vertical dock — paint
// format, fill/dash/size/font/align, arrange, arrowheads. No expand toggle:
// this is the always-available extended surface, paired with the quick strip.
export function ToolOptionsRail({ editor, tool, mode, onModeChange }: ToolOptionsRailProps) {
  const s = useToolStyles(editor, tool, mode);
  const hasSelection = s.hasSelection;

  const renderColorRow = (label: string) => (
    <ColorRow
      label={label}
      current={s.color}
      recent={s.recent}
      onPick={(c) => s.applyStyle(DefaultColorStyle, c)}
    />
  );

  return (
    <div
      className="tool-options-rail glass"
      role="dialog"
      aria-label={`${TOOL_TITLES[tool] ?? 'Tool'} options`}
    >
      <header className="tool-options-rail-header">
        <div className="tool-options-rail-title">
          <span>{TOOL_TITLES[tool] ?? 'Tool'}</span>
          {tool === 'select' && hasSelection && (
            <span className="tool-options-count">{s.selectionCount}</span>
          )}
        </div>
        {tool !== 'select' && (
          <div className="tool-options-mode" role="group" aria-label="Apply styles to">
            <button
              className={`tool-options-mode-btn ${mode === 'selection' ? 'active' : ''}`}
              onClick={() => onModeChange('selection')}
              disabled={!hasSelection}
              title={hasSelection ? 'Apply to selected shapes' : 'Select shapes first'}
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
        {tool === 'select' && hasSelection && (
          <>
            <section className="tool-options-section">
              <h3 className="tool-options-section-title">Paint format</h3>
              <div className="tool-options-row">
                <button className="tool-options-paint-btn" onClick={s.copyStyles} title="Copy styles from the first selected shape">
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
            </section>

            {renderColorRow('Color')}
            <Section label="Size">
              <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
            </Section>
            <Section label="Dash">
              <Segmented options={DASHES.map((o) => ({ ...o, active: s.dash === o.value }))} onPick={(v) => s.applyStyle(DefaultDashStyle, v)} />
            </Section>

            <section className="tool-options-section">
              <h3 className="tool-options-section-title">Arrange</h3>
              <span className="tool-options-sub-label">Align</span>
              <div className="tool-options-icon-grid">
                {ALIGN_OPS_H.map((a) => {
                  const Icon = a.icon;
                  return <IconBtn key={`h-${a.value}`} title={a.label} onClick={() => s.runAlign(a.value)} disabled={s.selection.length < 2}><Icon size={15} /></IconBtn>;
                })}
                {ALIGN_OPS_V.map((a) => {
                  const Icon = a.icon;
                  return <IconBtn key={`v-${a.value}`} title={a.label} onClick={() => s.runAlign(a.value)} disabled={s.selection.length < 2}><Icon size={15} /></IconBtn>;
                })}
              </div>
              <span className="tool-options-sub-label">Distribute</span>
              <div className="tool-options-icon-grid">
                <IconBtn title="Distribute horizontally" onClick={() => s.runDistribute('horizontal')} disabled={s.selection.length < 3}><AlignHorizontalDistributeCenter size={15} /></IconBtn>
                <IconBtn title="Distribute vertically" onClick={() => s.runDistribute('vertical')} disabled={s.selection.length < 3}><AlignVerticalDistributeCenter size={15} /></IconBtn>
              </div>
              <span className="tool-options-sub-label">Order</span>
              <div className="tool-options-icon-grid">
                <IconBtn title="Bring to front" onClick={() => s.runZ((ids) => editor?.bringToFront(ids))}><BringToFront size={15} /></IconBtn>
                <IconBtn title="Bring forward" onClick={() => s.runZ((ids) => editor?.bringForward(ids))}><ArrowUp size={15} /></IconBtn>
                <IconBtn title="Send backward" onClick={() => s.runZ((ids) => editor?.sendBackward(ids))}><ArrowDown size={15} /></IconBtn>
                <IconBtn title="Send to back" onClick={() => s.runZ((ids) => editor?.sendToBack(ids))}><SendToBack size={15} /></IconBtn>
              </div>
            </section>
          </>
        )}

        {tool === 'shapes' && (
          <>
            {renderColorRow('Color')}
            <Section label="Fill">
              <Segmented options={FILLS.map((o) => ({ ...o, active: s.fill === o.value }))} onPick={(v) => s.applyStyle(DefaultFillStyle, v)} />
            </Section>
            <Section label="Dash">
              <Segmented options={DASHES.map((o) => ({ ...o, active: s.dash === o.value }))} onPick={(v) => s.applyStyle(DefaultDashStyle, v)} />
            </Section>
            <Section label="Size">
              <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
            </Section>
            <Section label="Shape">
              <GridPicker options={GEO_OPTIONS} current={s.geo} onPick={(v) => s.applyStyle(GeoShapeGeoStyle, v)} />
            </Section>
            <Section label="Font">
              <Segmented options={FONTS.map((o) => ({ ...o, active: s.font === o.value }))} onPick={(v) => s.applyStyle(DefaultFontStyle, v)} />
            </Section>
            <Section label="Align">
              <Segmented options={ALIGN_H.map((o) => ({ ...o, label: o.label.replace('Align ', ''), active: s.alignH === o.value }))} onPick={(v) => s.applyStyle(DefaultHorizontalAlignStyle, v)} />
            </Section>
            <Section label="Vertical">
              <Segmented options={ALIGN_V.map((o) => ({ ...o, label: o.label.replace('Align ', ''), active: s.verticalAlign === o.value }))} onPick={(v) => s.applyStyle(DefaultVerticalAlignStyle, v)} />
            </Section>
          </>
        )}

        {tool === 'draw' && (
          <>
            {renderColorRow('Color')}
            <Section label="Size">
              <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
            </Section>
            <Section label="Dash">
              <Segmented options={DASHES.map((o) => ({ ...o, active: s.dash === o.value }))} onPick={(v) => s.applyStyle(DefaultDashStyle, v)} />
            </Section>
            <Section label="Fill">
              <Segmented options={FILLS.slice(0, 3).map((o) => ({ ...o, active: s.fill === o.value }))} onPick={(v) => s.applyStyle(DefaultFillStyle, v)} />
            </Section>
          </>
        )}

        {tool === 'sticky' && (
          <>
            {renderColorRow('Note color')}
            {s.isSelectionMode && (
              <Section label="Text">
                <IconBtn title="Bold text" onClick={s.toggleBold} active={s.selection.some((sh) => sh.type === 'note' && richHasBold((sh.props as { richText: TLRichText }).richText))}><Bold size={14} /></IconBtn>
              </Section>
            )}
            <Section label="Size">
              <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
            </Section>
            <Section label="Font">
              <Segmented options={FONTS.map((o) => ({ ...o, active: s.font === o.value }))} onPick={(v) => s.applyStyle(DefaultFontStyle, v)} />
            </Section>
            <Section label="Align">
              <Segmented options={ALIGN_H.map((o) => ({ ...o, label: o.label.replace('Align ', ''), active: s.alignH === o.value }))} onPick={(v) => s.applyStyle(DefaultHorizontalAlignStyle, v)} />
            </Section>
          </>
        )}

        {tool === 'text' && (
          <>
            {renderColorRow('Color')}
            {s.isSelectionMode && (
              <Section label="Text">
                <IconBtn title="Bold text" onClick={s.toggleBold} active={s.selection.some((sh) => sh.type === 'text' && richHasBold((sh.props as { richText: TLRichText }).richText))}><Bold size={14} /></IconBtn>
              </Section>
            )}
            <Section label="Font">
              <Segmented options={FONTS.map((o) => ({ ...o, active: s.font === o.value }))} onPick={(v) => s.applyStyle(DefaultFontStyle, v)} />
            </Section>
            <Section label="Size">
              <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
            </Section>
            <Section label="Align">
              <Segmented options={ALIGN_H.map((o) => ({ ...o, label: o.label.replace('Align ', ''), active: s.textAlign === o.value }))} onPick={(v) => s.applyStyle(DefaultTextAlignStyle, v)} />
            </Section>
          </>
        )}

        {tool === 'connector' && (
          <>
            {renderColorRow('Color')}
            <Section label="Size">
              <Segmented options={SIZES.map((o) => ({ ...o, active: s.size === o.value }))} onPick={(v) => s.applyStyle(DefaultSizeStyle, v)} />
            </Section>
            <Section label="Dash">
              <Segmented options={DASHES.map((o) => ({ ...o, active: s.dash === o.value }))} onPick={(v) => s.applyStyle(DefaultDashStyle, v)} />
            </Section>
            <Section label="Start arrowhead">
              <GridPicker options={ARROWHEADS} current={s.headStart} onPick={(v) => s.applyStyle(ArrowShapeArrowheadStartStyle, v)} />
            </Section>
            <Section label="End arrowhead">
              <GridPicker options={ARROWHEADS} current={s.headEnd} onPick={(v) => s.applyStyle(ArrowShapeArrowheadEndStyle, v)} />
            </Section>
            <Section label="Curve">
              <Segmented options={KINDS.map((o) => ({ ...o, active: s.kind === o.value }))} onPick={s.applyConnectorKind} disabled={!s.isSelectionMode} />
              {!s.isSelectionMode && (
                <p className="tool-options-hint">Select a connector to change its curve.</p>
              )}
            </Section>
          </>
        )}
      </div>

      {tool !== 'select' && (
        <footer className="tool-options-rail-footer">
          <button className="tool-options-reset" onClick={s.resetStyles} title="Reset these styles to defaults">
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

function ColorRow({
  label,
  current,
  recent,
  onPick,
}: {
  label: string;
  current: string | 'mixed';
  recent: TLDefaultColorStyle[];
  onPick: (c: TLDefaultColorStyle) => void;
}) {
  const hasRecent = recent.length > 0;
  return (
    <section className="tool-options-section">
      <h3 className="tool-options-section-title">{label}</h3>
      {hasRecent && (
        <div className="tool-options-color-row" role="group" aria-label={`Recent ${label.toLowerCase()}`}>
          {recent.map((c) => (
            <button
              key={`recent-${c}`}
              className={`tool-options-color ${current === c ? 'active' : ''}`}
              style={{ background: COLOR_HEX[c] }}
              title={c}
              aria-label={`${label}: ${c}`}
              onClick={() => onPick(c)}
            />
          ))}
        </div>
      )}
      <div className="tool-options-color-row" role="group" aria-label={label}>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`tool-options-color ${current === c ? 'active' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            title={c}
            aria-label={`${label}: ${c}`}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </section>
  );
}
