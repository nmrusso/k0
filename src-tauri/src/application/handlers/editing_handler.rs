use kube::Client;
use serde_json::Value;

use crate::domain::entities::GenericResourceDetailInfo;
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::{editing_repository, helpers as infra_helpers};

pub struct EditingHandler;

impl EditingHandler {
    pub async fn get_resource_yaml(
        client: &Client,
        ns: &str,
        name: &str,
        group: &str,
        version: &str,
        kind: &str,
        plural: &str,
        cluster_scoped: bool,
    ) -> Result<String, DomainError> {
        editing_repository::get_resource_yaml(client, ns, name, group, version, kind, plural, cluster_scoped).await
    }

    pub async fn update_resource_yaml(
        client: &Client,
        ns: &str,
        name: &str,
        group: &str,
        version: &str,
        kind: &str,
        plural: &str,
        yaml_content: &str,
        cluster_scoped: bool,
    ) -> Result<(), DomainError> {
        editing_repository::update_resource_yaml(client, ns, name, group, version, kind, plural, yaml_content, cluster_scoped).await
    }

    pub async fn patch_resource(
        client: &Client,
        ns: &str,
        name: &str,
        group: &str,
        version: &str,
        kind: &str,
        plural: &str,
        patch_json: &Value,
        cluster_scoped: bool,
    ) -> Result<(), DomainError> {
        editing_repository::patch_resource(client, ns, name, group, version, kind, plural, patch_json, cluster_scoped).await
    }

    pub async fn get_generic_resource_detail(
        client: &Client,
        namespace: &str,
        name: &str,
        group: &str,
        version: &str,
        kind: &str,
        plural: &str,
        cluster_scoped: bool,
    ) -> Result<GenericResourceDetailInfo, DomainError> {
        infra_helpers::get_generic_resource_detail(client, namespace, name, group, version, kind, plural, cluster_scoped).await
    }
}
