// Field names are snake_case to match the JSON serde emits from
// src-tauri/src/system_health.rs verbatim - no transformation layer needed.

export interface CpuInfo {
  brand: string;
  core_count: number;
  overall_usage_percent: number;
  per_core_usage_percent: number[];
}

export interface MemoryInfo {
  total_bytes: number;
  used_bytes: number;
  total_swap_bytes: number;
  used_swap_bytes: number;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_bytes: number;
  available_bytes: number;
  is_removable: boolean;
}

export interface ComponentInfo {
  label: string;
  temperature_celsius: number | null;
}

export interface GpuInfo {
  name: string;
  usage_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  temperature_celsius: number | null;
}

export interface SystemHealth {
  hostname: string | null;
  os_name: string | null;
  cpu: CpuInfo;
  memory: MemoryInfo;
  disks: DiskInfo[];
  components: ComponentInfo[];
  // Empty on machines without an NVIDIA GPU/driver - AMD/Intel aren't
  // supported yet (see system_health.rs).
  gpus: GpuInfo[];
}
