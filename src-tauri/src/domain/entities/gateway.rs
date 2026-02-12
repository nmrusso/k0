use serde::Serialize;
use std::collections::BTreeMap;

use super::common::{EventInfo, OwnerRefInfo};

#[derive(Debug, Serialize, Clone)]
pub struct GatewayInfo {
    pub name: String,
    pub namespace: String,
    pub gateway_class: String,
    pub addresses: String,
    pub listeners: i32,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GatewayDetailInfo {
    pub name: String,
    pub namespace: String,
    pub created: String,
    pub labels: BTreeMap<String, String>,
    pub annotations: BTreeMap<String, String>,
    pub finalizers: Vec<String>,
    pub controlled_by: Vec<OwnerRefInfo>,
    pub gateway_class: String,
    pub addresses: Vec<GatewayAddressInfo>,
    pub listeners: Vec<GatewayListenerInfo>,
    pub conditions: Vec<GatewayConditionInfo>,
    pub http_routes: Vec<RouteInfo>,
    pub grpc_routes: Vec<RouteInfo>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GatewayAddressInfo {
    pub address_type: String,
    pub value: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GatewayListenerInfo {
    pub name: String,
    pub protocol: String,
    pub port: i32,
    pub hostname: String,
    pub tls_mode: String,
    pub tls_certificate_refs: Vec<String>,
    pub allowed_routes: String,
    pub attached_routes: i32,
    pub conditions: Vec<GatewayConditionInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GatewayConditionInfo {
    pub condition_type: String,
    pub status: String,
    pub reason: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct RouteInfo {
    pub name: String,
    pub namespace: String,
    pub hostnames: Vec<String>,
    pub age: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct RouteParentRefInfo {
    pub group: String,
    pub kind: String,
    pub name: String,
    pub namespace: String,
    pub section_name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct HTTPRouteDetailInfo {
    pub name: String,
    pub namespace: String,
    pub created: String,
    pub labels: BTreeMap<String, String>,
    pub annotations: BTreeMap<String, String>,
    pub controlled_by: Vec<OwnerRefInfo>,
    pub parent_refs: Vec<RouteParentRefInfo>,
    pub hostnames: Vec<String>,
    pub rules: Vec<HTTPRouteRuleInfo>,
    pub conditions: Vec<GatewayConditionInfo>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct HTTPRouteRuleInfo {
    pub matches: Vec<HTTPRouteMatchInfo>,
    pub backend_refs: Vec<RouteBackendRefInfo>,
    pub filters: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct HTTPRouteMatchInfo {
    pub path_type: String,
    pub path_value: String,
    pub method: String,
    pub headers: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct RouteBackendRefInfo {
    pub kind: String,
    pub name: String,
    pub port: i32,
    pub weight: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct GRPCRouteDetailInfo {
    pub name: String,
    pub namespace: String,
    pub created: String,
    pub labels: BTreeMap<String, String>,
    pub annotations: BTreeMap<String, String>,
    pub controlled_by: Vec<OwnerRefInfo>,
    pub parent_refs: Vec<RouteParentRefInfo>,
    pub hostnames: Vec<String>,
    pub rules: Vec<GRPCRouteRuleInfo>,
    pub conditions: Vec<GatewayConditionInfo>,
    pub events: Vec<EventInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GRPCRouteRuleInfo {
    pub matches: Vec<GRPCRouteMatchInfo>,
    pub backend_refs: Vec<RouteBackendRefInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GRPCRouteMatchInfo {
    pub method_service: String,
    pub method_method: String,
    pub match_type: String,
    pub headers: Vec<String>,
}
