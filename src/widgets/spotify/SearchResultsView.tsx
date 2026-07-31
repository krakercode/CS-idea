import { MediaCard } from "./MediaCard";
import { TrackList } from "./TrackList";
import type { AlbumSummary, ArtistSummary, PlaylistSummary, SearchResults } from "./types";

interface Props {
  results: SearchResults | null;
  deviceId: string | null;
  playingUri: string | null;
  onPlayTrack: (uri: string) => void;
  onOpenPlaylist: (p: PlaylistSummary) => void;
  onOpenAlbum: (a: AlbumSummary) => void;
  onOpenArtist: (a: ArtistSummary) => void;
}

export function SearchResultsView({ results, deviceId, playingUri, onPlayTrack, onOpenPlaylist, onOpenAlbum, onOpenArtist }: Props) {
  if (!results) return null;
  const { tracks, albums, artists, playlists } = results;
  const nothing = tracks.length === 0 && albums.length === 0 && artists.length === 0 && playlists.length === 0;
  if (nothing) return <p className="spotify-widget__empty">No results.</p>;

  return (
    <div className="spotify-widget__search-results">
      {tracks.length > 0 && (
        <section>
          <h3 className="spotify-widget__section-title">Tracks</h3>
          <TrackList tracks={tracks} deviceId={deviceId} playingUri={playingUri} onPlay={onPlayTrack} />
        </section>
      )}
      {playlists.length > 0 && (
        <section>
          <h3 className="spotify-widget__section-title">Playlists</h3>
          <div className="spotify-widget__grid">
            {playlists.map((p) => (
              <MediaCard key={p.id} imageUrl={p.imageUrl} title={p.name} subtitle={`${p.trackCount} tracks`} onClick={() => onOpenPlaylist(p)} />
            ))}
          </div>
        </section>
      )}
      {albums.length > 0 && (
        <section>
          <h3 className="spotify-widget__section-title">Albums</h3>
          <div className="spotify-widget__grid">
            {albums.map((a) => (
              <MediaCard key={a.id} imageUrl={a.imageUrl} title={a.name} subtitle={a.artist} onClick={() => onOpenAlbum(a)} />
            ))}
          </div>
        </section>
      )}
      {artists.length > 0 && (
        <section>
          <h3 className="spotify-widget__section-title">Artists</h3>
          <div className="spotify-widget__grid">
            {artists.map((a) => (
              <MediaCard key={a.id} imageUrl={a.imageUrl} title={a.name} round onClick={() => onOpenArtist(a)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
