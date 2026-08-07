import { useMemo, useState, type FormEvent } from "react";
import { Overlay } from "../shared/Overlay";
import { ExternalLink } from "../shared/ExternalLink";
import { WIDGETS, getDefaultSettings, type WidgetDefinition } from "./widgets.config";
import {
  updateWidgetSettings,
  type DashboardSettings as SettingsMap,
  type SizeMode,
  type VisibilityMode,
  type WidgetUserSettings,
} from "./dashboardSettingsStore";
import {
  UNGROUPED_ID,
  createGroup,
  deleteGroup,
  getAssignments,
  getGroups,
  renameGroup,
  setWidgetGroup,
  type WidgetGroup,
} from "./widgetGroupsStore";
import { ThemeSettings } from "./ThemeSettings";
import { UpdateSettings } from "./UpdateSettings";
import { GeneralSettings } from "./GeneralSettings";
import "./DashboardSettings.css";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const UNGROUPED_LABEL = "Ungrouped";

interface Props {
  settings: SettingsMap;
  onChange: (next: SettingsMap) => void;
  onClose: () => void;
}

/** Per-widget visibility (always / scheduled / hidden), schedule, size mode,
 * and group - the runtime counterpart to widgets.config.ts's static
 * defaults. The actual size/position values are drag-driven on the
 * dashboard itself (see WidgetCell.tsx / FreeWidgetCell.tsx) - this panel
 * only picks which of the two drag interactions a widget uses.
 *
 * Widgets are organized into groups (Info, Games, Media, System by
 * default, plus whatever the user creates) purely as a settings-panel
 * organizing device - grouping doesn't change how the dashboard itself
 * renders, just how this list is browsed, and gives each group a one-click
 * "show all / hide all" for decluttering in bulk. */
