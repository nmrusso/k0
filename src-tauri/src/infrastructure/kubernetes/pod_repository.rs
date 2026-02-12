use k8s_openapi::api::apps::v1::ReplicaSet;
use k8s_openapi::api::core::v1::Pod;
use k8s_openapi::api::events::v1::Event;
use kube::{api::ListParams, Api, Client};
use std::collections::HashMap;

use crate::application::services::formatting::{format_age, format_probe};
use crate::domain::entities::common::{EventInfo, OwnerRefInfo};
use crate::domain::entities::pod::*;
use crate::domain::errors::DomainError;

/// Build a map from ReplicaSet name -> (owner_kind, owner_name) for Deployment resolution.
pub async fn build_rs_to_deployment_map(
    client: &Client,
    namespace: &str,
) -> HashMap<String, (String, String)> {
    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let rs_list = match rs_api.list(&ListParams::default()).await {
        Ok(l) => l,
        Err(_) => return HashMap::new(),
    };

    let mut rs_map = HashMap::new();
    for rs in rs_list.items {
        let rs_name = rs.metadata.name.clone().unwrap_or_default();
        if let Some(owners) = rs.metadata.owner_references {
            for oref in &owners {
                if oref.kind == "Deployment" {
                    rs_map.insert(rs_name.clone(), ("Deployment".to_string(), oref.name.clone()));
                    break;
                }
            }
        }
    }
    rs_map
}

/// Convert a Pod into PodInfo, resolving workload owner via rs_map.
pub fn pod_to_pod_info(pod: &Pod, rs_map: &HashMap<String, (String, String)>) -> PodInfo {
    let meta = &pod.metadata;
    let spec = pod.spec.as_ref();
    let status = pod.status.as_ref();

    let phase = if meta.deletion_timestamp.is_some() {
        "Terminating".to_string()
    } else {
        status
            .and_then(|s| s.phase.clone())
            .unwrap_or_else(|| "Unknown".to_string())
    };

    let container_statuses = status
        .and_then(|s| s.container_statuses.as_ref())
        .map(|v| v.as_slice())
        .unwrap_or_default();
    let total = container_statuses.len();
    let ready_count = container_statuses.iter().filter(|cs| cs.ready).count();
    let restarts: i32 = container_statuses.iter().map(|cs| cs.restart_count).sum();

    // Resolve workload owner
    let mut workload_kind = String::new();
    let mut workload_name = String::new();
    if let Some(owners) = &meta.owner_references {
        for oref in owners {
            match oref.kind.as_str() {
                "ReplicaSet" => {
                    if let Some((dk, dn)) = rs_map.get(&oref.name) {
                        workload_kind = dk.clone();
                        workload_name = dn.clone();
                    } else {
                        workload_kind = "ReplicaSet".to_string();
                        workload_name = oref.name.clone();
                    }
                    break;
                }
                "StatefulSet" | "DaemonSet" | "Job" => {
                    workload_kind = oref.kind.clone();
                    workload_name = oref.name.clone();
                    break;
                }
                _ => {}
            }
        }
    }

    PodInfo {
        name: meta.name.clone().unwrap_or_default(),
        namespace: meta.namespace.clone().unwrap_or_default(),
        status: phase,
        ready: format!("{}/{}", ready_count, total),
        restarts,
        age: format_age(meta.creation_timestamp.as_ref()),
        node: spec.and_then(|s| s.node_name.clone()).unwrap_or_default(),
        ip: status.and_then(|s| s.pod_ip.clone()).unwrap_or_default(),
        workload_kind,
        workload_name,
    }
}

pub async fn list_pods(client: &Client, namespace: &str) -> Result<Vec<PodInfo>, DomainError> {
    let api: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let rs_map = build_rs_to_deployment_map(client, namespace).await;
    let list = api.list(&ListParams::default()).await?;

    Ok(list.items.iter().map(|pod| pod_to_pod_info(pod, &rs_map)).collect())
}

pub async fn delete_pod(client: &Client, namespace: &str, pod_name: &str) -> Result<(), DomainError> {
    let api: Api<Pod> = Api::namespaced(client.clone(), namespace);
    api.delete(pod_name, &Default::default()).await?;
    Ok(())
}

