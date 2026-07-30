import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Overlay.css";

export interface OverlayProps {
  onClose: () => void;
  /** Extra class on the panel wrapper, for callers that want a different
   * max size/shape than the default (see WidgetShell vs DashboardSettings). */
  panelClassName?: string;
  children: ReactNode;
}

/** Generic centered modal: portals to document.body, closes on Escape or a
 * backdrop click, and stops propagation on the panel itself. Shared by
 * WidgetShell's expand view and the dashboard settings panel - anything
 * that needs a big centered overlay can reuse this instead of rebuilding
 * portal/escape/backdrop handling each time. */
export function Overlay({ onClose, panelClassName, children }: OverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className={`overlay__panel ${panelClassName ?? ""}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
