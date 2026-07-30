import { Suspense } from "react";
import { WIDGETS } from "./widgets.config";
import "./Dashboard.css";

export function Dashboard() {
  return (
    <div className="dashboard">
      {WIDGETS.filter((w) => w.enabled).map(({ id, span, Component }) => (
        <div key={id} className="dashboard__cell" style={{ gridColumn: `span ${span}` }}>
          <Suspense fallback={<div className="dashboard__widget-fallback" />}>
            <Component />
          </Suspense>
        </div>
      ))}
    </div>
  );
}