pub async fn get_pod_detail(
    client: &Client,
    namespace: &str,
    pod_name: &str,
) -> Result<PodDetailInfo, DomainError> {
    let api: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let pod = api.get(pod_name).await?;

    let meta = pod.metadata;
    let spec = pod.spec.unwrap_or_default();
    let status = pod.status.unwrap_or_default();

    let name = meta.name.clone().unwrap_or_default();
    let ns = meta.namespace.clone().unwrap_or_default();

    let created = meta
        .creation_timestamp
        .as_ref()
        .map(|t| t.0.to_rfc3339())
        .unwrap_or_else(|| "Unknown".to_string());

    let labels = meta.labels.unwrap_or_default();
    let annotations = meta.annotations.unwrap_or_default();

    let owner_refs = meta.owner_references.unwrap_or_default();
    let controlled_by: Vec<OwnerRefInfo> = owner_refs
        .iter()
        .map(|or| OwnerRefInfo {
            kind: or.kind.clone(),
            name: or.name.clone(),
        })
        .collect();

    // Resolve workload owner
    let workload_owner = {
        let mut result: Option<OwnerRefInfo> = None;
        for oref in &owner_refs {
            match oref.kind.as_str() {
                "Deployment" | "StatefulSet" | "DaemonSet" => {
                    result = Some(OwnerRefInfo {
                        kind: oref.kind.clone(),
                        name: oref.name.clone(),
                    });
                    break;
                }
                "ReplicaSet" => {
                    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
                    if let Ok(rs) = rs_api.get(&oref.name).await {
                        if let Some(rs_owners) = rs.metadata.owner_references {
                            for rs_oref in &rs_owners {
                                if rs_oref.kind == "Deployment" {
                                    result = Some(OwnerRefInfo {
                                        kind: rs_oref.kind.clone(),
                                        name: rs_oref.name.clone(),
                                    });
                                    break;
                                }
                            }
                        }
                    }
                    break;
                }
                _ => {}
            }
        }
        result
    };

    let phase = status.phase.clone().unwrap_or_else(|| "Unknown".to_string());

    let pod_ips: Vec<String> = status
        .pod_ips
        .unwrap_or_default()
        .into_iter()
        .map(|pip| pip.ip)
        .collect();

    let conditions: Vec<PodConditionInfo> = status
        .conditions
        .unwrap_or_default()
        .into_iter()
        .map(|c| PodConditionInfo {
            condition_type: c.type_,
            status: c.status,
        })
        .collect();

    let tolerations: Vec<TolerationInfo> = spec
        .tolerations
        .unwrap_or_default()
        .into_iter()
        .map(|t| TolerationInfo {
            key: t.key.unwrap_or_default(),
            operator: t.operator.unwrap_or_default(),
            value: t.value.unwrap_or_default(),
            effect: t.effect.unwrap_or_default(),
        })
        .collect();

    let volumes: Vec<VolumeInfo> = spec
        .volumes
        .unwrap_or_default()
        .into_iter()
        .map(|v| {
            let (vtype, source, sources) = if v.secret.is_some() {
                ("Secret".to_string(), v.secret.unwrap().secret_name.unwrap_or_default(), vec![])
            } else if v.config_map.is_some() {
                ("ConfigMap".to_string(), v.config_map.unwrap().name, vec![])
            } else if v.persistent_volume_claim.is_some() {
                ("PVC".to_string(), v.persistent_volume_claim.unwrap().claim_name, vec![])
            } else if v.empty_dir.is_some() {
                ("EmptyDir".to_string(), String::new(), vec![])
            } else if v.host_path.is_some() {
                ("HostPath".to_string(), v.host_path.unwrap().path, vec![])
            } else if v.projected.is_some() {
                let proj = v.projected.unwrap();
                let proj_sources = proj.sources.unwrap_or_default();
                let count = proj_sources.len();
                let parsed: Vec<VolumeSourceInfo> = proj_sources.into_iter().map(|s| {
                    if let Some(sa) = s.service_account_token {
                        VolumeSourceInfo {
                            source_type: "ServiceAccountToken".to_string(),
                            name: String::new(),
                            detail: format!("expirationSeconds: {}", sa.expiration_seconds.unwrap_or(3600)),
                        }
                    } else if let Some(cm) = s.config_map {
                        VolumeSourceInfo {
                            source_type: "ConfigMap".to_string(),
                            name: cm.name,
                            detail: cm.items.map(|items| items.iter().map(|i| i.key.clone()).collect::<Vec<_>>().join(", ")).unwrap_or_default(),
                        }
                    } else if s.downward_api.is_some() {
                        VolumeSourceInfo {
                            source_type: "DownwardAPI".to_string(),
                            name: String::new(),
                            detail: String::new(),
                        }
                    } else if let Some(secret) = s.secret {
                        VolumeSourceInfo {
                            source_type: "Secret".to_string(),
                            name: secret.name,
                            detail: secret.items.map(|items| items.iter().map(|i| i.key.clone()).collect::<Vec<_>>().join(", ")).unwrap_or_default(),
                        }
                    } else {
                        VolumeSourceInfo {
                            source_type: "Unknown".to_string(),
                            name: String::new(),
                            detail: String::new(),
                        }
                    }
                }).collect();
                ("Projected".to_string(), format!("{} sources", count), parsed)
            } else if v.downward_api.is_some() {
                ("DownwardAPI".to_string(), String::new(), vec![])
            } else {
                ("Other".to_string(), String::new(), vec![])
            };
            VolumeInfo {
                name: v.name,
                volume_type: vtype,
                source,
                sources,
            }
        })
        .collect();

    let container_statuses = status.container_statuses.unwrap_or_default();
    let containers: Vec<ContainerDetailInfo> = spec
        .containers
        .into_iter()
        .map(|c| {
            let cs = container_statuses
                .iter()
                .find(|cs| cs.name == c.name);

            let (c_status, c_ready, c_restarts) = match cs {
                Some(cs) => {
                    let st = if let Some(running) = &cs.state.as_ref().and_then(|s| s.running.as_ref()) {
                        format!("running, started {}", running.started_at.as_ref().map(|t| format_age(Some(t))).unwrap_or_default())
                    } else if let Some(waiting) = &cs.state.as_ref().and_then(|s| s.waiting.as_ref()) {
                        format!("waiting: {}", waiting.reason.clone().unwrap_or_default())
                    } else if let Some(terminated) = &cs.state.as_ref().and_then(|s| s.terminated.as_ref()) {
                        format!("terminated: {}", terminated.reason.clone().unwrap_or_default())
                    } else {
                        "unknown".to_string()
                    };
                    let ready_str = if cs.ready { "ready" } else { "not ready" };
                    (format!("{}, {}", st, ready_str), cs.ready, cs.restart_count)
                }
                None => ("Pending".to_string(), false, 0),
            };

            let ports: Vec<String> = c
                .ports
                .unwrap_or_default()
                .into_iter()
                .map(|p| {
                    format!(
                        "{}/{}",
                        p.container_port,
                        p.protocol.unwrap_or_else(|| "TCP".to_string())
                    )
                })
                .collect();

            // Map env vars
            let mut env_vars: Vec<EnvVarInfo> = Vec::new();
            for ev in c.env.unwrap_or_default() {
                if let Some(vf) = &ev.value_from {
                    if let Some(secret_ref) = &vf.secret_key_ref {
                        env_vars.push(EnvVarInfo {
                            name: ev.name,
                            value: String::new(),
                            source: "secret".to_string(),
                            source_name: secret_ref.name.clone(),
                            source_key: secret_ref.key.clone(),
                        });
                    } else if let Some(cm_ref) = &vf.config_map_key_ref {
                        env_vars.push(EnvVarInfo {
                            name: ev.name,
                            value: String::new(),
                            source: "configMap".to_string(),
                            source_name: cm_ref.name.clone(),
                            source_key: cm_ref.key.clone(),
                        });
                    } else if let Some(field_ref) = &vf.field_ref {
                        env_vars.push(EnvVarInfo {
                            name: ev.name,
                            value: field_ref.field_path.clone(),
                            source: "fieldRef".to_string(),
                            source_name: String::new(),
                            source_key: String::new(),
                        });
                    } else if let Some(res_ref) = &vf.resource_field_ref {
                        env_vars.push(EnvVarInfo {
                            name: ev.name,
                            value: res_ref.resource.clone(),
                            source: "resourceFieldRef".to_string(),
                            source_name: String::new(),
                            source_key: String::new(),
                        });
                    } else {
                        env_vars.push(EnvVarInfo {
                            name: ev.name,
                            value: String::new(),
                            source: "plain".to_string(),
                            source_name: String::new(),
                            source_key: String::new(),
                        });
                    }
                } else {
                    env_vars.push(EnvVarInfo {
                        name: ev.name,
                        value: ev.value.unwrap_or_default(),
                        source: "plain".to_string(),
                        source_name: String::new(),
                        source_key: String::new(),
                    });
                }
            }
            // Map envFrom sources
            for ef in c.env_from.unwrap_or_default() {
                if let Some(secret_ref) = &ef.secret_ref {
                    env_vars.push(EnvVarInfo {
                        name: format!("{}(all keys)", ef.prefix.clone().unwrap_or_default()),
                        value: String::new(),
                        source: "secret".to_string(),
                        source_name: secret_ref.name.clone(),
                        source_key: String::new(),
                    });
                } else if let Some(cm_ref) = &ef.config_map_ref {
                    env_vars.push(EnvVarInfo {
                        name: format!("{}(all keys)", ef.prefix.clone().unwrap_or_default()),
                        value: String::new(),
                        source: "configMap".to_string(),
                        source_name: cm_ref.name.clone(),
                        source_key: String::new(),
                    });
                }
            }

            // Map volume mounts
            let mounts: Vec<MountInfo> = c
                .volume_mounts
                .unwrap_or_default()
                .into_iter()
                .map(|vm| MountInfo {
                    name: vm.name,
                    mount_path: vm.mount_path,
                    read_only: vm.read_only.unwrap_or(false),
                    sub_path: vm.sub_path.unwrap_or_default(),
                })
                .collect();

            let resources = c.resources.unwrap_or_default();
            let requests = resources.requests.unwrap_or_default();
            let limits = resources.limits.unwrap_or_default();

            ContainerDetailInfo {
                name: c.name,
                image: c.image.unwrap_or_default(),
                status: c_status,
                ready: c_ready,
                restart_count: c_restarts,
                ports,
                env_vars,
                mounts,
                liveness: c.liveness_probe.as_ref().map(format_probe),
                readiness: c.readiness_probe.as_ref().map(format_probe),
                command: c.command.unwrap_or_default(),
                args: c.args.unwrap_or_default(),
                requests_cpu: requests.get("cpu").map(|q| q.0.clone()).unwrap_or_default(),
                requests_memory: requests.get("memory").map(|q| q.0.clone()).unwrap_or_default(),
                limits_cpu: limits.get("cpu").map(|q| q.0.clone()).unwrap_or_default(),
                limits_memory: limits.get("memory").map(|q| q.0.clone()).unwrap_or_default(),
            }
        })
        .collect();

    // Fetch events for this pod
    let events_api: Api<Event> = Api::namespaced(client.clone(), namespace);
    let events_lp = ListParams::default()
        .fields(&format!("regarding.name={},regarding.kind=Pod", name));
    let events_list = events_api.list(&events_lp).await.unwrap_or_else(|_| kube::api::ObjectList {
        types: Default::default(),
        metadata: Default::default(),
        items: vec![],
    });

    let events: Vec<EventInfo> = events_list
        .items
        .into_iter()
        .map(|e| {
            let count = e.deprecated_count.unwrap_or(1);
            EventInfo {
                reason: e.reason.unwrap_or_default(),
                message: e.note.unwrap_or_default(),
                count,
                age: format_age(e.metadata.creation_timestamp.as_ref()),
                event_type: e.type_.unwrap_or_else(|| "Normal".to_string()),
            }
        })
        .collect();

    Ok(PodDetailInfo {
        name,
        namespace: ns,
        created,
        labels,
        annotations,
        controlled_by,
        workload_owner,
        status: phase,
        node: spec.node_name.unwrap_or_default(),
        pod_ip: status.pod_ip.unwrap_or_default(),
        pod_ips,
        service_account: spec.service_account_name.unwrap_or_default(),
        qos_class: status
            .qos_class
            .unwrap_or_else(|| "BestEffort".to_string()),
        conditions,
        tolerations,
        volumes,
        containers,
        events,
    })
}

