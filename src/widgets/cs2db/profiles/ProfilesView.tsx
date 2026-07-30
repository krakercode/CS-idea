import { useEffect, useState } from "react";
import { getCs2Repository } from "../cs2Service";
import { LineupList } from "../LineupList";
import { getProfile, setPositionForMap } from "./profileStore";
import type { Cs2Map, NadeLineup } from "../types";
import "./ProfilesView.css";

/**
 * Pick the CT position you usually hold on a map, then see that position's
 * nades together with every T-side nade for the same map in one screen -
 * the point being no tab-switching mid-match when your team flips sides.
 * Position choice persists locally (profileStore) so it's still set next
 * time you open this map.
 */
export function ProfilesView() {
  const repo = getCs2Repository();
  const maps = repo.listMaps();

  const [profile, setProfile] = useState(() => getProfile());
  const [selectedMap, setSelectedMap] = useState<Cs2Map>(() => {
    const stored = getProfile().positions;
    return maps.find((m) => stored[m]) ?? maps[0];
  });

  const positions = repo.listPositions(selectedMap);
  const selectedPositionId = profile.positions[selectedMap] ?? "";
  const selectedPositionLabel = positions.find((p) => p.id === selectedPositionId)?.label;

  const [positionLineups, setPositionLineups] = useState<NadeLineup[]>([]);
  const [tSideLineups, setTSideLineups] = useState<NadeLineup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      selectedPositionId
        ? repo.fetchLineups({ map: selectedMap, side: "CT", positionId: selectedPositionId })
        : Promise.resolve([]),
      repo.fetchLineups({ map: selectedMap, side: "T" }),
    ]).then(([positionResult, tResult]) => {
      if (cancelled) return;
      setPositionLineups(positionResult);
      setTSideLineups(tResult);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMap, selectedPositionId, repo]);

  function handlePositionChange(positionId: string) {
    setProfile(setPositionForMap(selectedMap, positionId || null));
  }

  return (
    <div className="cs2-profiles">
      <div className="cs2-profiles__controls">
        <label className="cs2-profiles__field">
          Map
          <select value={selectedMap} onChange={(e) => setSelectedMap(e.target.value as Cs2Map)}>
            {maps.map((map) => (
              <option key={map} value={map}>
                {map}
              </option>
            ))}
          </select>
        </label>
        <label className="cs2-profiles__field">
          Your CT position
          <select
            value={selectedPositionId}
            onChange={(e) => handlePositionChange(e.target.value)}
            disabled={positions.length === 0}
          >
            <option value="">Not set</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {positions.length === 0 && (
        <p className="cs2-widget__empty">No positions defined for {selectedMap} yet.</p>
      )}

      {loading ? (
        <p className="cs2-widget__empty">Loading…</p>
      ) : (
        <>
          <section className="cs2-profiles__section">
            <h3 className="cs2-profiles__heading">
              {selectedPositionLabel ? `Your nades — ${selectedPositionLabel}` : "Pick your position above for CT nades"}
            </h3>
            {selectedPositionId && (
              <LineupList lineups={positionLineups} emptyMessage="No CT lineups tagged for this position yet." />
            )}
          </section>

          <section className="cs2-profiles__section">
            <h3 className="cs2-profiles__heading">T side — {selectedMap}</h3>
            <LineupList lineups={tSideLineups} emptyMessage="No T-side lineups for this map yet." />
          </section>
        </>
      )}
    </div>
  );
}
