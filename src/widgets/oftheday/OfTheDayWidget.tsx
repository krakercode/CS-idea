import { type FormEvent, type ReactNode, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { ExternalLink } from "../../shared/ExternalLink";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import { fetchOfTheDay } from "./oftheDayService";
import { addFavoriteArtist, getFavoriteArtists, MAX_ARTISTS, removeFavoriteArtist } from "./favoriteArtistsStore";
import { getVeganPreference, setVeganPreference } from "./dietPreferenceStore";
import { addPuzzleLink, getPuzzleLinks, MAX_PUZZLE_LINKS, removePuzzleLink } from "./puzzleLinksStore";
import type { PuzzleLink } from "./puzzleLinksStore";
import "./OfTheDayWidget.css";

// Content only actually changes once a day, but polling hourly means a
// widget left open overnight picks up the new day's article/picture/song/
// recipe within an hour of rollover rather than needing a manual refresh.
const REFRESH_INTERVAL_MS = 60 * 60_000;

const VIEWS = [
  { id: "article", label: "Article" },
  { id: "picture", label: "Picture" },
  { id: "song", label: "Song" },
  { id: "recipe", label: "Recipe" },
  { id: "puzzles", label: "Games" },
];

export function OfTheDayWidget() {
  const { data, loading, error, refresh } = usePolling(fetchOfTheDay, REFRESH_INTERVAL_MS);
  const { activeId, setActiveId, next, prev } = useWidgetViews(VIEWS);
  const [artists, setArtists] = useState<string[]>(() => getFavoriteArtists());
  const [draft, setDraft] = useState("");
  const [vegan, setVegan] = useState(() => getVeganPreference());
  const [puzzleLinks, setPuzzleLinks] = useState<PuzzleLink[]>(() => getPuzzleLinks());
  const [puzzleNameDraft, setPuzzleNameDraft] = useState("");
  const [puzzleUrlDraft, setPuzzleUrlDraft] = useState("");

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

  function handleToggleVegan(nextVegan: boolean) {
    setVegan(nextVegan);
    setVeganPreference(nextVegan);
    refresh();
  }

  function handleAddPuzzleLink(e: FormEvent) {
    e.preventDefault();
    setPuzzleLinks(addPuzzleLink(puzzleNameDraft, puzzleUrlDraft));
    setPuzzleNameDraft("");
    setPuzzleUrlDraft("");
  }

  function handleRemovePuzzleLink(id: string) {
    setPuzzleLinks(removePuzzleLink(id));
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
      <ExternalLink className="oftheday-widget__card" href={data.song.externalUrl}>
        {inner}
      </ExternalLink>
    ) : (
      <div className="oftheday-widget__card">{inner}</div>
    );
  }

  return (
    <WidgetShell title="Of the Day" loading={loading} error={error} onRefresh={refresh} headerActions={headerActions}>
      {activeId === "article" &&
        (data?.article ? (
          <ExternalLink className="oftheday-widget__card" href={data.article.pageUrl}>
            {data.article.thumbnailUrl && (
              <img className="oftheday-widget__thumb" src={data.article.thumbnailUrl} alt="" />
            )}
            <div>
              <h3 className="oftheday-widget__title">{data.article.title}</h3>
              <p className="oftheday-widget__extract">{data.article.extract}</p>
            </div>
          </ExternalLink>
        ) : (
          <p className="oftheday-widget__empty">No featured article available right now.</p>
        ))}

      {activeId === "picture" &&
        (data?.picture ? (
          <ExternalLink className="oftheday-widget__card oftheday-widget__card--picture" href={data.picture.imageUrl}>
            <img className="oftheday-widget__picture-img" src={data.picture.imageUrl} alt={data.picture.title} />
            <div>
              <h3 className="oftheday-widget__title">{data.picture.title}</h3>
              {data.picture.description && <p className="oftheday-widget__extract">{data.picture.description}</p>}
            </div>
          </ExternalLink>
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

      {activeId === "recipe" && (
        <div className="oftheday-widget__recipe-view">
          <div className="oftheday-widget__diet-toggle">
            <button
              type="button"
              className={`oftheday-widget__diet-option ${!vegan ? "oftheday-widget__diet-option--active" : ""}`}
              onClick={() => handleToggleVegan(false)}
            >
              Non-vegan
            </button>
            <button
              type="button"
              className={`oftheday-widget__diet-option ${vegan ? "oftheday-widget__diet-option--active" : ""}`}
              onClick={() => handleToggleVegan(true)}
            >
              Vegan
            </button>
          </div>

          {data?.recipe ? (
            <div className="oftheday-widget__recipe">
              <div className="oftheday-widget__card">
                {data.recipe.thumbnailUrl && (
                  <img className="oftheday-widget__thumb" src={data.recipe.thumbnailUrl} alt="" />
                )}
                <div>
                  <h3 className="oftheday-widget__title">{data.recipe.name}</h3>
                  <p className="oftheday-widget__extract">{data.recipe.category}</p>
                </div>
              </div>
              {data.recipe.ingredients.length > 0 && (
                <ul className="oftheday-widget__ingredients">
                  {data.recipe.ingredients.map((ingredient) => (
                    <li key={ingredient}>{ingredient}</li>
                  ))}
                </ul>
              )}
              <p className="oftheday-widget__instructions">{data.recipe.instructions}</p>
              {data.recipe.sourceUrl && (
                <ExternalLink href={data.recipe.sourceUrl} className="oftheday-widget__source">
                  Source ↗
                </ExternalLink>
              )}
            </div>
          ) : (
            <p className="oftheday-widget__empty">No recipe available right now.</p>
          )}
        </div>
      )}

      {activeId === "puzzles" && (
        <div className="oftheday-widget__puzzles-view">
          <ul className="oftheday-widget__puzzle-list">
            {puzzleLinks.map((p) => (
              <li key={p.id} className="oftheday-widget__puzzle-item">
                <ExternalLink href={p.url} className="oftheday-widget__puzzle-link">
                  {p.name}
                </ExternalLink>
                <button
                  type="button"
                  className="oftheday-widget__tag-remove"
                  onClick={() => handleRemovePuzzleLink(p.id)}
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {puzzleLinks.length < MAX_PUZZLE_LINKS && (
            <form className="oftheday-widget__puzzle-form" onSubmit={handleAddPuzzleLink}>
              <input
                type="text"
                value={puzzleNameDraft}
                onChange={(e) => setPuzzleNameDraft(e.target.value)}
                placeholder="Name"
                className="oftheday-widget__tag-input"
              />
              <input
                type="text"
                value={puzzleUrlDraft}
                onChange={(e) => setPuzzleUrlDraft(e.target.value)}
                placeholder="URL"
                className="oftheday-widget__tag-input"
              />
              <button type="submit" className="oftheday-widget__puzzle-add">
                Add
              </button>
            </form>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
