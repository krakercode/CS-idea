import { type FormEvent, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import {
  addTask,
  getLifetimePoints,
  getTasks,
  getTodayCompletedIds,
  getTodayPoints,
  getVitalityScore,
  MAX_TASKS,
  removeTask,
  syntheticHeartRate,
  toggleTaskCompletion,
  updateTask,
  vitalityBand,
} from "./habitsStore";
import type { HabitTask, VitalityBand } from "./types";
import "./HabitsWidget.css";

const VIEWS = [
  { id: "tasks", label: "Tasks" },
  { id: "vitals", label: "Vitals" },
];

const BAND_LABEL: Record<VitalityBand, string> = {
  healthy: "Stable",
  warning: "Fatigued",
  critical: "Critical",
};

// A hand-authored heartbeat trace, not real EKG data - three shapes with
// increasingly sharp/erratic spikes so the band is visible in the line
// itself, not just its color.
const PULSE_PATH: Record<VitalityBand, string> = {
  healthy: "M0,20 L20,20 L26,20 L30,6 L34,32 L38,20 L60,20 L66,20 L70,10 L74,28 L78,20 L100,20",
  warning:
    "M0,20 L14,20 L18,26 L22,10 L26,32 L30,4 L34,20 L38,18 L60,20 L64,26 L68,10 L72,32 L76,4 L80,20 L84,18 L100,20",
  critical:
    "M0,20 L8,20 L11,30 L14,4 L17,34 L20,2 L23,26 L26,14 L29,20 L46,20 L49,30 L52,4 L55,34 L58,2 L61,26 L64,14 L67,20 L84,20 L87,30 L90,4 L93,34 L96,2 L100,20",
};

// Flavor readout lines, not separately tracked data - purely wording that
// shifts with the same single vitality score everything else here derives
// from, in the spirit of a sci-fi terminal scan rather than a real
// per-body-part health model.
const FLAVOR_LINES: Record<VitalityBand, string[]> = {
  healthy: ["› Cardiac output: NOMINAL", "› Cognitive load: STABLE", "› Recovery rate: OPTIMAL"],
  warning: ["› Cardiac output: ELEVATED", "› Cognitive load: STRAINED", "› Recovery rate: DELAYED"],
  critical: ["› Cardiac output: CRITICAL", "› Cognitive load: OVERLOADED", "› Recovery rate: STALLED"],
};

// Stroke-only outline (not filled), closer to a med-bay body-scan readout
// than a solid silhouette - same schematic shapes as before, just drawn as
// an outline instead of a block.
function VitalsSilhouette({ band }: { band: VitalityBand }) {
  return (
    <svg viewBox="0 0 100 200" className={`habits-widget__silhouette habits-widget__silhouette--${band}`} aria-hidden>
      <circle cx="50" cy="24" r="16" />
      <rect x="34" y="44" width="32" height="58" rx="8" />
      <rect x="17" y="48" width="14" height="52" rx="6" />
      <rect x="69" y="48" width="14" height="52" rx="6" />
      <rect x="36" y="104" width="12" height="72" rx="6" />
      <rect x="52" y="104" width="12" height="72" rx="6" />
    </svg>
  );
}

function PulseLine({ band }: { band: VitalityBand }) {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={`habits-widget__pulse habits-widget__pulse--${band}`} aria-hidden>
      <path d={PULSE_PATH[band]} fill="none" strokeWidth="2" />
    </svg>
  );
}

