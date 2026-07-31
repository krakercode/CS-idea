import { Suspense, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WidgetDefinition } from "./widgets.config";

const MIN_COL = 1;
const MAX_COL = 3;
const MIN_ROW = 1;
const MAX_ROW = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ResizeDragState {
  pointerId: number;
  startX: number;
  startY: number;
  /** Pixels per one grid column/row unit, measured from this cell's own
   * current rendered size at drag start - self-calibrating, so it doesn't
   * need to know the grid's exact column width, gap, or row height
   * (which isn't a fixed constant anyway: rows are `minmax(260px, 1fr)`). */
  colUnit: number;
  rowUnit: number;
  startCol: number;
  startRow: number;
}

interface Props {
  widget: WidgetDefinition;
  colSpan: 1 | 2 | 3;
  rowSpan: 1 | 2;
  isDragOver: boolean;
  onResize: (colSpan: 1 | 2 | 3, rowSpan: 1 | 2) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
}

/** One grid cell on the dashboard: a drag handle (top-left, reorders
 * widgets via native drag-and-drop - drop target is the whole cell) and a
 * resize handle (bottom-right, drag to change how many grid columns/rows
 * it spans). Both used to only be settable via dropdowns in
 * DashboardSettings; that panel now only handles visibility/scheduling. */
export function WidgetCell({
  widget,
  colSpan,
  rowSpan,
  isDragOver,
  onResize,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const { label, Component } = widget;
  const cellRef = useRef<HTMLDivElement>(null);
  const resizeState = useRef<ResizeDragState | null>(null);
  const [preview, setPreview] = useState<{ colSpan: 1 | 2 | 3; rowSpan: 1 | 2 } | null>(null);

  const effectiveColSpan = preview?.colSpan ?? colSpan;
  const effectiveRowSpan = preview?.rowSpan ?? rowSpan;

  function handleResizePointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      colUnit: rect.width / colSpan,
      rowUnit: rect.height / rowSpan,
      startCol: colSpan,
      startRow: rowSpan,
    };
  }

  function handleResizePointerMove(e: ReactPointerEvent) {
    const state = resizeState.current;
    if (!state || e.pointerId !== state.pointerId) return;
    const nextCol = clamp(
      state.startCol + Math.round((e.clientX - state.startX) / state.colUnit),
      MIN_COL,
      MAX_COL,
    ) as 1 | 2 | 3;
    const nextRow = clamp(state.startRow + Math.round((e.clientY - state.startY) / state.rowUnit), MIN_ROW, MAX_ROW) as 1 | 2;
    setPreview({ colSpan: nextCol, rowSpan: nextRow });
  }

  function handleResizePointerUp(e: ReactPointerEvent) {
    const state = resizeState.current;
    if (!state || e.pointerId !== state.pointerId) return;
    resizeState.current = null;
    if (preview) onResize(preview.colSpan, preview.rowSpan);
    setPreview(null);
  }

  return (
    <div
      ref={cellRef}
      className={`dashboard__cell ${isDragOver ? "dashboard__cell--drag-over" : ""}`}
      style={{ gridColumn: `span ${effectiveColSpan}`, gridRow: `span ${effectiveRowSpan}` }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <button
        type="button"
        className="dashboard__drag-handle"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={`Drag to move ${label}`}
        aria-label={`Drag to move ${label}`}
      >
        ⠿
      </button>

      <Suspense fallback={<div className="dashboard__widget-fallback" />}>
        <Component />
      </Suspense>

      <div
        className="dashboard__resize-handle"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        title={`Drag to resize ${label}`}
        aria-hidden="true"
      />
    </div>
  );
}
