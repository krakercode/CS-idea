import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { RATING_DIMENSIONS } from "../types";
import type { JsonValue } from "../types";

export function RatingRadar({ rating }: { rating: JsonValue | null }) {
  if (!rating) return <p className="analysis__muted">No rating data available for this profile.</p>;

  const data = RATING_DIMENSIONS.map(({ key, label }) => ({
    dimension: label,
    score: typeof rating[key] === "number" ? rating[key] : 0,
  }));

  const hasAnyScore = data.some((d) => d.score > 0);
  if (!hasAnyScore) return <p className="analysis__muted">No rating breakdown available for this profile.</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <Radar name="Rating" dataKey="score" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.4} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
