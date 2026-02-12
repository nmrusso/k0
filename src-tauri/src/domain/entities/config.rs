use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct ConfigMapInfo {
    pub name: String,
    pub namespace: String,
    pub data_count: i32,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SecretInfo {
    pub name: String,
    pub namespace: String,
    pub secret_type: String,
    pub data_count: i32,
    pub age: String,
}
