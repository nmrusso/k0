use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct DeploymentInfo {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub up_to_date: i32,
    pub available: i32,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DaemonSetInfo {
    pub name: String,
    pub namespace: String,
    pub desired: i32,
    pub current: i32,
    pub ready: i32,
    pub available: i32,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StatefulSetInfo {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ReplicaSetInfo {
    pub name: String,
    pub namespace: String,
    pub desired: i32,
    pub current: i32,
    pub ready: i32,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ReplicationControllerInfo {
    pub name: String,
    pub namespace: String,
    pub desired: i32,
    pub current: i32,
    pub ready: i32,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct JobInfo {
    pub name: String,
    pub namespace: String,
    pub completions: String,
    pub duration: String,
    pub age: String,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CronJobInfo {
    pub name: String,
    pub namespace: String,
    pub schedule: String,
    pub suspend: bool,
    pub active: i32,
    pub last_schedule: String,
    pub age: String,
}
