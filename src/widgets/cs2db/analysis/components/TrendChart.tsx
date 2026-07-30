import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RATING_DIMENSIONS } from "../types";
import type { Snapshot } from "../types";

const COLORS = ["#58a6ff", "#e07a5f", "#3fb950", "#d29922", "#a371f7", "#39c5cf", "#f85149"];

export function TrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <p className="analysis__muted">
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
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {RATING_DIMENSIONS.map(({ label }, i) => (
          <Line key={label} type="monotone" dataKey={label} stroke={COLORS[i % COLORS.length]} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
