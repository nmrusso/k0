use k8s_openapi::api::core::v1::Namespace;
use kube::{api::ListParams, config::Kubeconfig, Api, Client};
use std::path::Path;

use crate::application::services::config_db::ConfigDB;
use crate::application::services::formatting::format_age;
use crate::domain::entities::{ContextInfo, NamespaceInfo};
use crate::domain::errors::DomainError;

fn read_kubeconfigs_from_paths(extra_paths: &[String]) -> Vec<Kubeconfig> {
    let mut configs = Vec::new();
    for path_str in extra_paths {
        let path = if path_str.starts_with('~') {
            if let Some(home) = dirs::home_dir() {
                home.join(&path_str[2..])
            } else {
                Path::new(path_str).to_path_buf()
            }
        } else {
            Path::new(path_str).to_path_buf()
        };

        if path.is_dir() {
            // Scan directory for kubeconfig files
            if let Ok(entries) = std::fs::read_dir(&path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if entry_path.is_file() {
                        if let Ok(kc) = Kubeconfig::read_from(entry_path) {
                            configs.push(kc);
                        }
                    }
                }
            }
        } else if path.is_file() {
            if let Ok(kc) = Kubeconfig::read_from(path) {
                configs.push(kc);
            }
        }
    }
    configs
}

fn merge_kubeconfigs(base: &mut Kubeconfig, others: Vec<Kubeconfig>) {
    for other in others {
        for ctx in other.contexts {
            if !base.contexts.iter().any(|c| c.name == ctx.name) {
                base.contexts.push(ctx);
            }
        }
        for cluster in other.clusters {
            if !base.clusters.iter().any(|c| c.name == cluster.name) {
                base.clusters.push(cluster);
            }
        }
        for user in other.auth_infos {
            if !base.auth_infos.iter().any(|u| u.name == user.name) {
                base.auth_infos.push(user);
            }
        }
    }
}

pub fn list_contexts(config_db: &ConfigDB) -> Result<Vec<ContextInfo>, DomainError> {
    let mut kubeconfig = Kubeconfig::read()
        .map_err(|e| DomainError::Configuration(e.to_string()))?;
    let current = kubeconfig.current_context.clone().unwrap_or_default();

    // Merge extra kubeconfig paths from settings
    if let Ok(Some(paths_json)) = config_db.get("kubeconfig_paths") {
        if let Ok(paths) = serde_json::from_str::<Vec<String>>(&paths_json) {
            let extra = read_kubeconfigs_from_paths(&paths);
            merge_kubeconfigs(&mut kubeconfig, extra);
        }
    }

    let contexts = kubeconfig
        .contexts
        .iter()
        .map(|ctx| {
            let context = ctx.context.as_ref();
            ContextInfo {
                name: ctx.name.clone(),
                cluster: context.map(|c| c.cluster.clone()).unwrap_or_default(),
                user: context
                    .map(|c| c.user.clone().unwrap_or_default())
                    .unwrap_or_default(),
                namespace: context.and_then(|c| c.namespace.clone()),
                is_active: ctx.name == current,
            }
        })
        .collect();

    Ok(contexts)
}

pub async fn list_namespaces(client: &Client) -> Result<Vec<NamespaceInfo>, DomainError> {
    let api: Api<Namespace> = Api::all(client.clone());
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|ns| {
            let meta = ns.metadata;
            let status = ns
                .status
                .and_then(|s| s.phase)
                .unwrap_or_else(|| "Unknown".to_string());
            NamespaceInfo {
                name: meta.name.unwrap_or_default(),
                status,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}
