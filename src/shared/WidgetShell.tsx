import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./WidgetShell.css";

export interface WidgetShellProps {
  title: string;
  /** True only on the very first load; a background refresh shouldn't
   * hide previously-loaded content. */
  loading: boolean;
  /** Non-null when the latest fetch attempt failed. */
  error: string | null;
  onRefresh?: () => void;
  /** Extra controls rendered in the header, e.g. a ViewSwitcher or filter. */
  headerActions?: ReactNode;
  children: ReactNode;
}

/** Common card chrome (title bar, refresh button, expand-to-overlay,
 * loading/error states) that every widget wraps its content in. Every
 * widget gets a large-view mode for free just by using this shell - it's
 * a property of the shell, not something each widget builds itself. */
export function WidgetShell({ title, loading, error, onRefresh, headerActions, children }: WidgetShellProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const body = (
    <div className="widget-shell__body">
      {error && <div className="widget-shell__error">{error}</div>}
      {loading ? <div className="widget-shell__placeholder">Loading…</div> : children}
    </div>
  );

  if (expanded) {
    return (
      <>
        <section className="widget-shell widget-shell--placeholder">
          <span className="widget-shell__title">{title}</span>
          <button type="button" className="widget-shell__restore" onClick={() => setExpanded(false)}>
            ⤡ Expanded — restore
          </button>
        </section>
        {createPortal(
          <div className="widget-overlay" onClick={() => setExpanded(false)}>
            <div className="widget-overlay__panel" onClick={(e) => e.stopPropagation()}>
              <section className="widget-shell widget-shell--expanded">
                <header className="widget-shell__header">
                  <h2 className="widget-shell__title">{title}</h2>
                  <div className="widget-shell__header-actions">
                    {headerActions}
                    {onRefresh && (
                      <button type="button" className="widget-shell__icon-button" onClick={onRefresh} title="Refresh now">
                        ⟳
                      </button>
                    )}
                    <button
                      type="button"
                      className="widget-shell__icon-button"
                      onClick={() => setExpanded(false)}
                      title="Collapse"
                      aria-label={`Collapse ${title}`}
                    >
                      ⤢
                    </button>
                  </div>
                </header>
                {body}
              </section>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <section className="widget-shell">
      <header className="widget-shell__header">
        <h2 className="widget-shell__title">{title}</h2>
        <div className="widget-shell__header-actions">
          {headerActions}
          {onRefresh && (
            <button type="button" className="widget-shell__icon-button" onClick={onRefresh} title="Refresh now">
              ⟳
            </button>
          )}
          <button
            type="button"
            className="widget-shell__icon-button"
            onClick={() => setExpanded(true)}
            title="Expand"
            aria-label={`Expand ${title}`}
          >
            ⤢
          </button>
        </div>
      </header>
      {body}
    </section>
  );
}
