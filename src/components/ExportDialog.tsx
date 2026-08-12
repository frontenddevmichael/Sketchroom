import { useState } from 'react';
import { X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Editor } from 'tldraw';
import { Spinner } from './Spinner';
import { useModalFocus } from '../lib/useModalFocus';
import './ExportDialog.css';

interface ExportDialogProps {
  onClose: () => void;
  editor: Editor | null;
}

type Format = 'png' | 'pdf' | 'svg';
type Scope = 'whole' | 'selection';

export function ExportDialog({ onClose, editor }: ExportDialogProps) {
  const modalRef = useModalFocus<HTMLDivElement>(onClose);
  const [format, setFormat] = useState<Format>('png');
  const [scope, setScope] = useState<Scope>('whole');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedShapes = editor?.getSelectedShapeIds() ?? [];
  const hasSelection = selectedShapes.length > 0;
  const exportIds =
    scope === 'selection' && hasSelection
      ? selectedShapes
      : [...(editor?.getCurrentPageShapes() ?? [])].map((s) => s.id);

  const handleExport = async () => {
    const ed = editor;
    if (!ed) return;
    setExporting(true);
    setError(null);
    try {
      if (exportIds.length === 0) throw new Error('Nothing to export');
      if (format === 'svg') {
        const svgString = await ed.getSvgString(exportIds, { background: true });
        if (!svgString) throw new Error('Could not render SVG');
        downloadBlob(
          new Blob([svgString.svg], { type: 'image/svg+xml' }),
          `sketchroom-${Date.now()}.svg`
        );
      } else if (format === 'png') {
        const { blob } = await ed.toImage(exportIds, {
          format: 'png',
          background: true,
          scale: 2,
          pixelRatio: 1,
        });
        downloadBlob(blob, `sketchroom-${Date.now()}.png`);
      } else {
        const { blob } = await ed.toImage(exportIds, {
          format: 'png',
          background: true,
          scale: 2,
          pixelRatio: 1,
        });
        const bitmap = await createImageBitmap(blob);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();
        const dataUrl = await blobToDataURL(blob);
        const pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        pdf.save(`sketchroom-${Date.now()}.pdf`);
      }
      setExporting(false);
      window.setTimeout(onClose, 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
      setExporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card export-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        ref={modalRef}
      >
        <header className="modal-header">
          <h2 className="modal-title">Export</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="export-formats" role="radiogroup" aria-label="Export format">
          {(['png', 'pdf', 'svg'] as Format[]).map((value) => (
            <label key={value} className={`export-format ${format === value ? 'checked' : ''}`}>
              <input
                type="radio"
                name="format"
                value={value}
                checked={format === value}
                onChange={() => setFormat(value)}
              />
              <span className="export-radio" />
              <span className="export-format-label">
                {value === 'svg' ? 'SVG' : value.toUpperCase()}
              </span>
            </label>
          ))}
        </div>

        <div className="export-scope" role="radiogroup" aria-label="Export scope">
          <label className={`export-format ${scope === 'whole' ? 'checked' : ''}`}>
            <input
              type="radio"
              name="scope"
              value="whole"
              checked={scope === 'whole'}
              onChange={() => setScope('whole')}
            />
            <span className="export-radio" />
            <span className="export-format-label">Whole canvas</span>
          </label>
          <label
            className={`export-format ${scope === 'selection' ? 'checked' : ''} ${hasSelection ? '' : 'disabled'}`}
          >
            <input
              type="radio"
              name="scope"
              value="selection"
              checked={scope === 'selection'}
              onChange={() => setScope('selection')}
              disabled={!hasSelection}
            />
            <span className="export-radio" />
            <span className="export-format-label">
              Current selection {hasSelection ? `(${selectedShapes.length})` : ''}
            </span>
          </label>
        </div>

        {error && <p className="export-error">{error}</p>}

        <button className="btn btn-primary export-button" onClick={handleExport} disabled={exporting}>
          {exporting && <Spinner size={15} />}
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}