use serde::Serialize;

use super::common::EventInfo;

#[derive(Debug, Serialize, Clone)]
pub struct IncidentSummary {
    pub unhealthy_workloads: Vec<UnhealthyWorkload>,
    pub recent_changes: Vec<ChangeEvent>,
    pub error_events: Vec<NamespaceEventInfo>,
    pub saturation: Vec<WorkloadSaturation>,
    pub affected_routes: Vec<AffectedRoute>,
}

#[derive(Debug, Serialize, Clone)]
pub struct UnhealthyWorkload {
    pub name: String,
    pub kind: String,
    pub ready: String,
    pub restart_count: i32,
    pub pod_errors: Vec<String>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct NamespaceEventInfo {
    pub involved_kind: String,
    pub involved_name: String,
    pub reason: String,
    pub message: String,
    pub count: i32,
    pub event_type: String,
    pub timestamp: String,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChangeEvent {
    pub timestamp: String,
    pub change_type: String,
    pub resource_kind: String,
    pub resource_name: String,
    pub description: String,
    pub details: ChangeDetails,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum ChangeDetails {
    ImageUpdate {
        old_image: String,
        new_image: String,
        revision: String,
    },
    #[allow(dead_code)]
    ConfigChange {
        resource_version: String,
    },
    #[allow(dead_code)]
    ScaleChange {
        old_replicas: i32,
        new_replicas: i32,
    },
    Restart {
        triggered_at: String,
    },
    HPAScale {
        current_replicas: i32,
        desired_replicas: i32,
        metric_status: String,
    },
    NewReplicaSet {
        name: String,
        revision: String,
        image: String,
    },
    Generic {
        info: String,
    },
}

#[derive(Debug, Serialize, Clone)]
pub struct RolloutTimeline {
    pub deployment_name: String,
    pub steps: Vec<RolloutStep>,
}

#[derive(Debug, Serialize, Clone)]
pub struct RolloutStep {
    pub timestamp: String,
    pub step_type: String,
    pub description: String,
    pub old_rs: Option<ReplicaSetSnapshot>,
    pub new_rs: Option<ReplicaSetSnapshot>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ReplicaSetSnapshot {
    pub name: String,
    pub revision: String,
    pub replicas: i32,
    pub ready: i32,
    pub image: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkloadSaturation {
    pub workload_name: String,
    pub workload_kind: String,
    pub desired_replicas: i32,
    pub ready_replicas: i32,
    pub pods: Vec<PodSaturationInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PodSaturationInfo {
    pub name: String,
    pub status: String,
    pub restarts: i32,
    pub requests_cpu: String,
    pub requests_memory: String,
    pub limits_cpu: String,
    pub limits_memory: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AffectedRoute {
    pub route_type: String,
    pub route_name: String,
    pub hosts: Vec<String>,
    pub paths: Vec<String>,
    pub backend_service: String,
    pub backend_healthy: bool,
}