pub async fn get_image_history(
    client: &Client,
    namespace: &str,
    owner_kind: &str,
    owner_name: &str,
    container_name: &str,
) -> Result<Vec<ImageHistoryEntry>, DomainError> {
    if owner_kind != "Deployment" {
        return Ok(vec![]);
    }

    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let rs_list = rs_api.list(&ListParams::default()).await?;

    let mut entries: Vec<ImageHistoryEntry> = Vec::new();

    for rs in &rs_list.items {
        let meta = &rs.metadata;
        let owner_refs = meta.owner_references.as_deref().unwrap_or_default();
        let is_owned = owner_refs
            .iter()
            .any(|r| r.kind == "Deployment" && r.name == owner_name);
        if !is_owned {
            continue;
        }

        let revision = meta
            .annotations
            .as_ref()
            .and_then(|a| a.get("deployment.kubernetes.io/revision"))
            .cloned()
            .unwrap_or_default();

        let image = rs
            .spec
            .as_ref()
            .and_then(|s| s.template.as_ref())
            .and_then(|t| t.spec.as_ref())
            .and_then(|ps| {
                ps.containers
                    .iter()
                    .find(|c| c.name == container_name)
                    .and_then(|c| c.image.clone())
            })
            .unwrap_or_default();

        if image.is_empty() {
            continue;
        }

        let age = format_age(meta.creation_timestamp.as_ref());

        entries.push(ImageHistoryEntry {
            revision,
            image,
            age,
            current: false,
        });
    }

    // Sort by revision descending
    entries.sort_by(|a, b| {
        let ra: i64 = a.revision.parse().unwrap_or(0);
        let rb: i64 = b.revision.parse().unwrap_or(0);
        rb.cmp(&ra)
    });

    if let Some(first) = entries.first_mut() {
        first.current = true;
    }

    Ok(entries)
}
