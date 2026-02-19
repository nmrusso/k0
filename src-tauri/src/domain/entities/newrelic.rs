use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct PodMetrics {
    pub pod_name: String,
    pub cpu_usage_cores: f64,
    pub memory_usage_bytes: f64,
    pub cpu_limit_cores: Option<f64>,
    pub memory_limit_bytes: Option<f64>,
    pub timeseries: Vec<MetricDataPoint>,
}

#[derive(Serialize, Clone)]
pub struct MetricDataPoint {
    pub timestamp: i64,
    pub cpu_cores: f64,
    pub memory_bytes: f64,
}

#[derive(Serialize, Clone)]
pub struct NamespaceMetricsSummary {
    pub pods: Vec<PodMetrics>,
}

#[derive(Serialize, Clone)]
pub struct NodeMetrics {
    pub node_name: String,
    pub cpu_used_cores: f64,
    pub allocatable_cpu_cores: f64,
    pub cpu_utilization_pct: f64,
    pub memory_working_set_bytes: f64,
    pub allocatable_memory_bytes: f64,
    pub fs_used_bytes: f64,
    pub fs_capacity_bytes: f64,
    pub allocatable_pods: f64,
    pub capacity_pods: f64,
}

#[derive(Serialize, Clone)]
pub struct ActiveAlert {
    pub condition_name: String,
    pub policy_name: String,
    pub target_name: String,
    pub priority: String,
    pub open_time: i64,
}

#[derive(Serialize, Clone)]
pub struct ActiveAlertsSummary {
    pub alerts: Vec<ActiveAlert>,
}

#[derive(Serialize, Clone)]
pub struct ContainerUsage {
    pub container_name: String,
    pub cpu_used_cores: f64,
    pub cpu_limit_cores: f64,
    pub cpu_requested_cores: f64,
    pub memory_working_set_bytes: f64,
    pub memory_limit_bytes: f64,
    pub memory_requested_bytes: f64,
}

#[derive(Serialize, Clone)]
pub struct ContainerUsageSummary {
    pub containers: Vec<ContainerUsage>,
}
