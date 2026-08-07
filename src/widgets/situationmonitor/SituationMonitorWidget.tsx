import { type FormEvent, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { ExternalLink } from "../../shared/ExternalLink";
import { formatRelativeTime } from "../../shared/format";
import { fetchSituationNews } from "./gdeltService";
import { fetchReliefWebReports } from "./reliefwebService";
import { getReliefWebAppname, setReliefWebAppname } from "./reliefwebAppnameStore";
import { addWatchTopic, getWatchTopics, MAX_TOPICS, removeWatchTopic } from "./watchTopicsStore";
import type { SituationUpdate } from "./types";
import "./SituationMonitorWidget.css";

const REFRESH_INTERVAL_MS = 10 * 60_000;

/** Concurrent so ReliefWeb needing an appname (or being down) never takes
 * out GDELT's always-on results - same "one source failing doesn't fail
 * the widget" reasoning as Calendar's two-source merge. Only sources that
 * were actually attempted (ReliefWeb is skipped with no appname set)
 * count toward "did everything fail" - an unconfigured, never-called
 * ReliefWeb isn't a success that should paper over GDELT genuinely
 * failing, which a hardcoded two-promise allSettled would otherwise miss
 * (its trivial `Promise.resolve([])` always "succeeds"). */
async function fetchAll(topics: string[]): Promise<SituationUpdate[]> {
  const appname = getReliefWebAppname();
  const attempted = [
    fetchSituationNews(topics),
    ...(appname ? [fetchReliefWebReports(appname)] : []),
  ];
  const results = await Promise.allSettled(attempted);

  const updates: SituationUpdate[] = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (updates.length === 0 && failures.length === results.length) {
    const reason = failures[0]?.reason as unknown;
    throw reason instanceof Error ? reason : new Error("Failed to load updates.");
  }

  return updates.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function SituationMonitorWidget() {
  const [topics, setTopics] = useState<string[]>(() => getWatchTopics());
  const [draft, setDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [appnameDraft, setAppnameDraft] = useState(() => getReliefWebAppname());

  const { data, loading, error, refresh } = usePolling(() => fetchAll(topics), REFRESH_INTERVAL_MS);

  function handleAddTopic(e: FormEvent) {
    e.preventDefault();
    setTopics(addWatchTopic(draft));
    setDraft("");
    refresh();
  }

  function handleRemoveTopic(topic: string) {
    setTopics(removeWatchTopic(topic));
    refresh();
  }

  function handleSaveAppname(e: FormEvent) {
    e.preventDefault();
    setReliefWebAppname(appnameDraft);
    setShowSettings(false);
    refresh();
  }

  const headerActions = (
    <button
      type="button"
      className="widget-shell__icon-button"
      onClick={() => setShowSettings((v) => !v)}
      title="ReliefWeb source settings"
      aria-label="ReliefWeb source settings"
    >
      ⚙
    </button>
  );

  return (
    <WidgetShell title="Situation Monitor" loading={loading} error={error} onRefresh={refresh} headerActions={headerActions}>
      <div className="situation-widget__tags">
        {topics.map((topic) => (
          <span key={topic} className="situation-widget__tag">
            {topic}
            <button
              type="button"
              className="situation-widget__tag-remove"
              onClick={() => handleRemoveTopic(topic)}
              aria-label={`Stop watching ${topic}`}
            >
              ×
            </button>
          </span>
        ))}
        {topics.length < MAX_TOPICS && (
          <form className="situation-widget__tag-form" onSubmit={handleAddTopic}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a topic…"
              className="situation-widget__tag-input"
            />
          </form>
        )}
      </div>

      {showSettings && (
        <form className="situation-widget__settings" onSubmit={handleSaveAppname}>
          <label htmlFor="situation-appname">ReliefWeb appname (official UN/NGO reports)</label>
          <p className="situation-widget__settings-hint">
            Free, but needs a short approval form -{" "}
            <ExternalLink href="https://apidoc.reliefweb.int/parameters#appname">request one here</ExternalLink>.
            Without it, this widget still shows live news coverage of your watch topics.
          </p>
          <div className="situation-widget__settings-row">
            <input
              id="situation-appname"
              type="text"
              value={appnameDraft}
              onChange={(e) => setAppnameDraft(e.currentTarget.value)}
              placeholder="your-org-purpose-xxxx"
            />
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      <p className="situation-widget__attribution">
        Live coverage via <ExternalLink href="https://www.gdeltproject.org">The GDELT Project</ExternalLink>
        {getReliefWebAppname() && (
          <>
            {" "}
            + official reports via <ExternalLink href="https://reliefweb.int">ReliefWeb</ExternalLink> (CC BY 4.0)
          </>
        )}
        . Every item links straight to its own source - judge the outlet the same way you would anywhere else.
      </p>

      {data && data.length === 0 && <p className="situation-widget__empty">Nothing matching your watch topics right now.</p>}
      <ul className="situation-widget__list">
        {data?.map((update) => (
          <li key={update.id} className="situation-widget__item">
            <ExternalLink href={update.url} className="situation-widget__title">
              {update.title}
            </ExternalLink>
            <div className="situation-widget__meta">
              <span className={`situation-widget__kind situation-widget__kind--${update.kind}`}>
                {update.kind === "reliefweb" ? "ReliefWeb" : "News"}
              </span>
              <span>{update.source}</span>
              {update.country && <span>{update.country}</span>}
              <span>{formatRelativeTime(update.publishedAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
