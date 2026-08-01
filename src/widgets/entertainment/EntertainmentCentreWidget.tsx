import { type FormEvent, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { addShortcut, getShortcuts, MAX_SHORTCUTS, removeShortcut } from "./entertainmentStore";
import { launchShortcut, pickExecutable } from "./entertainmentService";
import type { EntertainmentShortcut } from "./types";
import "./EntertainmentCentreWidget.css";

export function EntertainmentCentreWidget() {
  const [shortcuts, setShortcuts] = useState<EntertainmentShortcut[]>(() => getShortcuts());
  const [nameDraft, setNameDraft] = useState("");
  const [pathDraft, setPathDraft] = useState("");
  const [argsDraft, setArgsDraft] = useState("");
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setShortcuts(addShortcut(nameDraft, pathDraft, argsDraft));
    setNameDraft("");
    setPathDraft("");
    setArgsDraft("");
  }

  function handleRemove(id: string) {
    setShortcuts(removeShortcut(id));
  }

  async function handleBrowse() {
    const picked = await pickExecutable();
    if (picked) setPathDraft(picked);
  }

  async function handleLaunch(shortcut: EntertainmentShortcut) {
    if (launchingId) return;
    setLaunchingId(shortcut.id);
    setLaunchError(null);
    try {
      await launchShortcut(shortcut);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : `Couldn't launch ${shortcut.name}.`);
    } finally {
      setLaunchingId(null);
    }
  }

  return (
    <WidgetShell title="Entertainment Centre" loading={false} error={null}>
      <div className="entertainment-widget">
        {launchError && <p className="entertainment-widget__error">{launchError}</p>}

        {shortcuts.length === 0 && (
          <p className="entertainment-widget__empty">
            No shortcuts yet - add an emulator, game, or anything else you'd rather launch from here.
          </p>
        )}

        <ul className="entertainment-widget__list">
          {shortcuts.map((s) => (
            <li key={s.id} className="entertainment-widget__item">
              <div className="entertainment-widget__info">
                <span className="entertainment-widget__name">{s.name}</span>
                <span className="entertainment-widget__path">{s.path}</span>
              </div>
              <div className="entertainment-widget__actions">
                <button
                  type="button"
                  className="entertainment-widget__launch"
                  onClick={() => handleLaunch(s)}
                  disabled={launchingId !== null}
                >
                  {launchingId === s.id ? "…" : "Launch"}
                </button>
                <button
                  type="button"
                  className="entertainment-widget__remove"
                  onClick={() => handleRemove(s.id)}
                  aria-label={`Remove ${s.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>

        {shortcuts.length < MAX_SHORTCUTS && (
          <form className="entertainment-widget__form" onSubmit={handleAdd}>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Name"
              className="entertainment-widget__input"
            />
            <div className="entertainment-widget__path-row">
              <input
                type="text"
                value={pathDraft}
                onChange={(e) => setPathDraft(e.target.value)}
                placeholder="Path to executable"
                className="entertainment-widget__input entertainment-widget__input--path"
              />
              <button type="button" className="entertainment-widget__browse" onClick={handleBrowse}>
                Browse…
              </button>
            </div>
            <input
              type="text"
              value={argsDraft}
              onChange={(e) => setArgsDraft(e.target.value)}
              placeholder="Arguments (optional, e.g. a ROM path)"
              className="entertainment-widget__input"
            />
            <button type="submit" className="entertainment-widget__add">
              Add shortcut
            </button>
          </form>
        )}
      </div>
    </WidgetShell>
  );
}
