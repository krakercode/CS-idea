import { useRef, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { COUNTRY_FEATURES, MAP_HEIGHT, MAP_WIDTH, type CountryFeature } from "./mapData";
import { getCountryInfo } from "./countryMetadata";
import { DISPUTED_TERRITORIES } from "./disputedTerritories";
import { CountryPopover, type PopoverPosition } from "./CountryPopover";
import "./WorldMapWidget.css";

/** A vector (SVG path, not raster) world map in the dashboard's hollow-line
 * wireframe style (see the CS2 Analysis rating radar for the same idea) -
 * every country is a stroked outline with no fill, so it scales to any
 * widget size with zero quality loss; only disputed territories get a
 * fill, a horizontal-line hatch pattern rather than a solid color, so
 * their contested status reads as a *texture* rather than just another
 * color in the palette. See mapData.ts/countryMetadata.ts/
 * disputedTerritories.ts for where the underlying data comes from and
 * why. Entirely offline and keyless - the whole dataset is bundled, not
 * fetched. */
export function WorldMapWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  function handleCountryClick(e: React.MouseEvent<SVGPathElement>, feature: CountryFeature) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setSelected(feature);
    setPosition({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    });
  }

  const selectedInfo = selected ? getCountryInfo(selected.id, selected.name) : null;
  const selectedDisputed = selected ? (DISPUTED_TERRITORIES[selected.name] ?? null) : null;

  return (
    <WidgetShell title="World Map" loading={false} error={null}>
      <div className="worldmap" ref={containerRef}>
        <svg
          className="worldmap__svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label="Interactive world map"
        >
          <defs>
            <pattern id="worldmap-disputed-hatch" width={6} height={6} patternUnits="userSpaceOnUse">
              <line x1={0} y1={3} x2={6} y2={3} stroke="var(--color-warning)" strokeWidth={1.5} />
            </pattern>
          </defs>
          {COUNTRY_FEATURES.map((f) => (
            <path
              key={f.id + f.name}
              d={f.path}
              className={`worldmap__country ${f.disputed ? "worldmap__country--disputed" : ""} ${
                selected?.name === f.name ? "worldmap__country--selected" : ""
              }`}
              onClick={(e) => handleCountryClick(e, f)}
            >
              <title>{f.name}</title>
            </path>
          ))}
        </svg>

        <div className="worldmap__legend">
          <span className="worldmap__legend-swatch worldmap__legend-swatch--disputed" /> Disputed / contested status
        </div>

        {selected && selectedInfo && position && (
          <CountryPopover
            info={selectedInfo}
            disputed={selectedDisputed}
            position={position}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </WidgetShell>
  );
}
