import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { JsonValue, RATING_DIMENSIONS } from "../lib/leetify";

export function RatingRadar({ rating }: { rating: JsonValue | null }) {
  if (!rating) return <p className="muted">No rating data available for this profile.</p>;

  const data = RATING_DIMENSIONS.map(({ key, label }) => ({
    dimension: label,
    score: typeof rating[key] === "number" ? rating[key] : 0,
  }));

  const hasAnyScore = data.some((d) => d.score > 0);
  if (!hasAnyScore) return <p className="muted">No rating breakdown available for this profile.</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
        <Radar name="Rating" dataKey="score" stroke="#396cd8" fill="#396cd8" fillOpacity={0.4} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
