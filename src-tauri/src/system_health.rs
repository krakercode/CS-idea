use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Components, Disks, System};

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
pub struct SystemHealth {
    pub hostname: Option<String>,
    pub os_name: Option<String>,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub disks: Vec<DiskInfo>,
    pub components: Vec<ComponentInfo>,
}

/// Held in app state so CPU usage is measured as a delta between polls
/// (sysinfo needs two refreshes apart in time for accurate percentages)
/// rather than blocking each call with a sleep.
pub struct SystemHealthState(Mutex<System>);

impl SystemHealthState {
    pub fn new() -> Self {
        Self(Mutex::new(System::new_all()))
    }
}

pub fn collect(state: &SystemHealthState) -> SystemHealth {
    let mut sys = state.0.lock().expect("system health mutex poisoned");
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu = CpuInfo {
        brand: sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default(),
        core_count: sys.cpus().len(),
        overall_usage_percent: sys.global_cpu_usage(),
        per_core_usage_percent: sys.cpus().iter().map(|c| c.cpu_usage()).collect(),
    };

    let memory = MemoryInfo {
        total_bytes: sys.total_memory(),
        used_bytes: sys.used_memory(),
        total_swap_bytes: sys.total_swap(),
        used_swap_bytes: sys.used_swap(),
    };

    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|disk| DiskInfo {
            name: disk.name().to_string_lossy().into_owned(),
            mount_point: disk.mount_point().to_string_lossy().into_owned(),
            total_bytes: disk.total_space(),
            available_bytes: disk.available_space(),
            is_removable: disk.is_removable(),
        })
        .collect();

    let components = Components::new_with_refreshed_list()
        .iter()
        .map(|component| ComponentInfo {
            label: component.label().to_string(),
            temperature_celsius: component.temperature(),
        })
        .collect();

    SystemHealth {
        hostname: System::host_name(),
        os_name: System::name(),
        cpu,
        memory,
        disks,
        components,
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

        println!("{:#?}", second);

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
