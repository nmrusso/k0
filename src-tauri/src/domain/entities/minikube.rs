use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinikubeProfile {
    pub name: String,
    pub status: String,
    pub driver: String,
    pub container_runtime: String,
    pub kubernetes_version: String,
    pub cpus: u32,
    pub memory: u64,
    pub nodes: u32,
    pub ip: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinikubeStatus {
    pub name: String,
    pub host: String,
    pub kubelet: String,
    pub apiserver: String,
    pub kubeconfig: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinikubeAddon {
    pub name: String,
    pub enabled: bool,
    pub profile: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MinikubeServiceEntry {
    pub namespace: String,
    pub name: String,
    pub target_port: String,
    pub url: String,
}
