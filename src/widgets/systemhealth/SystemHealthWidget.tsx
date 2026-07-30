import { usePolling } from "../../shared/hooks/usePolling";
import { WidgetShell } from "../../shared/WidgetShell";
import { formatBytes } from "../../shared/format";
import { fetchSystemHealth } from "./systemHealthService";
import "./SystemHealthWidget.css";

const REFRESH_INTERVAL_MS = 3_000;

function usageLevel(percent: number): "low" | "medium" | "high" {
  if (percent >= 90) return "high";
  if (percent >= 70) return "medium";
  return "low";
}

function UsageBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="sys-health__bar-track">
      <div className={`sys-health__bar-fill sys-health__bar-fill--${usageLevel(clamped)}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function SystemHealthWidget() {
  const { data, loading, error, refresh } = usePolling(fetchSystemHealth, REFRESH_INTERVAL_MS);

  return (
    <WidgetShell title="System Health" loading={loading} error={error} onRefresh={refresh}>
      {data && (
        <div className="sys-health">
          {(data.hostname || data.os_name) && (
            <div className="sys-health__subtitle">
              {[data.hostname, data.os_name].filter(Boolean).join(" · ")}
            </div>
          )}

          <section className="sys-health__section">
            <div className="sys-health__row-header">
              <span className="sys-health__label">{data.cpu.brand || "CPU"}</span>
              <span className="sys-health__value">{data.cpu.overall_usage_percent.toFixed(0)}%</span>
            </div>
            <UsageBar percent={data.cpu.overall_usage_percent} />
            <div className="sys-health__cores">
              {data.cpu.per_core_usage_percent.map((usage, i) => (
                <div key={i} className="sys-health__core" title={`Core ${i}: ${usage.toFixed(0)}%`}>
                  <div
                    className={`sys-health__core-fill sys-health__core-fill--${usageLevel(usage)}`}
                    style={{ height: `${Math.max(4, Math.min(100, usage))}%` }}
                  />
                </div>
              ))}
            </div>
          </section>

          {data.gpus.map((gpu) => (
            <section key={gpu.name} className="sys-health__section">
              <div className="sys-health__row-header">
                <span className="sys-health__label">{gpu.name}</span>
                <span className="sys-health__value">{gpu.usage_percent.toFixed(0)}%</span>
              </div>
              <UsageBar percent={gpu.usage_percent} />
              <div className="sys-health__row-header sys-health__row-header--sub">
                <span className="sys-health__muted">
                  {formatBytes(gpu.memory_used_bytes)} / {formatBytes(gpu.memory_total_bytes)} VRAM
                </span>
                {gpu.temperature_celsius != null && (
                  <span className="sys-health__muted">{gpu.temperature_celsius.toFixed(0)}°C</span>
                )}
              </div>
            </section>
          ))}

          <section className="sys-health__section">
            <div className="sys-health__row-header">
              <span className="sys-health__label">Memory</span>
              <span className="sys-health__value">
                {formatBytes(data.memory.used_bytes)} / {formatBytes(data.memory.total_bytes)}
              </span>
            </div>
            <UsageBar percent={(data.memory.used_bytes / data.memory.total_bytes) * 100} />
          </section>

          {data.memory.total_swap_bytes > 0 && (
            <section className="sys-health__section">
              <div className="sys-health__row-header">
                <span className="sys-health__label">Swap</span>
                <span className="sys-health__value">
                  {formatBytes(data.memory.used_swap_bytes)} / {formatBytes(data.memory.total_swap_bytes)}
                </span>
              </div>
              <UsageBar percent={(data.memory.used_swap_bytes / data.memory.total_swap_bytes) * 100} />
            </section>
          )}

          {data.disks.map((disk) => {
            const usedBytes = disk.total_bytes - disk.available_bytes;
            const percent = disk.total_bytes > 0 ? (usedBytes / disk.total_bytes) * 100 : 0;
            return (
              <section key={disk.mount_point} className="sys-health__section">
                <div className="sys-health__row-header">
                  <span className="sys-health__label">
                    {disk.mount_point} <span className="sys-health__muted">({disk.name})</span>
                  </span>
                  <span className="sys-health__value">
                    {formatBytes(usedBytes)} / {formatBytes(disk.total_bytes)}
                  </span>
                </div>
                <UsageBar percent={percent} />
              </section>
            );
          })}

          {data.components.length > 0 && (
            <section className="sys-health__section">
              <div className="sys-health__label sys-health__label--heading">Temperatures</div>
              <ul className="sys-health__temps">
                {data.components.map((c) => (
                  <li key={c.label} className="sys-health__temp-row">
                    <span>{c.label}</span>
                    <span>{c.temperature_celsius != null ? `${c.temperature_celsius.toFixed(0)}°C` : "—"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
