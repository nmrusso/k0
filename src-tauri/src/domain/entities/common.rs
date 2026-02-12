use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkGraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyGraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Clone)]
pub struct EventInfo {
    pub reason: String,
    pub message: String,
    pub count: i32,
    pub age: String,
    pub event_type: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct OwnerRefInfo {
    pub kind: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GenericResourceListItem {
    pub name: String,
    pub namespace: String,
    pub age: String,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GenericResourceDetailInfo {
    pub name: String,
    pub namespace: String,
    pub created: String,
    pub labels: BTreeMap<String, String>,
    pub annotations: BTreeMap<String, String>,
    pub controlled_by: Vec<OwnerRefInfo>,
    pub finalizers: Vec<String>,
    pub spec: serde_json::Value,
    pub status: serde_json::Value,
    pub extra: BTreeMap<String, serde_json::Value>,
    pub events: Vec<EventInfo>,
}
