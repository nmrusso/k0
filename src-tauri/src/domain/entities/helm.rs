use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HelmRelease {
    pub name: String,
    pub namespace: String,
    pub revision: String,
    pub updated: String,
    pub status: String,
    pub chart: String,
    pub app_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HelmRevision {
    pub revision: i64,
    pub updated: String,
    pub status: String,
    pub chart: String,
    pub app_version: String,
    pub description: String,
}
