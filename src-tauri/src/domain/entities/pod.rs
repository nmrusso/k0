use serde::Serialize;
use std::collections::BTreeMap;

use super::common::{EventInfo, OwnerRefInfo};

#[derive(Debug, Serialize, Clone)]
pub struct PodInfo {
    pub name: String,
    pub namespace: String,
    pub status: String,
    pub ready: String,
    pub restarts: i32,
    pub age: String,
    pub node: String,
    pub ip: String,
    pub workload_kind: String,
    pub workload_name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct PodDetailInfo {
    pub name: String,
    pub namespace: String,
    pub created: String,
    pub labels: BTreeMap<String, String>,
    pub annotations: BTreeMap<String, String>,
    pub controlled_by: Vec<OwnerRefInfo>,
    pub workload_owner: Option<OwnerRefInfo>,
    pub status: String,
    pub node: String,
    pub pod_ip: String,
    pub pod_ips: Vec<String>,
    pub service_account: String,
    pub qos_class: String,
    pub conditions: Vec<PodConditionInfo>,
    pub tolerations: Vec<TolerationInfo>,
    pub volumes: Vec<VolumeInfo>,
    pub containers: Vec<ContainerDetailInfo>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ContainerDetailInfo {
    pub name: String,
    pub image: String,
    pub status: String,
    pub ready: bool,
    pub restart_count: i32,
    pub ports: Vec<String>,
    pub env_vars: Vec<EnvVarInfo>,
    pub mounts: Vec<MountInfo>,
    pub liveness: Option<ProbeInfo>,
    pub readiness: Option<ProbeInfo>,
    pub command: Vec<String>,
    pub args: Vec<String>,
    pub requests_cpu: String,
    pub requests_memory: String,
    pub limits_cpu: String,
    pub limits_memory: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct EnvVarInfo {
    pub name: String,
    pub value: String,
    pub source: String,
    pub source_name: String,
    pub source_key: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct MountInfo {
    pub name: String,
    pub mount_path: String,
    pub read_only: bool,
    pub sub_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProbeInfo {
    pub probe_type: String,
    pub details: String,
    pub delay: i32,
    pub timeout: i32,
    pub period: i32,
    pub success_threshold: i32,
    pub failure_threshold: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct PodConditionInfo {
    pub condition_type: String,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TolerationInfo {
    pub key: String,
    pub operator: String,
    pub value: String,
    pub effect: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct VolumeInfo {
    pub name: String,
    pub volume_type: String,
    pub source: String,
    pub sources: Vec<VolumeSourceInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct VolumeSourceInfo {
    pub source_type: String,
    pub name: String,
    pub detail: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ImageHistoryEntry {
    pub revision: String,
    pub image: String,
    pub age: String,
    pub current: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pod_info_serialize() {
        let pod = PodInfo {
            name: "test-pod".to_string(),
            namespace: "default".to_string(),
            status: "Running".to_string(),
            ready: "1/1".to_string(),
            restarts: 0,
            age: "5d".to_string(),
            node: "node-1".to_string(),
            ip: "10.0.0.1".to_string(),
            workload_kind: "Deployment".to_string(),
            workload_name: "test-deploy".to_string(),
        };
        let json = serde_json::to_string(&pod).unwrap();
        assert!(json.contains("test-pod"));
        assert!(json.contains("Running"));
    }

    #[test]
    fn test_probe_info_serialize() {
        let probe = ProbeInfo {
            probe_type: "http-get".to_string(),
            details: "http://:8080/health".to_string(),
            delay: 10,
            timeout: 1,
            period: 10,
            success_threshold: 1,
            failure_threshold: 3,
        };
        let json = serde_json::to_string(&probe).unwrap();
        assert!(json.contains("http-get"));
    }
}
