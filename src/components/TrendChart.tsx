import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RATING_DIMENSIONS, Snapshot } from "../lib/leetify";

const COLORS = ["#396cd8", "#e07a5f", "#3d9970", "#b8860b", "#8e44ad", "#2d9cdb", "#c0392b"];

export function TrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <p className="muted">
        Not enough history yet — trends build up locally each time you look this player up.
      </p>
    );
  }

  const data = snapshots.map((snap) => {
    const point: Record<string, string | number> = {
      date: new Date(snap.fetched_at).toLocaleDateString(),
    };
    for (const { key, label } of RATING_DIMENSIONS) {
      const value = snap.rating?.[key];
      if (typeof value === "number") point[label] = value;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {RATING_DIMENSIONS.map(({ label }, i) => (
          <Line
            key={label}
            type="monotone"
            dataKey={label}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
