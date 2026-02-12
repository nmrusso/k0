use kube::Client;

use crate::application::services::config_db::ConfigDB;
use crate::domain::entities::{ContextInfo, NamespaceInfo};
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::{client_manager::ClientManager, cluster_repository};

pub struct ClusterHandler;

impl ClusterHandler {
    pub fn list_contexts(config_db: &ConfigDB) -> Result<Vec<ContextInfo>, DomainError> {
        cluster_repository::list_contexts(config_db)
    }

    pub async fn list_namespaces(client: &Client) -> Result<Vec<NamespaceInfo>, DomainError> {
        cluster_repository::list_namespaces(client).await
    }

    pub async fn set_context(manager: &ClientManager, name: &str) -> Result<(), DomainError> {
        manager.set_context(name).await
    }

}
