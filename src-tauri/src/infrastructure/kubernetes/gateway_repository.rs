use kube::api::{ApiResource, DynamicObject, ListParams};
use kube::{Api, Client};

use crate::application::services::formatting::format_age;
use crate::domain::entities::common::OwnerRefInfo;
use crate::domain::entities::gateway::*;
use crate::domain::errors::DomainError;

fn gateway_api_resource(kind: &str, plural: &str) -> ApiResource {
    ApiResource {
        group: "gateway.networking.k8s.io".to_string(),
        version: "v1".to_string(),
        api_version: "gateway.networking.k8s.io/v1".to_string(),
        kind: kind.to_string(),
        plural: plural.to_string(),
    }
}

fn extract_routes_for_gateway(
    items: Vec<DynamicObject>,
    gateway_name: &str,
    gateway_namespace: &str,
) -> Vec<RouteInfo> {
    items
        .into_iter()
        .filter(|route| {
            route
                .data
                .get("spec")
                .and_then(|s| s.get("parentRefs"))
                .and_then(|v| v.as_array())
                .map(|refs| {
                    refs.iter().any(|pr| {
                        let name_match = pr.get("name").and_then(|n| n.as_str()).map(|n| n == gateway_name).unwrap_or(false);
                        let ns_match = pr.get("namespace").and_then(|n| n.as_str()).map(|n| n == gateway_namespace).unwrap_or(true);
                        name_match && ns_match
                    })
                })
                .unwrap_or(false)
        })
        .map(|route| {
            let meta = route.metadata;
            let hostnames = route
                .data
                .get("spec")
                .and_then(|s| s.get("hostnames"))
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|h| h.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            RouteInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                hostnames,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect()
}

fn extract_parent_refs(data: &serde_json::Value) -> Vec<RouteParentRefInfo> {
    data.get("spec")
        .and_then(|s| s.get("parentRefs"))
        .and_then(|v| v.as_array())
        .map(|refs| {
            refs.iter()
                .map(|pr| RouteParentRefInfo {
                    group: pr.get("group").and_then(|g| g.as_str()).unwrap_or("gateway.networking.k8s.io").to_string(),
                    kind: pr.get("kind").and_then(|k| k.as_str()).unwrap_or("Gateway").to_string(),
                    name: pr.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                    namespace: pr.get("namespace").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                    section_name: pr.get("sectionName").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn extract_route_conditions(data: &serde_json::Value) -> Vec<GatewayConditionInfo> {
    data.get("status")
        .and_then(|s| s.get("parents"))
        .and_then(|v| v.as_array())
        .and_then(|parents| parents.first())
        .and_then(|p| p.get("conditions"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .map(|c| GatewayConditionInfo {
                    condition_type: c.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string(),
                    status: c.get("status").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                    reason: c.get("reason").and_then(|r| r.as_str()).unwrap_or("").to_string(),
                    message: c.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn extract_backend_refs(val: &serde_json::Value) -> Vec<RouteBackendRefInfo> {
    val.get("backendRefs")
        .and_then(|v| v.as_array())
        .map(|refs| {
            refs.iter()
                .map(|br| RouteBackendRefInfo {
                    kind: br.get("kind").and_then(|k| k.as_str()).unwrap_or("Service").to_string(),
                    name: br.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                    port: br.get("port").and_then(|p| p.as_i64()).unwrap_or(0) as i32,
                    weight: br.get("weight").and_then(|w| w.as_i64()).unwrap_or(1) as i32,
                })
                .collect()
        })
        .unwrap_or_default()
}

pub async fn list_gateways(client: &Client, namespace: &str) -> Result<Vec<GatewayInfo>, DomainError> {
    let ar = gateway_api_resource("Gateway", "gateways");
    let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &ar);
    let list = match api.list(&ListParams::default()).await {
        Ok(l) => l,
        Err(_) => return Ok(vec![]),
    };

    Ok(list
        .items
        .into_iter()
        .map(|gw| {
            let meta = gw.metadata;
            let data = gw.data;

            let gateway_class = data.get("spec").and_then(|s| s.get("gatewayClassName")).and_then(|v| v.as_str()).unwrap_or("<none>").to_string();
            let listeners = data.get("spec").and_then(|s| s.get("listeners")).and_then(|v| v.as_array()).map(|a| a.len() as i32).unwrap_or(0);
            let addresses = data
                .get("status")
                .and_then(|s| s.get("addresses"))
                .and_then(|v| v.as_array())
                .map(|addrs| addrs.iter().filter_map(|a| a.get("value").and_then(|v| v.as_str())).collect::<Vec<_>>().join(", "))
                .unwrap_or_default();

            GatewayInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                gateway_class,
                addresses: if addresses.is_empty() { "<none>".to_string() } else { addresses },
                listeners,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn get_gateway_detail(
    client: &Client,
    namespace: &str,
    gateway_name: &str,
) -> Result<GatewayDetailInfo, DomainError> {
    let gw_ar = gateway_api_resource("Gateway", "gateways");
    let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &gw_ar);
    let gw = api.get(gateway_name).await?;

    let meta = gw.metadata;
    let data = gw.data;

    let name = meta.name.clone().unwrap_or_default();
    let ns = meta.namespace.clone().unwrap_or_default();

    let created = meta.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339()).unwrap_or_else(|| "Unknown".to_string());
    let labels = meta.labels.unwrap_or_default();
    let annotations = meta.annotations.unwrap_or_default();
    let finalizers = meta.finalizers.unwrap_or_default();

    let controlled_by = meta.owner_references.unwrap_or_default().into_iter().map(|or| OwnerRefInfo { kind: or.kind, name: or.name }).collect();

    let gateway_class = data.get("spec").and_then(|s| s.get("gatewayClassName")).and_then(|v| v.as_str()).unwrap_or("<none>").to_string();

    let addresses: Vec<GatewayAddressInfo> = data
        .get("status").and_then(|s| s.get("addresses")).and_then(|v| v.as_array())
        .map(|addrs| {
            addrs.iter().map(|a| GatewayAddressInfo {
                address_type: a.get("type").and_then(|t| t.as_str()).unwrap_or("IPAddress").to_string(),
                value: a.get("value").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }).collect()
        })
        .unwrap_or_default();

    let listeners: Vec<GatewayListenerInfo> = data
        .get("spec").and_then(|s| s.get("listeners")).and_then(|v| v.as_array())
        .map(|arr| {
            let status_listeners = data.get("status").and_then(|s| s.get("listeners")).and_then(|v| v.as_array()).cloned().unwrap_or_default();

            arr.iter().enumerate().map(|(i, l)| {
                let listener_name = l.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                let status_l = status_listeners.get(i);

                let attached_routes = status_l.and_then(|sl| sl.get("attachedRoutes")).and_then(|v| v.as_i64()).unwrap_or(0) as i32;

                let listener_conditions: Vec<GatewayConditionInfo> = status_l
                    .and_then(|sl| sl.get("conditions")).and_then(|v| v.as_array())
                    .map(|conds| {
                        conds.iter().map(|c| GatewayConditionInfo {
                            condition_type: c.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string(),
                            status: c.get("status").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                            reason: c.get("reason").and_then(|r| r.as_str()).unwrap_or("").to_string(),
                            message: c.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string(),
                        }).collect()
                    })
                    .unwrap_or_default();

                let tls_mode = l.get("tls").and_then(|t| t.get("mode")).and_then(|m| m.as_str()).unwrap_or("").to_string();
                let tls_certificate_refs: Vec<String> = l
                    .get("tls").and_then(|t| t.get("certificateRefs")).and_then(|v| v.as_array())
                    .map(|refs| {
                        refs.iter().map(|r| {
                            let kind = r.get("kind").and_then(|k| k.as_str()).unwrap_or("Secret");
                            let name = r.get("name").and_then(|n| n.as_str()).unwrap_or("");
                            format!("{}/{}", kind, name)
                        }).collect()
                    })
                    .unwrap_or_default();

                let allowed_routes = l.get("allowedRoutes").and_then(|ar| ar.get("namespaces")).and_then(|ns| ns.get("from")).and_then(|f| f.as_str()).unwrap_or("Same").to_string();

                GatewayListenerInfo {
                    name: listener_name,
                    protocol: l.get("protocol").and_then(|p| p.as_str()).unwrap_or("").to_string(),
                    port: l.get("port").and_then(|p| p.as_i64()).unwrap_or(0) as i32,
                    hostname: l.get("hostname").and_then(|h| h.as_str()).unwrap_or("*").to_string(),
                    tls_mode,
                    tls_certificate_refs,
                    allowed_routes,
                    attached_routes,
                    conditions: listener_conditions,
                }
            }).collect()
        })
        .unwrap_or_default();

    let conditions: Vec<GatewayConditionInfo> = data
        .get("status").and_then(|s| s.get("conditions")).and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().map(|c| GatewayConditionInfo {
                condition_type: c.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string(),
                status: c.get("status").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                reason: c.get("reason").and_then(|r| r.as_str()).unwrap_or("").to_string(),
                message: c.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string(),
            }).collect()
        })
        .unwrap_or_default();

    // Fetch HTTPRoutes
    let httproute_ar = gateway_api_resource("HTTPRoute", "httproutes");
    let httproute_api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &httproute_ar);
    let http_routes_list = httproute_api.list(&ListParams::default()).await.unwrap_or_else(|_| kube::api::ObjectList {
        types: Default::default(), metadata: Default::default(), items: vec![],
    });
    let http_routes = extract_routes_for_gateway(http_routes_list.items, &name, &ns);

    // Fetch GRPCRoutes
    let grpcroute_ar = gateway_api_resource("GRPCRoute", "grpcroutes");
    let grpcroute_api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &grpcroute_ar);
    let grpc_routes_list = grpcroute_api.list(&ListParams::default()).await.unwrap_or_else(|_| kube::api::ObjectList {
        types: Default::default(), metadata: Default::default(), items: vec![],
    });
    let grpc_routes = extract_routes_for_gateway(grpc_routes_list.items, &name, &ns);

    let events = crate::infrastructure::kubernetes::helpers::fetch_events_for(client, namespace, &name, "Gateway").await;

    Ok(GatewayDetailInfo {
        name, namespace: ns, created, labels, annotations, finalizers, controlled_by,
        gateway_class, addresses, listeners, conditions, http_routes, grpc_routes, events,
    })
}

pub async fn get_httproute_detail(
    client: &Client,
    namespace: &str,
    route_name: &str,
) -> Result<HTTPRouteDetailInfo, DomainError> {
    let ar = gateway_api_resource("HTTPRoute", "httproutes");
    let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &ar);
    let route = api.get(route_name).await?;

    let meta = route.metadata;
    let data = route.data;

    let name = meta.name.clone().unwrap_or_default();
    let ns = meta.namespace.clone().unwrap_or_default();

    let created = meta.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339()).unwrap_or_else(|| "Unknown".to_string());
    let labels = meta.labels.unwrap_or_default();
    let annotations = meta.annotations.unwrap_or_default();

    let controlled_by = meta.owner_references.unwrap_or_default().into_iter().map(|or| OwnerRefInfo { kind: or.kind, name: or.name }).collect();
    let parent_refs = extract_parent_refs(&data);

    let hostnames: Vec<String> = data.get("spec").and_then(|s| s.get("hostnames")).and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|h| h.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let rules: Vec<HTTPRouteRuleInfo> = data.get("spec").and_then(|s| s.get("rules")).and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().map(|rule| {
                let matches: Vec<HTTPRouteMatchInfo> = rule.get("matches").and_then(|v| v.as_array())
                    .map(|m_arr| {
                        m_arr.iter().map(|m| {
                            HTTPRouteMatchInfo {
                                path_type: m.get("path").and_then(|p| p.get("type")).and_then(|t| t.as_str()).unwrap_or("PathPrefix").to_string(),
                                path_value: m.get("path").and_then(|p| p.get("value")).and_then(|v| v.as_str()).unwrap_or("/").to_string(),
                                method: m.get("method").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                headers: m.get("headers").and_then(|v| v.as_array())
                                    .map(|h_arr| {
                                        h_arr.iter().map(|h| {
                                            let hn = h.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                            let hv = h.get("value").and_then(|v| v.as_str()).unwrap_or("");
                                            let ht = h.get("type").and_then(|t| t.as_str()).unwrap_or("Exact");
                                            format!("{}: {} ({})", hn, hv, ht)
                                        }).collect()
                                    })
                                    .unwrap_or_default(),
                            }
                        }).collect()
                    })
                    .unwrap_or_default();

                let backend_refs = extract_backend_refs(rule);
                let filters: Vec<String> = rule.get("filters").and_then(|v| v.as_array())
                    .map(|f_arr| f_arr.iter().map(|f| f.get("type").and_then(|t| t.as_str()).unwrap_or("Unknown").to_string()).collect())
                    .unwrap_or_default();

                HTTPRouteRuleInfo { matches, backend_refs, filters }
            }).collect()
        })
        .unwrap_or_default();

    let conditions = extract_route_conditions(&data);
    let events = crate::infrastructure::kubernetes::helpers::fetch_events_for(client, namespace, &name, "HTTPRoute").await;

    Ok(HTTPRouteDetailInfo {
        name, namespace: ns, created, labels, annotations, controlled_by,
        parent_refs, hostnames, rules, conditions, events,
    })
}

pub async fn get_grpcroute_detail(
    client: &Client,
    namespace: &str,
    route_name: &str,
) -> Result<GRPCRouteDetailInfo, DomainError> {
    let ar = gateway_api_resource("GRPCRoute", "grpcroutes");
    let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &ar);
    let route = api.get(route_name).await?;

    let meta = route.metadata;
    let data = route.data;

    let name = meta.name.clone().unwrap_or_default();
    let ns = meta.namespace.clone().unwrap_or_default();

    let created = meta.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339()).unwrap_or_else(|| "Unknown".to_string());
    let labels = meta.labels.unwrap_or_default();
    let annotations = meta.annotations.unwrap_or_default();

    let controlled_by = meta.owner_references.unwrap_or_default().into_iter().map(|or| OwnerRefInfo { kind: or.kind, name: or.name }).collect();
    let parent_refs = extract_parent_refs(&data);

    let hostnames: Vec<String> = data.get("spec").and_then(|s| s.get("hostnames")).and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|h| h.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let rules: Vec<GRPCRouteRuleInfo> = data.get("spec").and_then(|s| s.get("rules")).and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().map(|rule| {
                let matches: Vec<GRPCRouteMatchInfo> = rule.get("matches").and_then(|v| v.as_array())
                    .map(|m_arr| {
                        m_arr.iter().map(|m| {
                            let method = m.get("method").unwrap_or(&serde_json::Value::Null);
                            GRPCRouteMatchInfo {
                                method_service: method.get("service").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                                method_method: method.get("method").and_then(|m| m.as_str()).unwrap_or("").to_string(),
                                match_type: method.get("type").and_then(|t| t.as_str()).unwrap_or("Exact").to_string(),
                                headers: m.get("headers").and_then(|v| v.as_array())
                                    .map(|h_arr| {
                                        h_arr.iter().map(|h| {
                                            let hn = h.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                            let hv = h.get("value").and_then(|v| v.as_str()).unwrap_or("");
                                            format!("{}: {}", hn, hv)
                                        }).collect()
                                    })
                                    .unwrap_or_default(),
                            }
                        }).collect()
                    })
                    .unwrap_or_default();

                let backend_refs = extract_backend_refs(rule);
                GRPCRouteRuleInfo { matches, backend_refs }
            }).collect()
        })
        .unwrap_or_default();

    let conditions = extract_route_conditions(&data);
    let events = crate::infrastructure::kubernetes::helpers::fetch_events_for(client, namespace, &name, "GRPCRoute").await;

    Ok(GRPCRouteDetailInfo {
        name, namespace: ns, created, labels, annotations, controlled_by,
        parent_refs, hostnames, rules, conditions, events,
    })
}
