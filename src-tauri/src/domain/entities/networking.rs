use serde::Serialize;
use std::collections::BTreeMap;

use super::common::{EventInfo, OwnerRefInfo};

#[derive(Debug, Serialize, Clone)]
pub struct ServiceInfo {
    pub name: String,
    pub namespace: String,
    pub service_type: String,
    pub cluster_ip: String,
    pub external_ip: String,
    pub ports: String,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct IngressInfo {
    pub name: String,
    pub namespace: String,
    pub class: String,
    pub hosts: String,
    pub address: String,
    pub ports: String,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct IngressDetailInfo {
    pub name: String,
    pub namespace: String,
    pub created: String,
    pub labels: BTreeMap<String, String>,
    pub annotations: BTreeMap<String, String>,
    pub controlled_by: Vec<OwnerRefInfo>,
    pub class: String,
    pub default_backend: String,
    pub rules: Vec<IngressRuleInfo>,
    pub tls: Vec<IngressTlsInfo>,
    pub addresses: Vec<String>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct IngressRuleInfo {
    pub host: String,
    pub paths: Vec<IngressPathInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct IngressPathInfo {
    pub path: String,
    pub path_type: String,
    pub backend_service: String,
    pub backend_port: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct IngressTlsInfo {
    pub hosts: Vec<String>,
    pub secret_name: String,
}
