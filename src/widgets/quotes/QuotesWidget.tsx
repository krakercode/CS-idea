import { useEffect, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { getRandomQuote, listSpeakers } from "./quotesService";
import type { Quote } from "./types";
import "./QuotesWidget.css";

const ROTATE_INTERVAL_MS = 10 * 60_000;
const ALL_SPEAKERS = listSpeakers();

export function QuotesWidget() {
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>(ALL_SPEAKERS);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadQuote(speakers: string[]) {
    setLoading(true);
    setQuote(await getRandomQuote(speakers));
    setLoading(false);
  }

  useEffect(() => {
    loadQuote(selectedSpeakers);
    const id = setInterval(() => loadQuote(selectedSpeakers), ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [selectedSpeakers]);

  function toggleSpeaker(speaker: string) {
    setSelectedSpeakers((current) => {
      if (current.includes(speaker)) {
        const next = current.filter((s) => s !== speaker);
        return next.length > 0 ? next : current; // always keep at least one on
      }
      return [...current, speaker];
    });
  }

  const headerActions = (
    <div className="quotes-widget__filters">
      {ALL_SPEAKERS.map((speaker) => (
        <button
          key={speaker}
          type="button"
          className={`quotes-widget__filter ${selectedSpeakers.includes(speaker) ? "quotes-widget__filter--active" : ""}`}
          onClick={() => toggleSpeaker(speaker)}
        >
          {speaker}
        </button>
      ))}
    </div>
  );

  return (
    <WidgetShell
      title="Quotes"
      loading={loading}
      error={null}
      onRefresh={() => loadQuote(selectedSpeakers)}
      headerActions={headerActions}
    >
      {quote && (
        <div className="quotes-widget">
          <blockquote className="quotes-widget__text">&ldquo;{quote.text}&rdquo;</blockquote>
          <div className="quotes-widget__attribution">
            <span
              className={`quotes-widget__speaker ${quote.speakerType === "fictional" ? "quotes-widget__speaker--fictional" : ""}`}
            >
              {quote.speaker}
            </span>
            <span className="quotes-widget__work">{quote.work}</span>
          </div>
          <p className="quotes-widget__context">{quote.context}</p>
          {quote.sourceUrl && (
            <a href={quote.sourceUrl} className="quotes-widget__source" target="_blank" rel="noreferrer">
              Source ↗
            </a>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
