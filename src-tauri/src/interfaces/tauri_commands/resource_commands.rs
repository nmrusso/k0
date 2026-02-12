use std::collections::{BTreeMap, HashSet};
use tauri::State;
use kube::api::{Api, Patch, PatchParams};
use kube::api::DynamicObject;
use kube::discovery::ApiResource;
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::Secret;

use crate::application::handlers::resource_handler::ResourceHandler;
use crate::domain::entities::*;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn get_pods(state: State<'_, AppState>) -> Result<Vec<PodInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_pods(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_deployments(state: State<'_, AppState>) -> Result<Vec<DeploymentInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_deployments(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_daemonsets(state: State<'_, AppState>) -> Result<Vec<DaemonSetInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_daemonsets(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_statefulsets(state: State<'_, AppState>) -> Result<Vec<StatefulSetInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_statefulsets(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_replicasets(state: State<'_, AppState>) -> Result<Vec<ReplicaSetInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_replicasets(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_replication_controllers(
    state: State<'_, AppState>,
) -> Result<Vec<ReplicationControllerInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_replication_controllers(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_jobs(state: State<'_, AppState>) -> Result<Vec<JobInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_jobs(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_cronjobs(state: State<'_, AppState>) -> Result<Vec<CronJobInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_cronjobs(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_services(state: State<'_, AppState>) -> Result<Vec<ServiceInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_services(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_configmaps(state: State<'_, AppState>) -> Result<Vec<ConfigMapInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_configmaps(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_secrets(state: State<'_, AppState>) -> Result<Vec<SecretInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_secrets(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_ingresses(state: State<'_, AppState>) -> Result<Vec<IngressInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_ingresses(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_gateways(state: State<'_, AppState>) -> Result<Vec<GatewayInfo>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_gateways(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_secret_value(
    secret_name: String,
    key: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    crate::infrastructure::kubernetes::config_repository::get_secret_key_value(&client, &ns, &secret_name, &key)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_secret_data(
    secret_name: String,
    state: State<'_, AppState>,
) -> Result<BTreeMap<String, String>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    crate::infrastructure::kubernetes::config_repository::get_secret_all_data(&client, &ns, &secret_name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_generic_resources(
    group: String,
    version: String,
    kind: String,
    plural: String,
    cluster_scoped: bool,
    state: State<'_, AppState>,
) -> Result<Vec<GenericResourceListItem>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::list_generic_resources(&client, &ns, &group, &version, &kind, &plural, cluster_scoped)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_network_graph(state: State<'_, AppState>) -> Result<NetworkGraphData, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::get_network_graph(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_dependency_graph(state: State<'_, AppState>) -> Result<DependencyGraphData, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    ResourceHandler::get_dependency_graph(&client, &ns).await.map_err(Into::into)
}

#[tauri::command]
pub async fn scale_deployment(
    name: String,
    replicas: i32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    let api: Api<Deployment> = Api::namespaced(client, &ns);
    let patch = serde_json::json!({
        "spec": { "replicas": replicas }
    });
    api.patch(&name, &PatchParams::apply("k0"), &Patch::Merge(&patch))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn restart_deployment(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    let api: Api<Deployment> = Api::namespaced(client, &ns);
    let now = chrono::Utc::now().to_rfc3339();
    let patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": now
                    }
                }
            }
        }
    });
    api.patch(&name, &PatchParams::apply("k0"), &Patch::Merge(&patch))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_deployment_info(
    name: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    let api: Api<Deployment> = Api::namespaced(client, &ns);
    let dep = api.get(&name).await.map_err(|e| e.to_string())?;
    let replicas = dep.spec.as_ref().and_then(|s| s.replicas).unwrap_or(1);
    let available = dep.status.as_ref().and_then(|s| s.available_replicas).unwrap_or(0);
    // Get first container resources
    let containers: Vec<serde_json::Value> = dep.spec.as_ref()
        .and_then(|s| s.template.spec.as_ref())
        .map(|ps| ps.containers.iter().map(|c| {
            let reqs = c.resources.as_ref();
            serde_json::json!({
                "name": c.name,
                "requests_cpu": reqs.and_then(|r| r.requests.as_ref()).and_then(|r| r.get("cpu")).map(|v| v.0.clone()).unwrap_or_default(),
                "requests_memory": reqs.and_then(|r| r.requests.as_ref()).and_then(|r| r.get("memory")).map(|v| v.0.clone()).unwrap_or_default(),
                "limits_cpu": reqs.and_then(|r| r.limits.as_ref()).and_then(|r| r.get("cpu")).map(|v| v.0.clone()).unwrap_or_default(),
                "limits_memory": reqs.and_then(|r| r.limits.as_ref()).and_then(|r| r.get("memory")).map(|v| v.0.clone()).unwrap_or_default(),
            })
        }).collect())
        .unwrap_or_default();
    Ok(serde_json::json!({
        "replicas": replicas,
        "available_replicas": available,
        "containers": containers,
    }))
}

#[tauri::command]
pub async fn update_deployment_resources(
    name: String,
    container_name: String,
    requests_cpu: String,
    requests_memory: String,
    limits_cpu: String,
    limits_memory: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    let api: Api<Deployment> = Api::namespaced(client, &ns);
    let dep = api.get(&name).await.map_err(|e| e.to_string())?;
    let containers = dep.spec.as_ref()
        .and_then(|s| s.template.spec.as_ref())
        .map(|ps| &ps.containers)
        .ok_or("No containers found")?;
    let idx = containers.iter().position(|c| c.name == container_name)
        .ok_or(format!("Container {} not found", container_name))?;

    let mut requests = serde_json::Map::new();
    if !requests_cpu.is_empty() { requests.insert("cpu".into(), serde_json::json!(requests_cpu)); }
    if !requests_memory.is_empty() { requests.insert("memory".into(), serde_json::json!(requests_memory)); }

    let mut limits = serde_json::Map::new();
    if !limits_cpu.is_empty() { limits.insert("cpu".into(), serde_json::json!(limits_cpu)); }
    if !limits_memory.is_empty() { limits.insert("memory".into(), serde_json::json!(limits_memory)); }

    // Build container patches - need to set all containers
    let container_patches: Vec<serde_json::Value> = containers.iter().enumerate().map(|(i, c)| {
        if i == idx {
            serde_json::json!({
                "name": c.name,
                "resources": {
                    "requests": requests,
                    "limits": limits,
                }
            })
        } else {
            serde_json::json!({ "name": c.name })
        }
    }).collect();

    let patch = serde_json::json!({
        "spec": {
            "template": {
                "spec": {
                    "containers": container_patches
                }
            }
        }
    });
    api.patch(&name, &PatchParams::apply("k0"), &Patch::Merge(&patch))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_image_history(
    owner_kind: String,
    owner_name: String,
    container_name: String,
    state: State<'_, AppState>,
) -> Result<Vec<ImageHistoryEntry>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    crate::application::handlers::pod_handler::PodHandler::get_image_history(
        &client, &ns, &owner_kind, &owner_name, &container_name,
    )
    .await
    .map_err(Into::into)
}

#[derive(serde::Serialize)]
pub struct ExternalSecretMatch {
    pub external_secret_name: String,
    pub secret_name: String,
    pub api_version: String,
}

#[tauri::command]
pub async fn get_external_secrets_for_deployment(
    deployment_name: String,
    state: State<'_, AppState>,
) -> Result<Vec<ExternalSecretMatch>, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;

    // 1. Get deployment and collect all referenced secret names
    let deploy_api: Api<Deployment> = Api::namespaced(client.clone(), &ns);
    let dep = deploy_api.get(&deployment_name).await.map_err(|e| e.to_string())?;

    let mut secret_names = HashSet::new();
    if let Some(spec) = dep.spec.as_ref() {
        if let Some(pod_spec) = spec.template.spec.as_ref() {
            for container in &pod_spec.containers {
                // envFrom secretRef
                if let Some(env_from) = &container.env_from {
                    for ef in env_from {
                        if let Some(sr) = &ef.secret_ref {
                            if !sr.name.is_empty() {
                                secret_names.insert(sr.name.clone());
                            }
                        }
                    }
                }
                // env valueFrom secretKeyRef
                if let Some(env) = &container.env {
                    for e in env {
                        if let Some(vf) = &e.value_from {
                            if let Some(skr) = &vf.secret_key_ref {
                                if !skr.name.is_empty() {
                                    secret_names.insert(skr.name.clone());
                                }
                            }
                        }
                    }
                }
            }
            // volumes with secret
            if let Some(volumes) = &pod_spec.volumes {
                for vol in volumes {
                    if let Some(secret) = &vol.secret {
                        if let Some(name) = &secret.secret_name {
                            secret_names.insert(name.clone());
                        }
                    }
                }
            }
        }
    }

    if secret_names.is_empty() {
        return Ok(vec![]);
    }

    // 2. For each referenced secret, check its ownerReferences for ExternalSecret
    let secret_api: Api<Secret> = Api::namespaced(client, &ns);
    let mut matches = vec![];

    for secret_name in &secret_names {
        let secret = match secret_api.get(secret_name).await {
            Ok(s) => s,
            Err(_) => continue, // Secret doesn't exist, skip
        };
        if let Some(owner_refs) = &secret.metadata.owner_references {
            for oref in owner_refs {
                if oref.kind == "ExternalSecret" {
                    matches.push(ExternalSecretMatch {
                        external_secret_name: oref.name.clone(),
                        secret_name: secret_name.clone(),
                        api_version: oref.api_version.clone(),
                    });
                }
            }
        }
    }

    Ok(matches)
}

fn externalsecret_api_resource(version: &str) -> ApiResource {
    ApiResource {
        group: "external-secrets.io".into(),
        version: version.into(),
        api_version: format!("external-secrets.io/{}", version),
        kind: "ExternalSecret".into(),
        plural: "externalsecrets".into(),
    }
}

#[tauri::command]
pub async fn force_sync_external_secret(
    external_secret_name: String,
    deployment_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;

    // 1. Annotate the ExternalSecret with force-sync=<timestamp>
    //    Try v1 first, then v1beta1
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let patch = serde_json::json!({
        "metadata": {
            "annotations": {
                "force-sync": timestamp
            }
        }
    });

    let mut patched = false;
    for version in &["v1", "v1beta1"] {
        let ar = externalsecret_api_resource(version);
        let es_api: Api<DynamicObject> = Api::namespaced_with(client.clone(), &ns, &ar);
        if es_api.patch(&external_secret_name, &PatchParams::apply("k0"), &Patch::Merge(&patch)).await.is_ok() {
            patched = true;
            break;
        }
    }
    if !patched {
        return Err("Failed to patch ExternalSecret (tried v1 and v1beta1)".into());
    }

    // 2. Wait for external-secrets operator to reconcile
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // 3. Restart the deployment (rollout restart)
    let deploy_api: Api<Deployment> = Api::namespaced(client, &ns);
    let now = chrono::Utc::now().to_rfc3339();
    let restart_patch = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kubectl.kubernetes.io/restartedAt": now
                    }
                }
            }
        }
    });
    deploy_api.patch(&deployment_name, &PatchParams::apply("k0"), &Patch::Merge(&restart_patch))
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
