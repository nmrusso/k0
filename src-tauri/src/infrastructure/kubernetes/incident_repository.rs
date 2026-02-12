use chrono::Utc;
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::autoscaling::v1::HorizontalPodAutoscaler;
use k8s_openapi::api::core::v1::Pod;
use k8s_openapi::api::events::v1::Event;
use k8s_openapi::api::networking::v1::Ingress;
use kube::{api::ListParams, Api, Client};
use std::collections::{HashMap, HashSet};

use crate::application::services::formatting::format_age;
use crate::domain::entities::incident::*;
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::helpers::fetch_events_for;

pub async fn fetch_namespace_events(
    client: &Client,
    namespace: &str,
    since_minutes: Option<u32>,
) -> Result<Vec<NamespaceEventInfo>, DomainError> {
    let events_api: Api<Event> = Api::namespaced(client.clone(), namespace);
    let events_list = events_api.list(&ListParams::default()).await?;

    let cutoff = since_minutes.map(|m| Utc::now() - chrono::Duration::minutes(m as i64));

    let mut results: Vec<NamespaceEventInfo> = Vec::new();
    for e in events_list.items {
        let event_time = e
            .event_time
            .as_ref()
            .map(|t| t.0)
            .or_else(|| e.metadata.creation_timestamp.as_ref().map(|t| t.0));

        if let Some(cutoff_time) = cutoff {
            if let Some(et) = event_time {
                if et < cutoff_time {
                    continue;
                }
            }
        }

        let regarding = e.regarding.as_ref();
        results.push(NamespaceEventInfo {
            involved_kind: regarding
                .and_then(|r| r.kind.clone())
                .unwrap_or_default(),
            involved_name: regarding
                .and_then(|r| r.name.clone())
                .unwrap_or_default(),
            reason: e.reason.unwrap_or_default(),
            message: e.note.unwrap_or_default(),
            count: e.deprecated_count.unwrap_or(1),
            event_type: e.type_.unwrap_or_else(|| "Normal".to_string()),
            timestamp: event_time
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            age: format_age(e.metadata.creation_timestamp.as_ref()),
        });
    }

    results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(results)
}

