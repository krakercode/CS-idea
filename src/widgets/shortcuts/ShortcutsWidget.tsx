import { type FormEvent, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { ExternalLink } from "../../shared/ExternalLink";
import { addShortcut, getShortcuts, MAX_SHORTCUTS, removeShortcut } from "./shortcutsStore";
import type { Shortcut } from "./types";
import "./ShortcutsWidget.css";

export function ShortcutsWidget() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => getShortcuts());
  const [nameDraft, setNameDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setShortcuts(addShortcut(nameDraft, urlDraft));
    setNameDraft("");
    setUrlDraft("");
  }

  function handleRemove(id: string) {
    setShortcuts(removeShortcut(id));
  }

  return (
    <WidgetShell title="Shortcuts" loading={false} error={null}>
      <div className="shortcuts-widget">
        {shortcuts.length === 0 && <p className="shortcuts-widget__empty">No shortcuts yet - add one below.</p>}

        <ul className="shortcuts-widget__list">
          {shortcuts.map((s) => (
            <li key={s.id} className="shortcuts-widget__item">
              <ExternalLink href={s.url} className="shortcuts-widget__link">
                {s.name}
              </ExternalLink>
              <button
                type="button"
                className="shortcuts-widget__remove"
                onClick={() => handleRemove(s.id)}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {shortcuts.length < MAX_SHORTCUTS && (
          <form className="shortcuts-widget__form" onSubmit={handleAdd}>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Name"
              className="shortcuts-widget__input shortcuts-widget__input--name"
            />
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="URL"
              className="shortcuts-widget__input shortcuts-widget__input--url"
            />
            <button type="submit" className="shortcuts-widget__add">
              Add
            </button>
          </form>
        )}
      </div>
    </WidgetShell>
  );
}
