import type { WidgetViewDef } from "./useWidgetViews";
import "./ViewSwitcher.css";

export interface ViewSwitcherProps {
  views: WidgetViewDef[];
  activeId: string;
  onSelect: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

/** Tab buttons + cycle arrows for a widget's internal views. Meant to be
 * passed as WidgetShell's `headerActions` alongside `useWidgetViews`. */
export function ViewSwitcher({ views, activeId, onSelect, onNext, onPrev }: ViewSwitcherProps) {
  if (views.length <= 1) return null;

  return (
    <div className="view-switcher">
      <button type="button" className="view-switcher__arrow" onClick={onPrev} aria-label="Previous view">
        ‹
      </button>
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`view-switcher__tab ${view.id === activeId ? "view-switcher__tab--active" : ""}`}
          onClick={() => onSelect(view.id)}
        >
          {view.label}
        </button>
      ))}
      <button type="button" className="view-switcher__arrow" onClick={onNext} aria-label="Next view">
        ›
      </button>
    </div>
  );
}
