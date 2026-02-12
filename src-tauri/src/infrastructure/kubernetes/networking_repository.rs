use k8s_openapi::api::core::v1::Service;
use k8s_openapi::api::networking::v1::Ingress;
use kube::{api::ListParams, Api, Client};

use crate::application::services::formatting::format_age;
use crate::domain::entities::common::OwnerRefInfo;
use crate::domain::entities::networking::*;
use crate::domain::errors::DomainError;

pub async fn list_services(client: &Client, namespace: &str) -> Result<Vec<ServiceInfo>, DomainError> {
    let api: Api<Service> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|svc| {
            let meta = svc.metadata;
            let spec = svc.spec.unwrap_or_default();

            let ports = spec
                .ports
                .unwrap_or_default()
                .iter()
                .map(|p| {
                    if let Some(np) = p.node_port {
                        format!("{}:{}/{}", p.port, np, p.protocol.clone().unwrap_or_else(|| "TCP".to_string()))
                    } else {
                        format!("{}/{}", p.port, p.protocol.clone().unwrap_or_else(|| "TCP".to_string()))
                    }
                })
                .collect::<Vec<_>>()
                .join(", ");

            let external_ips = spec.external_ips.unwrap_or_default().join(", ");
            let external = if external_ips.is_empty() {
                spec.load_balancer_ip.unwrap_or_else(|| "<none>".to_string())
            } else {
                external_ips
            };

            ServiceInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                service_type: spec.type_.unwrap_or_else(|| "ClusterIP".to_string()),
                cluster_ip: spec.cluster_ip.unwrap_or_else(|| "None".to_string()),
                external_ip: external,
                ports,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_ingresses(client: &Client, namespace: &str) -> Result<Vec<IngressInfo>, DomainError> {
    let api: Api<Ingress> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|ing| {
            let meta = ing.metadata;
            let spec = ing.spec.unwrap_or_default();
            let status = ing.status.unwrap_or_default();

            let class = spec.ingress_class_name.unwrap_or_else(|| "<none>".to_string());

            let hosts: Vec<String> = spec
                .rules
                .unwrap_or_default()
                .iter()
                .filter_map(|r| r.host.clone())
                .collect();

            let address = status
                .load_balancer
                .and_then(|lb| lb.ingress)
                .unwrap_or_default()
                .iter()
                .filter_map(|i| i.ip.clone().or_else(|| i.hostname.clone()))
                .collect::<Vec<_>>()
                .join(", ");

            let tls = spec.tls.unwrap_or_default();
            let ports = if tls.is_empty() {
                "80".to_string()
            } else {
                "80, 443".to_string()
            };

            IngressInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                class,
                hosts: if hosts.is_empty() { "*".to_string() } else { hosts.join(", ") },
                address: if address.is_empty() { "<pending>".to_string() } else { address },
                ports,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn get_ingress_detail(
    client: &Client,
    namespace: &str,
    ingress_name: &str,
) -> Result<IngressDetailInfo, DomainError> {
    let api: Api<Ingress> = Api::namespaced(client.clone(), namespace);
    let ing = api.get(ingress_name).await?;

    let meta = ing.metadata;
    let spec = ing.spec.unwrap_or_default();
    let status = ing.status.unwrap_or_default();

    let name = meta.name.clone().unwrap_or_default();
    let ns = meta.namespace.clone().unwrap_or_default();

    let created = meta
        .creation_timestamp
        .as_ref()
        .map(|t| t.0.to_rfc3339())
        .unwrap_or_else(|| "Unknown".to_string());

    let labels = meta.labels.unwrap_or_default();
    let annotations = meta.annotations.unwrap_or_default();

    let controlled_by = meta
        .owner_references
        .unwrap_or_default()
        .into_iter()
        .map(|or| OwnerRefInfo { kind: or.kind, name: or.name })
        .collect();

    let class = spec.ingress_class_name.unwrap_or_else(|| "<none>".to_string());

    let default_backend = spec
        .default_backend
        .as_ref()
        .and_then(|b| {
            b.service.as_ref().map(|svc| {
                let port = svc
                    .port
                    .as_ref()
                    .map(|p| {
                        p.number
                            .map(|n| n.to_string())
                            .or_else(|| p.name.clone())
                            .unwrap_or_default()
                    })
                    .unwrap_or_default();
                format!("{}:{}", svc.name, port)
            })
        })
        .unwrap_or_else(|| "<none>".to_string());

    let rules: Vec<IngressRuleInfo> = spec
        .rules
        .unwrap_or_default()
        .into_iter()
        .map(|rule| {
            let host = rule.host.unwrap_or_else(|| "*".to_string());
            let paths = rule
                .http
                .map(|http| {
                    http.paths
                        .into_iter()
                        .map(|p| {
                            let backend_service = p.backend.service.as_ref().map(|s| s.name.clone()).unwrap_or_default();
                            let backend_port = p
                                .backend
                                .service
                                .as_ref()
                                .and_then(|s| {
                                    s.port.as_ref().map(|port| {
                                        port.number
                                            .map(|n| n.to_string())
                                            .or_else(|| port.name.clone())
                                            .unwrap_or_default()
                                    })
                                })
                                .unwrap_or_default();
                            IngressPathInfo {
                                path: p.path.unwrap_or_else(|| "/".to_string()),
                                path_type: p.path_type,
                                backend_service,
                                backend_port,
                            }
                        })
                        .collect()
                })
                .unwrap_or_default();
            IngressRuleInfo { host, paths }
        })
        .collect();

    let tls: Vec<IngressTlsInfo> = spec
        .tls
        .unwrap_or_default()
        .into_iter()
        .map(|t| IngressTlsInfo {
            hosts: t.hosts.unwrap_or_default(),
            secret_name: t.secret_name.unwrap_or_default(),
        })
        .collect();

    let addresses: Vec<String> = status
        .load_balancer
        .and_then(|lb| lb.ingress)
        .unwrap_or_default()
        .iter()
        .filter_map(|i| i.ip.clone().or_else(|| i.hostname.clone()))
        .collect();

    let events = crate::infrastructure::kubernetes::helpers::fetch_events_for(client, namespace, &name, "Ingress").await;

    Ok(IngressDetailInfo {
        name,
        namespace: ns,
        created,
        labels,
        annotations,
        controlled_by,
        class,
        default_backend,
        rules,
        tls,
        addresses,
        events,
    })
}
