import { invoke } from "@tauri-apps/api/core";
import type { SystemHealth } from "./types";

/**
 * Real data, not mocked - CPU/memory/disk stats only exist on the machine
 * running the app, so there's no meaningful "swap this for a real API"
 * seam here the way other widgets have. See src-tauri/src/system_health.rs.
 */
export async function fetchSystemHealth(): Promise<SystemHealth> {
  return invoke<SystemHealth>("get_system_health");
}
