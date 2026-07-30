import { useCallback, useMemo, useState } from "react";

export interface WidgetViewDef {
  id: string;
  label: string;
}

/**
 * Generic "multiple internal views" state for a widget - e.g. CS2's
 * Lineups/Pro Plays/Analysis. Any widget that wants more than one distinct
 * view can use this instead of rolling its own tab state, and gets the
 * shared <ViewSwitcher> (tabs + cycle arrows) for free.
 */
export function useWidgetViews(views: WidgetViewDef[], initialId?: string) {
  const [activeId, setActiveId] = useState(initialId ?? views[0]?.id);

  const index = useMemo(() => {
    const i = views.findIndex((v) => v.id === activeId);
    return i === -1 ? 0 : i;
  }, [views, activeId]);

  const next = useCallback(() => {
    setActiveId(views[(index + 1) % views.length].id);
  }, [views, index]);

  const prev = useCallback(() => {
    setActiveId(views[(index - 1 + views.length) % views.length].id);
  }, [views, index]);

  return { activeId, setActiveId, next, prev };
}