export function DashboardSettings({ settings, onChange, onClose }: Props) {
  const defaults = getDefaultSettings();
  const defaultGroupIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const widget of WIDGETS) map[widget.id] = widget.defaultGroupId;
    return map;
  }, []);

  const [groups, setGroups] = useState<WidgetGroup[]>(() => getGroups());
  const [assignments, setAssignments] = useState<Record<string, string>>(() => getAssignments(defaultGroupIds));
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  function patch(id: string, p: Partial<WidgetUserSettings>) {
    onChange(updateWidgetSettings(id, p, defaults));
  }

  function toggleDay(id: string, day: number) {
    const current = settings[id].schedule.days;
    const days = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    patch(id, { schedule: { ...settings[id].schedule, days } });
  }

  const widgetsByGroup = useMemo(() => {
    const map = new Map<string, WidgetDefinition[]>();
    for (const widget of WIDGETS) {
      const groupId = assignments[widget.id] ?? UNGROUPED_ID;
      const list = map.get(groupId) ?? [];
      list.push(widget);
      map.set(groupId, list);
    }
    return map;
  }, [assignments]);

  const ungroupedWidgets = widgetsByGroup.get(UNGROUPED_ID) ?? [];
  const sections: Array<{ id: string; name: string; builtin: boolean; widgets: WidgetDefinition[] }> = [
    ...groups.map((g) => ({ ...g, widgets: widgetsByGroup.get(g.id) ?? [] })),
    ...(ungroupedWidgets.length > 0
      ? [{ id: UNGROUPED_ID, name: UNGROUPED_LABEL, builtin: true, widgets: ungroupedWidgets }]
      : []),
  ];

  function setGroupVisibility(widgets: WidgetDefinition[], visibility: VisibilityMode) {
    let next = settings;
    for (const widget of widgets) {
      next = updateWidgetSettings(widget.id, { visibility }, defaults);
    }
    onChange(next);
  }

  function handleAddGroup(e: FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroup(newGroupName);
    setGroups(getGroups());
    setNewGroupName("");
  }

  function startRename(group: { id: string; name: string }) {
    setRenamingGroupId(group.id);
    setRenameDraft(group.name);
  }

  function commitRename(e: FormEvent) {
    e.preventDefault();
    if (renamingGroupId) renameGroup(renamingGroupId, renameDraft);
    setGroups(getGroups());
    setRenamingGroupId(null);
  }

  function handleDeleteGroup(id: string) {
    deleteGroup(id);
    setGroups(getGroups());
    setAssignments(getAssignments(defaultGroupIds));
  }

  function handleMoveWidget(widgetId: string, groupId: string) {
    setWidgetGroup(widgetId, groupId);
    setAssignments(getAssignments(defaultGroupIds));
  }

  // The per-widget "Group" select needs every real group plus the
  // ungrouped bucket as an explicit, always-available choice - not just
  // whatever ungrouped section happens to be showing right now.
  const groupOptions = [...groups, { id: UNGROUPED_ID, name: UNGROUPED_LABEL, builtin: true }];

  return (
    <Overlay onClose={onClose} panelClassName="dashboard-settings-overlay">
      <section className="dashboard-settings">
        <header className="dashboard-settings__header">
          <h2 className="dashboard-settings__title">Dashboard settings</h2>
          <button type="button" className="dashboard-settings__close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <div className="dashboard-settings__body">
          <div className="dashboard-settings__row">
            <div className="dashboard-settings__widget-name">Appearance</div>
            <ThemeSettings />
          </div>

          <div className="dashboard-settings__row">
            <div className="dashboard-settings__widget-name">Software update</div>
            <UpdateSettings />
          </div>

          <div className="dashboard-settings__row">
            <div className="dashboard-settings__widget-name">General</div>
            <GeneralSettings />
          </div>

          {sections.map((section) => (
            <div key={section.id} className="dashboard-settings__group">
              <div className="dashboard-settings__group-header">
                {renamingGroupId === section.id ? (
                  <form className="dashboard-settings__group-rename" onSubmit={commitRename}>
                    <input
                      autoFocus
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.currentTarget.value)}
                      onBlur={commitRename}
                    />
                  </form>
                ) : (
                  <h3 className="dashboard-settings__group-name">
                    {section.name}{" "}
                    <span className="dashboard-settings__group-count">({section.widgets.length})</span>
                  </h3>
                )}

                <div className="dashboard-settings__group-actions">
                  <button type="button" onClick={() => setGroupVisibility(section.widgets, "always")}>
                    Show all
                  </button>
                  <button type="button" onClick={() => setGroupVisibility(section.widgets, "hidden")}>
                    Hide all
                  </button>
                  {section.id !== UNGROUPED_ID && (
                    <button type="button" onClick={() => startRename(section)} title="Rename group" aria-label={`Rename ${section.name}`}>
                      ✎
                    </button>
                  )}
                  {!section.builtin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(section.id)}
                      title="Delete group"
                      aria-label={`Delete ${section.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {section.widgets.map((widget) => {
                const s = settings[widget.id];
                if (!s) return null;

                return (
                  <div key={widget.id} className="dashboard-settings__row">
                    <div className="dashboard-settings__widget-name">{widget.label}</div>

                    <div className="dashboard-settings__controls">
                      <label className="dashboard-settings__field">
                        Visibility
                        <select
                          value={s.visibility}
                          onChange={(e) => patch(widget.id, { visibility: e.target.value as VisibilityMode })}
                        >
                          <option value="always">Always shown</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="hidden">Hidden</option>
                        </select>
                      </label>

                      <label className="dashboard-settings__field">
                        Size
                        <select
                          value={s.sizeMode}
                          onChange={(e) => patch(widget.id, { sizeMode: e.target.value as SizeMode })}
                        >
                          <option value="grid">Snap to grid</option>
                          <option value="free">Free size</option>
                        </select>
                      </label>

                      <label className="dashboard-settings__field">
                        Group
                        <select
                          value={assignments[widget.id] ?? UNGROUPED_ID}
                          onChange={(e) => handleMoveWidget(widget.id, e.target.value)}
                        >
                          {groupOptions.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {s.visibility === "scheduled" && (
                      <div className="dashboard-settings__schedule">
                        <div className="dashboard-settings__days">
                          {DAY_LABELS.map((label, day) => (
                            <button
                              key={day}
                              type="button"
                              className={`dashboard-settings__day ${
                                s.schedule.days.includes(day) ? "dashboard-settings__day--active" : ""
                              }`}
                              onClick={() => toggleDay(widget.id, day)}
                              aria-label={
                                ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="dashboard-settings__times">
                          <input
                            type="time"
                            value={s.schedule.startTime}
                            onChange={(e) => patch(widget.id, { schedule: { ...s.schedule, startTime: e.target.value } })}
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={s.schedule.endTime}
                            onChange={(e) => patch(widget.id, { schedule: { ...s.schedule, endTime: e.target.value } })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <form className="dashboard-settings__new-group" onSubmit={handleAddGroup}>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.currentTarget.value)}
              placeholder="New group name…"
            />
            <button type="submit">+ Add group</button>
          </form>
        </div>

        <footer className="dashboard-settings__footer">
          <ExternalLink href="https://github.com/krakercode/CS-idea" className="dashboard-settings__github-link">
            View on GitHub ↗
          </ExternalLink>
        </footer>
      </section>
    </Overlay>
  );
}