pub async fn find_unhealthy_workloads(
    client: &Client,
    namespace: &str,
) -> Result<Vec<UnhealthyWorkload>, DomainError> {
    let mut unhealthy: Vec<UnhealthyWorkload> = Vec::new();

    // Check Deployments
    let dep_api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let deps = dep_api.list(&ListParams::default()).await?;
    for dep in &deps.items {
        let name = dep.metadata.name.clone().unwrap_or_default();
        let spec = dep.spec.as_ref();
        let status = dep.status.as_ref();
        let desired = spec.and_then(|s| s.replicas).unwrap_or(1);
        let ready = status.and_then(|s| s.ready_replicas).unwrap_or(0);

        if ready < desired {
            let events = fetch_events_for(client, namespace, &name, "Deployment").await;
            unhealthy.push(UnhealthyWorkload {
                name: name.clone(),
                kind: "Deployment".to_string(),
                ready: format!("{}/{}", ready, desired),
                restart_count: 0,
                pod_errors: vec![],
                events,
            });
        }
    }

    // Check StatefulSets
    let ss_api: Api<StatefulSet> = Api::namespaced(client.clone(), namespace);
    let ssets = ss_api.list(&ListParams::default()).await?;
    for ss in &ssets.items {
        let name = ss.metadata.name.clone().unwrap_or_default();
        let desired = ss.spec.as_ref().and_then(|s| s.replicas).unwrap_or(1);
        let ready = ss.status.as_ref().and_then(|s| s.ready_replicas).unwrap_or(0);

        if ready < desired {
            let events = fetch_events_for(client, namespace, &name, "StatefulSet").await;
            unhealthy.push(UnhealthyWorkload {
                name: name.clone(),
                kind: "StatefulSet".to_string(),
                ready: format!("{}/{}", ready, desired),
                restart_count: 0,
                pod_errors: vec![],
                events,
            });
        }
    }

    // Check DaemonSets
    let ds_api: Api<DaemonSet> = Api::namespaced(client.clone(), namespace);
    let dsets = ds_api.list(&ListParams::default()).await?;
    for ds in &dsets.items {
        let name = ds.metadata.name.clone().unwrap_or_default();
        let status = ds.status.as_ref();
        let desired = status.map(|s| s.desired_number_scheduled).unwrap_or(0);
        let ready = status.map(|s| s.number_ready).unwrap_or(0);

        if ready < desired {
            let events = fetch_events_for(client, namespace, &name, "DaemonSet").await;
            unhealthy.push(UnhealthyWorkload {
                name: name.clone(),
                kind: "DaemonSet".to_string(),
                ready: format!("{}/{}", ready, desired),
                restart_count: 0,
                pod_errors: vec![],
                events,
            });
        }
    }

    // Enrich with pod-level errors and restart counts
    let pod_api: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let pods = pod_api.list(&ListParams::default()).await?;

    // Build RS -> Deployment map
    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let rs_list = rs_api.list(&ListParams::default()).await?;
    let mut rs_to_dep: HashMap<String, String> = HashMap::new();
    for rs in &rs_list.items {
        let rs_name = rs.metadata.name.clone().unwrap_or_default();
        if let Some(owners) = &rs.metadata.owner_references {
            for oref in owners {
                if oref.kind == "Deployment" {
                    rs_to_dep.insert(rs_name.clone(), oref.name.clone());
                    break;
                }
            }
        }
    }

    for pod in &pods.items {
        let pod_name = pod.metadata.name.clone().unwrap_or_default();
        let container_statuses = pod
            .status
            .as_ref()
            .and_then(|s| s.container_statuses.as_ref())
            .map(|v| v.as_slice())
            .unwrap_or_default();

        let restarts: i32 = container_statuses.iter().map(|cs| cs.restart_count).sum();

        let mut pod_errors: Vec<String> = Vec::new();
        for cs in container_statuses {
            if let Some(state) = &cs.state {
                if let Some(waiting) = &state.waiting {
                    let reason = waiting.reason.clone().unwrap_or_default();
                    if matches!(
                        reason.as_str(),
                        "CrashLoopBackOff"
                            | "Error"
                            | "ImagePullBackOff"
                            | "ErrImagePull"
                            | "CreateContainerConfigError"
                    ) {
                        pod_errors.push(format!("{}: {}", pod_name, reason));
                    }
                }
                if let Some(terminated) = &state.terminated {
                    let reason = terminated.reason.clone().unwrap_or_default();
                    if reason == "Error" || reason == "OOMKilled" {
                        pod_errors.push(format!("{}: {}", pod_name, reason));
                    }
                }
            }
        }

        // Resolve workload owner
        let workload_name = pod
            .metadata
            .owner_references
            .as_ref()
            .and_then(|owners| {
                for oref in owners {
                    match oref.kind.as_str() {
                        "ReplicaSet" => return rs_to_dep.get(&oref.name).cloned(),
                        "StatefulSet" | "DaemonSet" => return Some(oref.name.clone()),
                        _ => {}
                    }
                }
                None
            });

        if let Some(wl_name) = workload_name {
            if let Some(wl) = unhealthy.iter_mut().find(|w| w.name == wl_name) {
                wl.restart_count += restarts;
                wl.pod_errors.extend(pod_errors);
            } else if restarts > 5 || !pod_errors.is_empty() {
                // Pod belongs to a workload that seemed healthy by replica count,
                // but has crash loops
                let owner_kind = pod
                    .metadata
                    .owner_references
                    .as_ref()
                    .and_then(|o| o.first())
                    .map(|o| {
                        if o.kind == "ReplicaSet" {
                            "Deployment".to_string()
                        } else {
                            o.kind.clone()
                        }
                    })
                    .unwrap_or_else(|| "Pod".to_string());

                let events =
                    fetch_events_for(client, namespace, &wl_name, &owner_kind).await;
                unhealthy.push(UnhealthyWorkload {
                    name: wl_name,
                    kind: owner_kind,
                    ready: "?".to_string(),
                    restart_count: restarts,
                    pod_errors,
                    events,
                });
            }
        }
    }

    // Sort by severity: most restarts + most errors first
    unhealthy.sort_by(|a, b| {
        let score_a = a.restart_count + a.pod_errors.len() as i32 * 10;
        let score_b = b.restart_count + b.pod_errors.len() as i32 * 10;
        score_b.cmp(&score_a)
    });

    Ok(unhealthy)
}

