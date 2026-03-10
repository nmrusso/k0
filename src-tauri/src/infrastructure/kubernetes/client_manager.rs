use kube::{config::Kubeconfig, Client, Config};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::application::services::config_db::ConfigDB;
use crate::domain::errors::DomainError;

pub struct ClientManager {
    pub clients: Arc<Mutex<HashMap<String, Client>>>,
    pub active_context: Arc<Mutex<Option<String>>>,
    pub active_namespace: Arc<Mutex<Option<String>>>,
    pub config_db: Arc<ConfigDB>,
}

impl ClientManager {
    pub fn new(config_db: Arc<ConfigDB>) -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            active_context: Arc::new(Mutex::new(None)),
            active_namespace: Arc::new(Mutex::new(None)),
            config_db,
        }
    }

    /// Core method — all public accessors are derived from this.
    async fn get_active_state(&self) -> Result<(Client, String, String), DomainError> {
        let ctx = self.active_context.lock().await
            .as_ref()
            .ok_or(DomainError::NoActiveContext)?
            .clone();

        let ns = self.active_namespace.lock().await
            .as_ref()
            .ok_or(DomainError::NoActiveNamespace)?
            .clone();

        let client = self.clients.lock().await
            .get(&ctx)
            .ok_or_else(|| DomainError::Configuration("Client not found".to_string()))?
            .clone();

        Ok((client, ns, ctx))
    }

    /// Returns `(client, namespace)` — use for most namespaced commands.
    pub async fn get_active_client(&self) -> Result<(Client, String), DomainError> {
        let (client, ns, _) = self.get_active_state().await?;
        Ok((client, ns))
    }

    /// Returns `(client, namespace, context_name)` — use when context name is needed.
    pub async fn get_active_client_and_context(&self) -> Result<(Client, String, String), DomainError> {
        self.get_active_state().await
    }

    /// Returns only the client — use for cluster-scoped or context-only operations
    /// (does NOT require an active namespace, safe to call before namespace is selected).
    pub async fn get_client_for_context(&self) -> Result<Client, DomainError> {
        let ctx = self.active_context.lock().await
            .as_ref()
            .ok_or(DomainError::NoActiveContext)?
            .clone();

        let client = self.clients.lock().await
            .get(&ctx)
            .ok_or_else(|| DomainError::Configuration("Client not found".to_string()))?
            .clone();

        Ok(client)
    }

    pub async fn set_context(&self, name: &str) -> Result<(), DomainError> {
        let extra_paths = get_extra_kubeconfig_paths(&self.config_db);
        let client = build_client(name, &extra_paths).await?;

        let mut clients = self.clients.lock().await;
        clients.insert(name.to_string(), client);

        let mut active = self.active_context.lock().await;
        *active = Some(name.to_string());

        // Reset namespace when changing context
        let mut ns = self.active_namespace.lock().await;
        *ns = None;

        Ok(())
    }

    pub async fn set_namespace(&self, namespace: &str) {
        let mut ns = self.active_namespace.lock().await;
        *ns = Some(namespace.to_string());
    }
}

fn get_extra_kubeconfig_paths(config_db: &ConfigDB) -> Vec<String> {
    config_db
        .get("kubeconfig_paths")
        .ok()
        .flatten()
        .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
        .unwrap_or_default()
}

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

pub async fn build_client(context_name: &str, extra_paths: &[String]) -> Result<Client, DomainError> {
    let mut kubeconfig = Kubeconfig::read()
        .map_err(|e| DomainError::Configuration(e.to_string()))?;

    if !extra_paths.is_empty() {
        let extras = read_kubeconfigs_from_paths(extra_paths);
        for other in extras {
            for ctx in other.contexts {
                if !kubeconfig.contexts.iter().any(|c| c.name == ctx.name) {
                    kubeconfig.contexts.push(ctx);
                }
            }
            for cluster in other.clusters {
                if !kubeconfig.clusters.iter().any(|c| c.name == cluster.name) {
                    kubeconfig.clusters.push(cluster);
                }
            }
            for user in other.auth_infos {
                if !kubeconfig.auth_infos.iter().any(|u| u.name == user.name) {
                    kubeconfig.auth_infos.push(user);
                }
            }
        }
    }

    let config = Config::from_custom_kubeconfig(
        kubeconfig,
        &kube::config::KubeConfigOptions {
            context: Some(context_name.to_string()),
            cluster: None,
            user: None,
        },
    )
    .await
    .map_err(|e| DomainError::Configuration(e.to_string()))?;

    let client = Client::try_from(config)
        .map_err(|e| DomainError::Configuration(e.to_string()))?;
    Ok(client)
}
