import { useEffect, useRef } from "react";
import { ExternalLink } from "../../shared/ExternalLink";
import type { CountryInfo } from "./countryMetadata";
import type { DisputedInfo } from "./disputedTerritories";

const POPOVER_WIDTH = 220;

export interface PopoverPosition {
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
}

interface Props {
  info: CountryInfo;
  disputed: DisputedInfo | null;
  position: PopoverPosition;
  onClose: () => void;
}

/** A small anchored panel near the click point rather than a full-screen
 * Overlay - closer to a real right-click context menu (just triggered by
 * a left click, since that's the natural gesture for "tell me about this
 * country" on a map) than the app's usual centered modal. Clamped to stay
 * within the map's own bounds so a click near an edge doesn't render the
 * panel half off-widget. */
export function CountryPopover({ info, disputed, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const left = Math.min(Math.max(position.x, 8), position.containerWidth - POPOVER_WIDTH - 8);
  const top = Math.min(position.y, position.containerHeight - 8);

  return (
    <div
      ref={ref}
      className="worldmap__popover"
      style={{ left, top, width: POPOVER_WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="worldmap__popover-header">
        <span className="worldmap__popover-title">
          {info.flagEmoji && <span aria-hidden="true">{info.flagEmoji} </span>}
          {info.name}
        </span>
        <button type="button" className="worldmap__popover-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {disputed && (
        <div className="worldmap__popover-disputed">
          <span className="worldmap__popover-disputed-status">{disputed.status}</span>
          <p>{disputed.note}</p>
        </div>
      )}

      <dl className="worldmap__popover-facts">
        {info.capital && (
          <>
            <dt>Capital</dt>
            <dd>{info.capital}</dd>
          </>
        )}
        {info.region && (
          <>
            <dt>Region</dt>
            <dd>
              {info.region}
              {info.subregion ? ` · ${info.subregion}` : ""}
            </dd>
          </>
        )}
        {info.unMember !== undefined && (
          <>
            <dt>UN member</dt>
            <dd>{info.unMember ? "Yes" : "No"}</dd>
          </>
        )}
      </dl>

      <ExternalLink href={`https://en.wikipedia.org/wiki/${info.wikipediaTitle}`} className="worldmap__popover-link">
        Wikipedia ↗
      </ExternalLink>
    </div>
  );
}
