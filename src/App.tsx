import { useEffect } from "react";
import { Dashboard } from "./app/Dashboard";
import { playClick } from "./shared/sound";

export function App() {
  // Delegated at the document level rather than wired into every button
  // individually - the only way to cover every interactive element across
  // every widget (current and future) without touching each one.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (target?.closest("button, a[href], [role='button']")) {
        playClick();
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <Dashboard />;
}
