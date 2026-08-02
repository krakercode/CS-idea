import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Overlay.css";

export interface OverlayProps {
  onClose: () => void;
  /** Extra class on the panel wrapper, for callers that want a different
   * max size/shape than the default (see WidgetShell vs DashboardSettings). */
  panelClassName?: string;
  /** Fills the entire viewport edge-to-edge (no backdrop padding, no panel
   * size cap) instead of the default centered, size-capped modal - used by
   * WidgetShell's "Fullscreen" mode, as opposed to its smaller "Expand". */
  fullBleed?: boolean;
  children: ReactNode;
}

/** Generic centered modal: portals to document.body, closes on Escape or a
 * backdrop click, and stops propagation on the panel itself. Shared by
 * WidgetShell's expand view and the dashboard settings panel - anything
 * that needs a big centered overlay can reuse this instead of rebuilding
 * portal/escape/backdrop handling each time. */
export function Overlay({ onClose, panelClassName, fullBleed, children }: OverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className={`overlay ${fullBleed ? "overlay--full-bleed" : ""}`} onClick={onClose}>
      <div
        className={`overlay__panel ${fullBleed ? "overlay__panel--full-bleed" : ""} ${panelClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