export function HabitsWidget() {
  const { activeId, setActiveId, next, prev } = useWidgetViews(VIEWS);
  const [tasks, setTasks] = useState<HabitTask[]>(() => getTasks());
  const [completedToday, setCompletedToday] = useState<string[]>(() => getTodayCompletedIds());
  const [nameDraft, setNameDraft] = useState("");
  const [pointsDraft, setPointsDraft] = useState("10");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameDraft, setEditNameDraft] = useState("");
  const [editPointsDraft, setEditPointsDraft] = useState("");

  const vitality = getVitalityScore();
  const band = vitalityBand(vitality);
  const heartRate = syntheticHeartRate(vitality);
  const todayPoints = getTodayPoints();
  const lifetimePoints = getLifetimePoints();

  function handleToggle(taskId: string) {
    setCompletedToday(toggleTaskCompletion(taskId));
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setTasks(addTask(nameDraft, Number(pointsDraft)));
    setNameDraft("");
    setPointsDraft("10");
  }

  function handleRemove(id: string) {
    setTasks(removeTask(id));
    if (editingId === id) setEditingId(null);
  }

  function startEdit(task: HabitTask) {
    setEditingId(task.id);
    setEditNameDraft(task.name);
    setEditPointsDraft(String(task.points));
  }

  function handleSaveEdit(e: FormEvent, id: string) {
    e.preventDefault();
    setTasks(updateTask(id, editNameDraft, Number(editPointsDraft)));
    setEditingId(null);
  }

  const headerActions = (
    <ViewSwitcher views={VIEWS} activeId={activeId} onSelect={setActiveId} onNext={next} onPrev={prev} />
  );

  return (
    <WidgetShell title="Habits & Reminders" loading={false} error={null} headerActions={headerActions}>
      {activeId === "tasks" && (
        <div className="habits-widget__tasks-view">
          <div className="habits-widget__points">
            <span>
              Today: <strong>{todayPoints}</strong>
            </span>
            <span>
              Lifetime: <strong>{lifetimePoints}</strong>
            </span>
          </div>

          {tasks.length === 0 && (
            <p className="habits-widget__empty">
              No tasks yet - add things worth doing every day (medication, chores, reading) below.
            </p>
          )}

          <ul className="habits-widget__list">
            {tasks.map((t) => {
              const done = completedToday.includes(t.id);

              if (editingId === t.id) {
                return (
                  <li key={t.id} className="habits-widget__item">
                    <form className="habits-widget__edit-form" onSubmit={(e) => handleSaveEdit(e, t.id)}>
                      <input
                        type="text"
                        value={editNameDraft}
                        onChange={(e) => setEditNameDraft(e.target.value)}
                        className="habits-widget__input habits-widget__input--name"
                        placeholder="Task name"
                        autoFocus
                      />
                      <input
                        type="number"
                        min={1}
                        value={editPointsDraft}
                        onChange={(e) => setEditPointsDraft(e.target.value)}
                        className="habits-widget__input habits-widget__input--points"
                        aria-label="Points"
                      />
                      <button type="submit" className="habits-widget__add">
                        Save
                      </button>
                      <button
                        type="button"
                        className="habits-widget__remove"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel edit"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                );
              }

              return (
                <li key={t.id} className="habits-widget__item">
                  <label className="habits-widget__checkbox-row">
                    <input type="checkbox" checked={done} onChange={() => handleToggle(t.id)} />
                    <span className={done ? "habits-widget__task-name habits-widget__task-name--done" : "habits-widget__task-name"}>
                      {t.name}
                    </span>
                    <span className="habits-widget__task-points">+{t.points}</span>
                  </label>
                  <div className="habits-widget__item-actions">
                    <button
                      type="button"
                      className="habits-widget__edit"
                      onClick={() => startEdit(t)}
                      aria-label={`Edit ${t.name}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="habits-widget__remove"
                      onClick={() => handleRemove(t.id)}
                      aria-label={`Remove ${t.name}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {tasks.length < MAX_TASKS && (
            <form className="habits-widget__form" onSubmit={handleAdd}>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Task name"
                className="habits-widget__input habits-widget__input--name"
              />
              <input
                type="number"
                min={1}
                value={pointsDraft}
                onChange={(e) => setPointsDraft(e.target.value)}
                className="habits-widget__input habits-widget__input--points"
                aria-label="Points"
              />
              <button type="submit" className="habits-widget__add">
                Add
              </button>
            </form>
          )}
        </div>
      )}

      {activeId === "vitals" && (
        <div className="habits-widget__vitals-view">
          <div className="habits-widget__hud-frame">
            <span className="habits-widget__corner habits-widget__corner--tl" aria-hidden="true" />
            <span className="habits-widget__corner habits-widget__corner--tr" aria-hidden="true" />
            <span className="habits-widget__corner habits-widget__corner--bl" aria-hidden="true" />
            <span className="habits-widget__corner habits-widget__corner--br" aria-hidden="true" />

            <div className="habits-widget__scan-label">SCANNING…</div>

            <div className="habits-widget__vitals-readout">
              <VitalsSilhouette band={band} />
              <div className="habits-widget__vitals-stats">
                <div className={`habits-widget__vitals-status habits-widget__vitals-status--${band}`}>
                  {BAND_LABEL[band]}
                </div>
                <div className="habits-widget__vitals-score">{vitality}</div>
                <div className="habits-widget__vitals-label">vitality (7-day)</div>
                <div className="habits-widget__vitals-hr">{heartRate} bpm</div>
                <PulseLine band={band} />
              </div>
            </div>

            <ul className="habits-widget__flavor-list">
              {FLAVOR_LINES[band].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <p className="habits-widget__vitals-note">
            A flavor readout, not a real health metric - it tracks your last 7 days of checked-off tasks, not
            today's (today doesn't count against you until it's over).
          </p>
        </div>
      )}
    </WidgetShell>
  );
}
