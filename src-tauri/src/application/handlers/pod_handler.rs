use kube::Client;

use crate::domain::entities::{ImageHistoryEntry, PodDetailInfo};
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::pod_repository;

pub struct PodHandler;

impl PodHandler {
    pub async fn get_detail(
        client: &Client,
        namespace: &str,
        name: &str,
    ) -> Result<PodDetailInfo, DomainError> {
        pod_repository::get_pod_detail(client, namespace, name).await
    }

    pub async fn delete(
        client: &Client,
        namespace: &str,
        name: &str,
    ) -> Result<(), DomainError> {
        pod_repository::delete_pod(client, namespace, name).await
    }

    pub async fn get_image_history(
        client: &Client,
        namespace: &str,
        owner_kind: &str,
        owner_name: &str,
        container_name: &str,
    ) -> Result<Vec<ImageHistoryEntry>, DomainError> {
        pod_repository::get_image_history(client, namespace, owner_kind, owner_name, container_name).await
    }
}