pub async fn detect_recent_changes(
    client: &Client,
    namespace: &str,
    since_minutes: u32,
) -> Result<Vec<ChangeEvent>, DomainError> {
    let mut changes: Vec<ChangeEvent> = Vec::new();
    let cutoff = Utc::now() - chrono::Duration::minutes(since_minutes as i64);

    // 1. Detect image changes via ReplicaSets
    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let rs_list = rs_api.list(&ListParams::default()).await?;

    // Group RS by deployment owner
    let mut dep_rs_map: HashMap<String, Vec<&ReplicaSet>> = HashMap::new();
    for rs in &rs_list.items {
        if let Some(owners) = &rs.metadata.owner_references {
            for oref in owners {
                if oref.kind == "Deployment" {
                    dep_rs_map
                        .entry(oref.name.clone())
                        .or_default()
                        .push(rs);
                    break;
                }
            }
        }
    }

    for (dep_name, mut rsets) in dep_rs_map {
        // Sort by revision
        rsets.sort_by(|a, b| {
            let ra: i64 = a
                .metadata
                .annotations
                .as_ref()
                .and_then(|a| a.get("deployment.kubernetes.io/revision"))
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            let rb: i64 = b
                .metadata
                .annotations
                .as_ref()
                .and_then(|a| a.get("deployment.kubernetes.io/revision"))
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            ra.cmp(&rb)
        });

        // Check if newest RS was created recently
        if let Some(newest) = rsets.last() {
            let created = newest.metadata.creation_timestamp.as_ref().map(|t| t.0);
            if let Some(ct) = created {
                if ct >= cutoff {
                    let revision = newest
                        .metadata
                        .annotations
                        .as_ref()
                        .and_then(|a| a.get("deployment.kubernetes.io/revision"))
                        .cloned()
                        .unwrap_or_default();

                    let new_image = newest
                        .spec
                        .as_ref()
                        .and_then(|s| s.template.as_ref())
                        .and_then(|t| t.spec.as_ref())
                        .and_then(|ps| ps.containers.first())
                        .and_then(|c| c.image.clone())
                        .unwrap_or_default();

                    // Get old image from previous RS
                    let old_image = if rsets.len() >= 2 {
                        rsets[rsets.len() - 2]
                            .spec
                            .as_ref()
                            .and_then(|s| s.template.as_ref())
                            .and_then(|t| t.spec.as_ref())
                            .and_then(|ps| ps.containers.first())
                            .and_then(|c| c.image.clone())
                            .unwrap_or_default()
                    } else {
                        String::new()
                    };

                    let details = if !old_image.is_empty() && old_image != new_image {
                        ChangeDetails::ImageUpdate {
                            old_image: old_image.clone(),
                            new_image: new_image.clone(),
                            revision: revision.clone(),
                        }
                    } else {
                        ChangeDetails::NewReplicaSet {
                            name: newest.metadata.name.clone().unwrap_or_default(),
                            revision: revision.clone(),
                            image: new_image.clone(),
                        }
                    };

                    let desc = if matches!(&details, ChangeDetails::ImageUpdate { .. }) {
                        format!("Image updated: {} -> {}", old_image, new_image)
                    } else {
                        format!("New ReplicaSet (rev {}): {}", revision, new_image)
                    };

                    changes.push(ChangeEvent {
                        timestamp: ct.to_rfc3339(),
                        change_type: "ImageUpdate".to_string(),
                        resource_kind: "Deployment".to_string(),
                        resource_name: dep_name.clone(),
                        description: desc,
                        details,
                    });
                }
            }
        }
    }

    // 2. Detect restartedAt annotation on Deployments
    let dep_api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let deps = dep_api.list(&ListParams::default()).await?;
    for dep in &deps.items {
        let name = dep.metadata.name.clone().unwrap_or_default();
        if let Some(restart_at) = dep
            .spec
            .as_ref()
            .and_then(|s| s.template.metadata.as_ref())
            .and_then(|m| m.annotations.as_ref())
            .and_then(|a| a.get("kubectl.kubernetes.io/restartedAt"))
        {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(restart_at) {
                if dt.with_timezone(&Utc) >= cutoff {
                    changes.push(ChangeEvent {
                        timestamp: restart_at.clone(),
                        change_type: "Restart".to_string(),
                        resource_kind: "Deployment".to_string(),
                        resource_name: name,
                        description: format!("Deployment restarted at {}", restart_at),
                        details: ChangeDetails::Restart {
                            triggered_at: restart_at.clone(),
                        },
                    });
                }
            }
        }
    }

    // 3. Detect HPA scaling events
    let hpa_api: Api<HorizontalPodAutoscaler> = Api::namespaced(client.clone(), namespace);
    if let Ok(hpa_list) = hpa_api.list(&ListParams::default()).await {
        for hpa in &hpa_list.items {
            let hpa_name = hpa.metadata.name.clone().unwrap_or_default();
            let events = fetch_events_for(client, namespace, &hpa_name, "HorizontalPodAutoscaler").await;
            for event in &events {
                if event.reason == "SuccessfulRescale" {
                    let current = hpa
                        .status
                        .as_ref()
                        .map(|s| s.current_replicas)
                        .unwrap_or(0);
                    let desired = hpa
                        .status
                        .as_ref()
                        .map(|s| s.desired_replicas)
                        .unwrap_or(0);

                    changes.push(ChangeEvent {
                        timestamp: String::new(),
                        change_type: "HPAScale".to_string(),
                        resource_kind: "HPA".to_string(),
                        resource_name: hpa_name.clone(),
                        description: event.message.clone(),
                        details: ChangeDetails::HPAScale {
                            current_replicas: current,
                            desired_replicas: desired,
                            metric_status: event.message.clone(),
                        },
                    });
                }
            }
        }
    }

    // 4. Detect scaling events from namespace events
    let events_api: Api<Event> = Api::namespaced(client.clone(), namespace);
    let all_events = events_api.list(&ListParams::default()).await?;
    for e in &all_events.items {
        let event_time = e
            .event_time
            .as_ref()
            .map(|t| t.0)
            .or_else(|| e.metadata.creation_timestamp.as_ref().map(|t| t.0));

        if let Some(et) = event_time {
            if et < cutoff {
                continue;
            }
        }

        let reason = e.reason.as_deref().unwrap_or_default();
        let message = e.note.as_deref().unwrap_or_default();
        let regarding = e.regarding.as_ref();
        let involved_name = regarding
            .and_then(|r| r.name.clone())
            .unwrap_or_default();

        if reason == "ScalingReplicaSet" {
            // Parse old/new replicas from message like "Scaled up replica set foo-abc to 3"
            let ts = event_time
                .map(|t| t.to_rfc3339())
                .unwrap_or_default();
            changes.push(ChangeEvent {
                timestamp: ts,
                change_type: "ScaleChange".to_string(),
                resource_kind: "Deployment".to_string(),
                resource_name: involved_name,
                description: message.to_string(),
                details: ChangeDetails::Generic {
                    info: message.to_string(),
                },
            });
        }
    }

    changes.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    // Deduplicate by (change_type, resource_name, description)
    let mut seen = HashSet::new();
    changes.retain(|c| {
        let key = format!("{}:{}:{}", c.change_type, c.resource_name, c.description);
        seen.insert(key)
    });

    Ok(changes)
}

