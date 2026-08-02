import { Suspense, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WidgetDefinition } from "./widgets.config";

const MIN_WIDTH = 240;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 1400;
const MAX_HEIGHT = 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
}

interface ResizeState {
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

interface Props {
  widget: WidgetDefinition;
  x: number;
  y: number;
  width: number;
  height: number;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onBringToFront: () => void;
  zIndex: number;
}

/** A widget in "free size" mode - not part of the CSS Grid at all (an
 * absolutely-positioned child of `.dashboard`, which CSS Grid simply
 * ignores for layout purposes), dragged/resized by raw pixel offset
 * instead of snapping to grid units. Reuses the same self-calibrating
 * pointer-capture technique WidgetCell's grid resize handle already proved
 * out, just without the "round to nearest grid unit" step, and applies the
 * same pattern to repositioning too (grid-mode reorder uses native HTML5
 * DnD instead, which doesn't make sense for a widget that isn't part of
 * any ordered list). */
export function FreeWidgetCell({ widget, x, y, width, height, onMove, onResize, onBringToFront, zIndex }: Props) {
  const { label, Component } = widget;
  const dragState = useRef<DragState | null>(null);
  const resizeState = useRef<ResizeState | null>(null);
  const [preview, setPreview] = useState<Geometry | null>(null);

  const effective = preview ?? { x, y, width, height };

  function handleDragPointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    onBringToFront();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startLeft: x, startTop: y };
  }

  function handleDragPointerMove(e: ReactPointerEvent) {
    const state = dragState.current;
    if (!state || e.pointerId !== state.pointerId) return;
    setPreview({
      x: Math.max(0, state.startLeft + (e.clientX - state.startX)),
      y: Math.max(0, state.startTop + (e.clientY - state.startY)),
      width,
      height,
    });
  }

  function handleDragPointerUp(e: ReactPointerEvent) {
    const state = dragState.current;
    if (!state || e.pointerId !== state.pointerId) return;
    dragState.current = null;
    if (preview) onMove(preview.x, preview.y);
    setPreview(null);
  }

  function handleResizePointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    onBringToFront();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeState.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startWidth: width, startHeight: height };
  }

  function handleResizePointerMove(e: ReactPointerEvent) {
    const state = resizeState.current;
    if (!state || e.pointerId !== state.pointerId) return;
    setPreview({
      x,
      y,
      width: clamp(state.startWidth + (e.clientX - state.startX), MIN_WIDTH, MAX_WIDTH),
      height: clamp(state.startHeight + (e.clientY - state.startY), MIN_HEIGHT, MAX_HEIGHT),
    });
  }

  function handleResizePointerUp(e: ReactPointerEvent) {
    const state = resizeState.current;
    if (!state || e.pointerId !== state.pointerId) return;
    resizeState.current = null;
    if (preview) onResize(preview.width, preview.height);
    setPreview(null);
  }

  return (
    <div
      className="dashboard__free-cell"
      style={{ left: effective.x, top: effective.y, width: effective.width, height: effective.height, zIndex }}
      onPointerDownCapture={onBringToFront}
    >
      <button
        type="button"
        className="dashboard__drag-handle"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
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
