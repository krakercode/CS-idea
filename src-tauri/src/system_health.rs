use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
use nvml_wrapper::Nvml;
use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Components, Cpu, Disks, System};

#[derive(Debug, Serialize, Clone)]
pub struct CpuInfo {
    pub brand: String,
    pub core_count: usize,
    pub overall_usage_percent: f32,
    pub per_core_usage_percent: Vec<f32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub total_swap_bytes: u64,
    pub used_swap_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub is_removable: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct ComponentInfo {
    pub label: String,
    pub temperature_celsius: Option<f32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub usage_percent: f32,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub temperature_celsius: Option<f32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SystemHealth {
    pub hostname: Option<String>,
    pub os_name: Option<String>,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub disks: Vec<DiskInfo>,
    pub components: Vec<ComponentInfo>,
    /// Empty when there's no NVIDIA GPU/driver to talk to (AMD/Intel-only
    /// machines, or NVML just isn't installed) - the widget shows nothing
    /// rather than an error in that case. AMD/Intel GPU stats aren't
    /// supported yet; there's no equivalent of NVML that works across
    /// vendors without much more platform-specific work.
    pub gpus: Vec<GpuInfo>,
}

/// Held in app state so CPU usage is measured as a delta between polls
/// (sysinfo needs two refreshes apart in time for accurate percentages)
/// rather than blocking each call with a sleep. Disks/Components are held
/// here for the same reason - `Disks::refresh`/`Components::refresh` update
/// the existing list in place, far cheaper than re-enumerating every disk
/// and sensor from the OS on every 3s poll the frontend does. NVML is
/// initialized once here too - it's a fairly heavyweight driver handshake,
/// and Nvml itself is Send + Sync so it's fine to hold across calls.
pub struct SystemHealthState {
    sys: Mutex<System>,
    disks: Mutex<Disks>,
    components: Mutex<Components>,
    nvml: Option<Nvml>,
}

impl SystemHealthState {
    pub fn new() -> Self {
        Self {
            sys: Mutex::new(System::new_all()),
            disks: Mutex::new(Disks::new_with_refreshed_list()),
            components: Mutex::new(Components::new_with_refreshed_list()),
            nvml: Nvml::init().ok(),
        }
    }
}

fn collect_gpus(nvml: &Nvml) -> Vec<GpuInfo> {
    let Ok(count) = nvml.device_count() else {
        return Vec::new();
    };

    (0..count)
        .filter_map(|i| {
            let device = nvml.device_by_index(i).ok()?;
            let name = device.name().unwrap_or_else(|_| "GPU".to_string());
            let utilization = device.utilization_rates().ok()?;
            let memory = device.memory_info().ok()?;
            let temperature_celsius = device.temperature(TemperatureSensor::Gpu).ok().map(|t| t as f32);

            Some(GpuInfo {
                name,
                usage_percent: utilization.gpu as f32,
                memory_used_bytes: memory.used,
                memory_total_bytes: memory.total,
                temperature_celsius,
            })
        })
        .collect()
}

pub fn collect(state: &SystemHealthState) -> SystemHealth {
    let mut sys = state.sys.lock().expect("system health mutex poisoned");
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu = CpuInfo {
        brand: sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default(),
        core_count: sys.cpus().len(),
        overall_usage_percent: sys.global_cpu_usage(),
        per_core_usage_percent: sys.cpus().iter().map(Cpu::cpu_usage).collect(),
    };

    let memory = MemoryInfo {
        total_bytes: sys.total_memory(),
        used_bytes: sys.used_memory(),
        total_swap_bytes: sys.total_swap(),
        used_swap_bytes: sys.used_swap(),
    };

    let mut disks_state = state.disks.lock().expect("disks mutex poisoned");
    disks_state.refresh(true);
    let disks = disks_state
        .iter()
        .map(|disk| DiskInfo {
            name: disk.name().to_string_lossy().into_owned(),
            mount_point: disk.mount_point().to_string_lossy().into_owned(),
            total_bytes: disk.total_space(),
            available_bytes: disk.available_space(),
            is_removable: disk.is_removable(),
        })
        .collect();
    drop(disks_state);

    let mut components_state = state.components.lock().expect("components mutex poisoned");
    components_state.refresh(true);
    let components = components_state
        .iter()
        .map(|component| ComponentInfo {
            label: component.label().to_string(),
            temperature_celsius: component.temperature(),
        })
        .collect();
    drop(components_state);

    let gpus = state.nvml.as_ref().map(collect_gpus).unwrap_or_default();

    SystemHealth {
        hostname: System::host_name(),
        os_name: System::name(),
        cpu,
        memory,
        disks,
        components,
        gpus,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_plausible_real_values() {
        let state = SystemHealthState::new();
        let first = collect(&state);
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
        let second = collect(&state);

        println!("{second:#?}");

        assert!(second.cpu.core_count > 0, "expected at least one CPU core");
        assert_eq!(second.cpu.per_core_usage_percent.len(), second.cpu.core_count);
        assert!(second.memory.total_bytes > 0, "expected non-zero total memory");
        assert!(
            second.memory.used_bytes <= second.memory.total_bytes,
            "used memory should not exceed total"
        );
        assert!(!second.disks.is_empty(), "expected at least one disk/mount");
        for disk in &second.disks {
            assert!(disk.available_bytes <= disk.total_bytes || disk.total_bytes == 0);
        }

        // first is unused beyond forcing the delta the second refresh relies on
        let _ = first;
    }
}