pub async fn get_workload_saturation(
    client: &Client,
    namespace: &str,
) -> Result<Vec<WorkloadSaturation>, DomainError> {
    let mut results: Vec<WorkloadSaturation> = Vec::new();

    let pod_api: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let pods = pod_api.list(&ListParams::default()).await?;

    // Build RS -> Deployment map
    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let rs_list = rs_api.list(&ListParams::default()).await?;
    let mut rs_to_dep: HashMap<String, String> = HashMap::new();
    for rs in &rs_list.items {
        let rs_name = rs.metadata.name.clone().unwrap_or_default();
        if let Some(owners) = &rs.metadata.owner_references {
            for oref in owners {
                if oref.kind == "Deployment" {
                    rs_to_dep.insert(rs_name.clone(), oref.name.clone());
                    break;
                }
            }
        }
    }

    // Get deployment desired/ready counts
    let dep_api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let deps = dep_api.list(&ListParams::default()).await?;
    let mut workload_info: HashMap<String, (String, i32, i32)> = HashMap::new(); // name -> (kind, desired, ready)

    for dep in &deps.items {
        let name = dep.metadata.name.clone().unwrap_or_default();
        let desired = dep.spec.as_ref().and_then(|s| s.replicas).unwrap_or(1);
        let ready = dep
            .status
            .as_ref()
            .and_then(|s| s.ready_replicas)
            .unwrap_or(0);
        workload_info.insert(name, ("Deployment".to_string(), desired, ready));
    }

    let ss_api: Api<StatefulSet> = Api::namespaced(client.clone(), namespace);
    let ssets = ss_api.list(&ListParams::default()).await?;
    for ss in &ssets.items {
        let name = ss.metadata.name.clone().unwrap_or_default();
        let desired = ss.spec.as_ref().and_then(|s| s.replicas).unwrap_or(1);
        let ready = ss
            .status
            .as_ref()
            .and_then(|s| s.ready_replicas)
            .unwrap_or(0);
        workload_info.insert(name, ("StatefulSet".to_string(), desired, ready));
    }

    // Group pods by workload
    let mut workload_pods: HashMap<String, Vec<PodSaturationInfo>> = HashMap::new();
    for pod in &pods.items {
        let pod_name = pod.metadata.name.clone().unwrap_or_default();
        let container_statuses = pod
            .status
            .as_ref()
            .and_then(|s| s.container_statuses.as_ref())
            .map(|v| v.as_slice())
            .unwrap_or_default();

        let phase = pod
            .status
            .as_ref()
            .and_then(|s| s.phase.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        let restarts: i32 = container_statuses.iter().map(|cs| cs.restart_count).sum();

        // Get resource requests/limits from first container
        let (req_cpu, req_mem, lim_cpu, lim_mem) = pod
            .spec
            .as_ref()
            .and_then(|s| s.containers.first())
            .map(|c| {
                let res = c.resources.as_ref();
                let requests = res.and_then(|r| r.requests.as_ref());
                let limits = res.and_then(|r| r.limits.as_ref());
                (
                    requests
                        .and_then(|r| r.get("cpu"))
                        .map(|q| q.0.clone())
                        .unwrap_or_default(),
                    requests
                        .and_then(|r| r.get("memory"))
                        .map(|q| q.0.clone())
                        .unwrap_or_default(),
                    limits
                        .and_then(|r| r.get("cpu"))
                        .map(|q| q.0.clone())
                        .unwrap_or_default(),
                    limits
                        .and_then(|r| r.get("memory"))
                        .map(|q| q.0.clone())
                        .unwrap_or_default(),
                )
            })
            .unwrap_or_default();

        let workload_name = pod
            .metadata
            .owner_references
            .as_ref()
            .and_then(|owners| {
                for oref in owners {
                    match oref.kind.as_str() {
                        "ReplicaSet" => return rs_to_dep.get(&oref.name).cloned(),
                        "StatefulSet" | "DaemonSet" => return Some(oref.name.clone()),
                        _ => {}
                    }
                }
                None
            });

        if let Some(wl_name) = workload_name {
            workload_pods
                .entry(wl_name)
                .or_default()
                .push(PodSaturationInfo {
                    name: pod_name,
                    status: phase,
                    restarts,
                    requests_cpu: req_cpu,
                    requests_memory: req_mem,
                    limits_cpu: lim_cpu,
                    limits_memory: lim_mem,
                });
        }
    }

    // Build saturation entries for workloads that are unhealthy or have high restarts
    for (name, pod_infos) in &workload_pods {
        let (kind, desired, ready) = workload_info
            .get(name)
            .cloned()
            .unwrap_or(("Unknown".to_string(), 0, 0));

        let total_restarts: i32 = pod_infos.iter().map(|p| p.restarts).sum();
        if ready < desired || total_restarts > 3 {
            results.push(WorkloadSaturation {
                workload_name: name.clone(),
                workload_kind: kind,
                desired_replicas: desired,
                ready_replicas: ready,
                pods: pod_infos.clone(),
            });
        }
    }

    results.sort_by(|a, b| {
        let score_a = (a.desired_replicas - a.ready_replicas) * 10
            + a.pods.iter().map(|p| p.restarts).sum::<i32>();
        let score_b = (b.desired_replicas - b.ready_replicas) * 10
            + b.pods.iter().map(|p| p.restarts).sum::<i32>();
        score_b.cmp(&score_a)
    });

    Ok(results)
}

pub async fn find_affected_routes(
    client: &Client,
    namespace: &str,
    unhealthy_names: &HashSet<String>,
) -> Result<Vec<AffectedRoute>, DomainError> {
    let mut routes: Vec<AffectedRoute> = Vec::new();

    // Check Ingresses
    let ing_api: Api<Ingress> = Api::namespaced(client.clone(), namespace);
    if let Ok(ing_list) = ing_api.list(&ListParams::default()).await {
        for ing in &ing_list.items {
            let ing_name = ing.metadata.name.clone().unwrap_or_default();
            let spec = match &ing.spec {
                Some(s) => s,
                None => continue,
            };

            for rule in spec.rules.as_deref().unwrap_or_default() {
                let host = rule.host.clone().unwrap_or_else(|| "*".to_string());
                if let Some(http) = &rule.http {
                    for path in &http.paths {
                        if let Some(svc) = &path.backend.service {
                            let svc_name = &svc.name;
                            // Resolve service to workload (simplified: check if service name
                            // matches or is prefix of any unhealthy workload)
                            let is_unhealthy = unhealthy_names.iter().any(|wl| {
                                svc_name == wl || svc_name.starts_with(wl) || wl.starts_with(svc_name)
                            });

                            if is_unhealthy {
                                routes.push(AffectedRoute {
                                    route_type: "Ingress".to_string(),
                                    route_name: ing_name.clone(),
                                    hosts: vec![host.clone()],
                                    paths: vec![path
                                        .path
                                        .clone()
                                        .unwrap_or_else(|| "/".to_string())],
                                    backend_service: svc_name.clone(),
                                    backend_healthy: false,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(routes)
}

pub async fn build_rollout_timeline(
    client: &Client,
    namespace: &str,
    deployment_name: &str,
) -> Result<RolloutTimeline, DomainError> {
    let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let rs_list = rs_api.list(&ListParams::default()).await?;

    // Filter RS belonging to this deployment
    let mut dep_rs: Vec<&ReplicaSet> = Vec::new();
    for rs in &rs_list.items {
        if let Some(owners) = &rs.metadata.owner_references {
            for oref in owners {
                if oref.kind == "Deployment" && oref.name == deployment_name {
                    dep_rs.push(rs);
                    break;
                }
            }
        }
    }

    // Sort by revision
    dep_rs.sort_by(|a, b| {
        let ra: i64 = a
            .metadata
            .annotations
            .as_ref()
            .and_then(|ann| ann.get("deployment.kubernetes.io/revision"))
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        let rb: i64 = b
            .metadata
            .annotations
            .as_ref()
            .and_then(|ann| ann.get("deployment.kubernetes.io/revision"))
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        ra.cmp(&rb)
    });

    let mut steps: Vec<RolloutStep> = Vec::new();

    // Add deployment-level events
    let dep_events =
        fetch_events_for(client, namespace, deployment_name, "Deployment").await;
    for event in &dep_events {
        steps.push(RolloutStep {
            timestamp: String::new(),
            step_type: format!("deployment:{}", event.reason),
            description: event.message.clone(),
            old_rs: None,
            new_rs: None,
            events: vec![event.clone()],
        });
    }

    // Build timeline from ReplicaSets
    for (i, rs) in dep_rs.iter().enumerate() {
        let rs_name = rs.metadata.name.clone().unwrap_or_default();
        let revision = rs
            .metadata
            .annotations
            .as_ref()
            .and_then(|a| a.get("deployment.kubernetes.io/revision"))
            .cloned()
            .unwrap_or_default();

        let replicas = rs
            .status
            .as_ref()
            .map(|s| s.replicas)
            .unwrap_or(0);
        let ready = rs
            .status
            .as_ref()
            .and_then(|s| s.ready_replicas)
            .unwrap_or(0);

        let image = rs
            .spec
            .as_ref()
            .and_then(|s| s.template.as_ref())
            .and_then(|t| t.spec.as_ref())
            .and_then(|ps| ps.containers.first())
            .and_then(|c| c.image.clone())
            .unwrap_or_default();

        let created = rs
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|t| t.0.to_rfc3339())
            .unwrap_or_default();

        let snapshot = ReplicaSetSnapshot {
            name: rs_name.clone(),
            revision: revision.clone(),
            replicas,
            ready,
            image: image.clone(),
        };

        let rs_events = fetch_events_for(client, namespace, &rs_name, "ReplicaSet").await;

        let old_rs = if i > 0 {
            let prev = dep_rs[i - 1];
            let prev_name = prev.metadata.name.clone().unwrap_or_default();
            let prev_rev = prev
                .metadata
                .annotations
                .as_ref()
                .and_then(|a| a.get("deployment.kubernetes.io/revision"))
                .cloned()
                .unwrap_or_default();
            let prev_replicas = prev.status.as_ref().map(|s| s.replicas).unwrap_or(0);
            let prev_ready = prev
                .status
                .as_ref()
                .and_then(|s| s.ready_replicas)
                .unwrap_or(0);
            let prev_image = prev
                .spec
                .as_ref()
                .and_then(|s| s.template.as_ref())
                .and_then(|t| t.spec.as_ref())
                .and_then(|ps| ps.containers.first())
                .and_then(|c| c.image.clone())
                .unwrap_or_default();
            Some(ReplicaSetSnapshot {
                name: prev_name,
                revision: prev_rev,
                replicas: prev_replicas,
                ready: prev_ready,
                image: prev_image,
            })
        } else {
            None
        };

        steps.push(RolloutStep {
            timestamp: created,
            step_type: format!("revision:{}", revision),
            description: format!("ReplicaSet {} (rev {}) image: {}", rs_name, revision, image),
            old_rs,
            new_rs: Some(snapshot),
            events: rs_events,
        });
    }

    // Sort all steps by timestamp
    steps.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    Ok(RolloutTimeline {
        deployment_name: deployment_name.to_string(),
        steps,
    })
}
