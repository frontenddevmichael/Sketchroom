export { CanvasSurface } from './CanvasSurface';
export type { CanvasSurfaceProps } from './CanvasSurface';
export { CanvasApi, CANVAS_TOOLS } from './api';
export type { CanvasBounds, CanvasCamera, CanvasTool } from './api';
export { SCENE_FORMAT, emptyScene, parseScene, serializeScene } from './scene';
export type { SceneDocument } from './scene';
export { convertLegacyScene, isLegacyScene, plainText } from './convert';
export type { ConversionResult, LegacyRecord } from './convert';
export { INK, fillFor, inkFor, strokeStyleFor, strokeWidthFor } from './ink';
export {
  FONT_FAMILY_ID,
  boundTextOf,
  createArrowElement,
  createNoteElements,
  createShapeElements,
  createTextElement,
  estimateTextSize,
  isLinearElement,
  isTextElement,
  patchElement,
  textOf,
} from './elements';
export type { Arrowhead, CreateStyle, ShapeKind, StrokeStyle } from './elements';
export { scenePng, sceneSvg, sceneThumbnail } from './export';
