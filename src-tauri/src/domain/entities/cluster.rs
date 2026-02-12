use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct ContextInfo {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct NamespaceInfo {
    pub name: String,
    pub status: String,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CRDInfo {
    pub name: String,
    pub group: String,
    pub version: String,
    pub kind: String,
    pub plural: String,
    pub scope: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CRDInstanceInfo {
    pub name: String,
    pub namespace: String,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct PortForwardEntry {
    pub id: String,
    pub target_kind: String,
    pub target_name: String,
    pub local_port: u16,
    pub remote_port: u16,
}
