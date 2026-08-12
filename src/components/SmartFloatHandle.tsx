import type { PointerEvent } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import './SmartFloatHandle.css';

interface SmartFloatHandleProps {
  onPointerDown: (e: PointerEvent) => void;
  onReset?: () => void;
  manual?: boolean;
  title?: string;
}

export function SmartFloatHandle({
  onPointerDown,
  onReset,
  manual,
  title = 'Drag to reposition',
}: SmartFloatHandleProps) {
  return (
    <span className="smart-float-handle" title={title} aria-label={title}>
      <span className="smart-float-grip" onPointerDown={onPointerDown}>
        <GripVertical size={14} />
      </span>
      {manual && onReset && (
        <button
          type="button"
          className="smart-float-reset"
          title="Reset position"
          aria-label="Reset position"
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <RotateCcw size={11} />
        </button>
      )}
    </span>
  );
}
