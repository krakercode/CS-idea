import { useEffect, useState } from "react";
import {
  getAlbumTracks,
  getArtistTopTracks,
  getFollowedArtists,
  getPlaylistTracks,
  getPlaylists,
  getSavedAlbums,
  getSavedTracks,
  playContextHere,
  playTrackHere,
  search as searchSpotify,
} from "./spotifyService";
import { MediaCard } from "./MediaCard";
import { TrackList } from "./TrackList";
import { SearchResultsView } from "./SearchResultsView";
import type { AlbumSummary, ArtistSummary, PlaylistSummary, SavedTrack, SearchResults } from "./types";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 50;

const SUB_TABS = [
  { id: "tracks", label: "Liked Songs" },
  { id: "playlists", label: "Playlists" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
] as const;
type SubTabId = (typeof SUB_TABS)[number]["id"];

interface OpenCollection {
  type: "playlist" | "album" | "artist";
  name: string;
  imageUrl?: string;
  contextUri: string;
  loadTracks: () => Promise<SavedTrack[]>;
}

export function LibraryView() {
  const [subTab, setSubTab] = useState<SubTabId>("tracks");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  const [openCollection, setOpenCollection] = useState<OpenCollection | null>(null);
  const [collectionTracks, setCollectionTracks] = useState<SavedTrack[] | null>(null);

  const [tracks, setTracks] = useState<SavedTrack[] | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
  const [artists, setArtists] = useState<ArtistSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [collectionPlaying, setCollectionPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!isSearching) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setLibraryError(null);
    const id = setTimeout(() => {
      searchSpotify(query)
        .then((results) => setSearchResults(results))
        .catch((err) => setLibraryError(err instanceof Error ? err.message : "Couldn't search."))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, isSearching]);

  useEffect(() => {
    if (isSearching || openCollection) return;
    let cancelled = false;
    setLoading(true);
    setLibraryError(null);
    const load =
      subTab === "tracks"
        ? getSavedTracks(PAGE_SIZE, 0).then((r) => !cancelled && setTracks(r ?? []))
        : subTab === "playlists"
          ? getPlaylists().then((r) => !cancelled && setPlaylists(r))
          : subTab === "albums"
            ? getSavedAlbums().then((r) => !cancelled && setAlbums(r))
            : getFollowedArtists().then((r) => !cancelled && setArtists(r));
    load
      .catch((err) => {
        if (cancelled) return;
        setLibraryError(err instanceof Error ? err.message : "Couldn't load this.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [subTab, isSearching, openCollection]);

  useEffect(() => {
    if (!openCollection) {
      setCollectionTracks(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLibraryError(null);
    openCollection
      .loadTracks()
      .then((result) => {
        if (cancelled) return;
        setCollectionTracks(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setLibraryError(err instanceof Error ? err.message : "Couldn't load this.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [openCollection]);

  const anyPlaybackBusy = playingUri !== null || collectionPlaying;

  async function handlePlayTrack(uri: string, contextUri?: string) {
    if (anyPlaybackBusy) return;
    setPlayingUri(uri);
    setPlayError(null);
    try {
      if (contextUri) {
        await playContextHere(contextUri, uri);
      } else {
        await playTrackHere(uri);
      }
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : "Couldn't start playback.");
    } finally {
      setPlayingUri(null);
    }
  }

  async function handlePlayCollection(contextUri: string) {
    if (anyPlaybackBusy) return;
    setCollectionPlaying(true);
    setPlayError(null);
    try {
      await playContextHere(contextUri);
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : "Couldn't start playback.");
    } finally {
      setCollectionPlaying(false);
    }
  }

  function openPlaylist(p: PlaylistSummary) {
    setOpenCollection({
      type: "playlist",
      name: p.name,
      imageUrl: p.imageUrl,
      contextUri: p.uri,
      loadTracks: () => getPlaylistTracks(p.id),
    });
  }
  function openAlbum(a: AlbumSummary) {
    setOpenCollection({
      type: "album",
      name: a.name,
      imageUrl: a.imageUrl,
      contextUri: a.uri,
      loadTracks: () => getAlbumTracks(a.id, a.imageUrl),
    });
  }
  function openArtist(a: ArtistSummary) {
    setOpenCollection({
      type: "artist",
      name: a.name,
      imageUrl: a.imageUrl,
      contextUri: a.uri,
      loadTracks: () => getArtistTopTracks(a.id),
    });
  }

  return (
    <div className="spotify-widget__library">
      <input
        type="text"
        className="spotify-widget__search"
        placeholder="Search Spotify…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpenCollection(null);
        }}
      />

      {playError && <p className="spotify-widget__error">{playError}</p>}

      {isSearching ? (
        searching ? (
          <p className="spotify-widget__empty">Searching…</p>
        ) : libraryError ? (
          <p className="spotify-widget__error">{libraryError}</p>
        ) : (
          <SearchResultsView
            results={searchResults}
            playingUri={playingUri}
            onPlayTrack={(uri) => handlePlayTrack(uri)}
            onOpenPlaylist={openPlaylist}
            onOpenAlbum={openAlbum}
            onOpenArtist={openArtist}
          />
        )
      ) : openCollection ? (
        <div>
          <button type="button" className="spotify-widget__back" onClick={() => setOpenCollection(null)}>
            ← Back
          </button>
          <div className="spotify-widget__collection-header">
            {openCollection.imageUrl && (
              <img
                src={openCollection.imageUrl}
                alt=""
                className={`spotify-widget__collection-art ${openCollection.type === "artist" ? "spotify-widget__collection-art--round" : ""}`}
              />
            )}
            <div>
              <div className="spotify-widget__collection-title">{openCollection.name}</div>
              <button
                type="button"
                className="spotify-widget__library-play spotify-widget__library-play--wide"
                onClick={() => handlePlayCollection(openCollection.contextUri)}
                disabled={anyPlaybackBusy}
                title="Play all"
              >
                {collectionPlaying ? "…" : "▶ Play all"}
              </button>
            </div>
          </div>
          {loading && <p className="spotify-widget__empty">Loading…</p>}
          {!loading && libraryError && <p className="spotify-widget__error">{libraryError}</p>}
          {!loading && !libraryError && collectionTracks && collectionTracks.length === 0 && (
            <p className="spotify-widget__empty">Nothing here.</p>
          )}
          {!loading && !libraryError && collectionTracks && collectionTracks.length > 0 && (
            <TrackList
              tracks={collectionTracks}
              playingUri={playingUri}
              busy={collectionPlaying}
              onPlay={(uri) => handlePlayTrack(uri, openCollection.contextUri)}
            />
          )}
        </div>
      ) : (
        <>
          <div className="spotify-widget__subtabs">
            {SUB_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`spotify-widget__subtab ${subTab === t.id ? "spotify-widget__subtab--active" : ""}`}
                onClick={() => setSubTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && <p className="spotify-widget__empty">Loading…</p>}

          {!loading && libraryError && <p className="spotify-widget__error">{libraryError}</p>}

          {/* Every sub-tab fetches exactly one page of PAGE_SIZE - getting
              back a full page is a strong (if not airtight) signal there's
              more than what's shown, since nothing here paginates further.
              Silently capping at 50 with no indication otherwise made a
              large library (common for Liked Songs/playlists/followed
              artists) look complete when it wasn't. */}
          {!loading &&
            !libraryError &&
            {
              tracks: tracks,
              playlists: playlists,
              albums: albums,
              artists: artists,
            }[subTab]?.length === PAGE_SIZE && (
              <p className="spotify-widget__truncation-note">
                Showing the first {PAGE_SIZE} - there may be more in your Spotify library.
              </p>
            )}

          {!loading && !libraryError && subTab === "tracks" && tracks && tracks.length === 0 && (
            <p className="spotify-widget__empty">No saved tracks found.</p>
          )}
          {!loading && !libraryError && subTab === "tracks" && tracks && tracks.length > 0 && (
            <TrackList tracks={tracks} playingUri={playingUri} onPlay={(uri) => handlePlayTrack(uri)} />
          )}

          {!loading && !libraryError && subTab === "playlists" && playlists && playlists.length === 0 && (
            <p className="spotify-widget__empty">No playlists found.</p>
          )}
          {!loading && !libraryError && subTab === "playlists" && playlists && playlists.length > 0 && (
            <div className="spotify-widget__grid">
              {playlists.map((p) => (
                <MediaCard key={p.id} imageUrl={p.imageUrl} title={p.name} subtitle={`${p.trackCount} tracks`} onClick={() => openPlaylist(p)} />
              ))}
            </div>
          )}

          {!loading && !libraryError && subTab === "albums" && albums && albums.length === 0 && (
            <p className="spotify-widget__empty">No saved albums found.</p>
          )}
          {!loading && !libraryError && subTab === "albums" && albums && albums.length > 0 && (
            <div className="spotify-widget__grid">
              {albums.map((a) => (
                <MediaCard key={a.id} imageUrl={a.imageUrl} title={a.name} subtitle={a.artist} onClick={() => openAlbum(a)} />
              ))}
            </div>
          )}

          {!loading && !libraryError && subTab === "artists" && artists && artists.length === 0 && (
            <p className="spotify-widget__empty">No followed artists found.</p>
          )}
          {!loading && !libraryError && subTab === "artists" && artists && artists.length > 0 && (
            <div className="spotify-widget__grid">
              {artists.map((a) => (
                <MediaCard key={a.id} imageUrl={a.imageUrl} title={a.name} round onClick={() => openArtist(a)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
