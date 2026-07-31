import { type FormEvent, type ReactNode, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import { fetchOfTheDay } from "./oftheDayService";
import { addFavoriteArtist, getFavoriteArtists, MAX_ARTISTS, removeFavoriteArtist } from "./favoriteArtistsStore";
import "./OfTheDayWidget.css";

// Content only actually changes once a day, but polling hourly means a
// widget left open overnight picks up the new day's article/picture/song
// within an hour of rollover rather than needing a manual refresh.
const REFRESH_INTERVAL_MS = 60 * 60_000;

const VIEWS = [
  { id: "article", label: "Article" },
  { id: "picture", label: "Picture" },
  { id: "song", label: "Song" },
];

export function OfTheDayWidget() {
  const { data, loading, error, refresh } = usePolling(fetchOfTheDay, REFRESH_INTERVAL_MS);
  const { activeId, setActiveId, next, prev } = useWidgetViews(VIEWS);
  const [artists, setArtists] = useState<string[]>(() => getFavoriteArtists());
  const [draft, setDraft] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setArtists(addFavoriteArtist(draft));
    setDraft("");
    refresh();
  }

  function handleRemove(artist: string) {
    setArtists(removeFavoriteArtist(artist));
    refresh();
  }

  const headerActions = (
    <ViewSwitcher views={VIEWS} activeId={activeId} onSelect={setActiveId} onNext={next} onPrev={prev} />
  );

  let songBody: ReactNode = null;
  if (data?.song) {
    const inner = (
      <>
        {data.song.albumArtUrl && <img className="oftheday-widget__thumb" src={data.song.albumArtUrl} alt="" />}
        <div>
          <h3 className="oftheday-widget__title">{data.song.trackName}</h3>
          <p className="oftheday-widget__extract">{data.song.artist}</p>
        </div>
      </>
    );
    songBody = data.song.externalUrl ? (
      <a className="oftheday-widget__card" href={data.song.externalUrl} target="_blank" rel="noreferrer">
        {inner}
      </a>
    ) : (
      <div className="oftheday-widget__card">{inner}</div>
    );
  }

  return (
    <WidgetShell title="Of the Day" loading={loading} error={error} onRefresh={refresh} headerActions={headerActions}>
      {activeId === "article" &&
        (data?.article ? (
          <a className="oftheday-widget__card" href={data.article.pageUrl} target="_blank" rel="noreferrer">
            {data.article.thumbnailUrl && (
              <img className="oftheday-widget__thumb" src={data.article.thumbnailUrl} alt="" />
            )}
            <div>
              <h3 className="oftheday-widget__title">{data.article.title}</h3>
              <p className="oftheday-widget__extract">{data.article.extract}</p>
            </div>
          </a>
        ) : (
          <p className="oftheday-widget__empty">No featured article available right now.</p>
        ))}

      {activeId === "picture" &&
        (data?.picture ? (
          <a className="oftheday-widget__card oftheday-widget__card--picture" href={data.picture.imageUrl} target="_blank" rel="noreferrer">
            <img className="oftheday-widget__picture-img" src={data.picture.imageUrl} alt={data.picture.title} />
            <div>
              <h3 className="oftheday-widget__title">{data.picture.title}</h3>
              {data.picture.description && <p className="oftheday-widget__extract">{data.picture.description}</p>}
            </div>
          </a>
        ) : (
          <p className="oftheday-widget__empty">No picture of the day available right now.</p>
        ))}

      {activeId === "song" && (
        <div className="oftheday-widget__song-view">
          <div className="oftheday-widget__tags">
            {artists.map((artist) => (
              <span key={artist} className="oftheday-widget__tag">
                {artist}
                <button
                  type="button"
                  className="oftheday-widget__tag-remove"
                  onClick={() => handleRemove(artist)}
                  aria-label={`Remove ${artist} from favorites`}
                >
                  ×
                </button>
              </span>
            ))}
            {artists.length < MAX_ARTISTS && (
              <form className="oftheday-widget__tag-form" onSubmit={handleAdd}>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a favorite artist…"
                  className="oftheday-widget__tag-input"
                />
              </form>
            )}
          </div>

          {songBody ?? (
            <p className="oftheday-widget__empty">
              Connect Spotify (see the Spotify widget) to get a song of the day - personalized by the favorite
              artists above once you've added any, otherwise pulled from your own top tracks.
            </p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
