interface Props {
  imageUrl?: string;
  title: string;
  subtitle?: string;
  /** Artists get round artwork - everything else (playlists/albums) stays square. */
  round?: boolean;
  onClick: () => void;
}

/** Shared card for a playlist/album/artist in a grid - clicking drills into it. */
export function MediaCard({ imageUrl, title, subtitle, round, onClick }: Props) {
  return (
    <button type="button" className="spotify-widget__card" onClick={onClick}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={`spotify-widget__card-art ${round ? "spotify-widget__card-art--round" : ""}`}
        />
      ) : (
        <div className={`spotify-widget__card-art spotify-widget__card-art--placeholder ${round ? "spotify-widget__card-art--round" : ""}`} />
      )}
      <span className="spotify-widget__card-title">{title}</span>
      {subtitle && <span className="spotify-widget__card-meta">{subtitle}</span>}
    </button>
  );
}
