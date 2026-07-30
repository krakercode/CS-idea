import type { ReactNode } from "react";
import "./WidgetShell.css";

export interface WidgetShellProps {
  title: string;
  /** True only on the very first load; a background refresh shouldn't
   * hide previously-loaded content. */
  loading: boolean;
  /** Non-null when the latest fetch attempt failed. */
  error: string | null;
  onRefresh?: () => void;
  /** Extra controls rendered in the header, e.g. a tab switcher or filter. */
  headerActions?: ReactNode;
  children: ReactNode;
}

/** Common card chrome (title bar, refresh button, loading/error states) that
 * every widget wraps its content in, so adding a new widget only means
 * writing the content - not re-solving loading/error UI each time. */
export function WidgetShell({ title, loading, error, onRefresh, headerActions, children }: WidgetShellProps) {
  return (
    <section className="widget-shell">
      <header className="widget-shell__header">
        <h2 className="widget-shell__title">{title}</h2>
        <div className="widget-shell__header-actions">
          {headerActions}
          {onRefresh && (
            <button
              type="button"
              className="widget-shell__refresh"
              onClick={onRefresh}
              title="Refresh now"
              aria-label={`Refresh ${title}`}
            >
              ⟳
            </button>
          )}
        </div>
      </header>

      {error && <div className="widget-shell__error">{error}</div>}

      <div className="widget-shell__body">
        {loading ? <div className="widget-shell__placeholder">Loading…</div> : children}
      </div>
    </section>
  );
}
