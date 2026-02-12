use k8s_openapi::api::core::v1::{ConfigMap, Secret};
use kube::{api::ListParams, Api, Client};
use std::collections::BTreeMap;

use crate::application::services::formatting::format_age;
use crate::domain::entities::config::*;
use crate::domain::errors::DomainError;

pub async fn list_configmaps(client: &Client, namespace: &str) -> Result<Vec<ConfigMapInfo>, DomainError> {
    let api: Api<ConfigMap> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|cm| {
            let meta = cm.metadata;
            let data_count = cm.data.map(|d| d.len() as i32).unwrap_or(0);

            ConfigMapInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                data_count,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_secrets(client: &Client, namespace: &str) -> Result<Vec<SecretInfo>, DomainError> {
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|s| {
            let meta = s.metadata;
            let data_count = s.data.map(|d| d.len() as i32).unwrap_or(0);

            SecretInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                secret_type: s.type_.unwrap_or_else(|| "Opaque".to_string()),
                data_count,
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn get_secret_key_value(
    client: &Client,
    namespace: &str,
    secret_name: &str,
    key: &str,
) -> Result<String, DomainError> {
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    let secret = api.get(secret_name).await?;
    let data = secret.data.ok_or_else(|| DomainError::NotFound("Secret has no data".to_string()))?;
    let value = data
        .get(key)
        .ok_or_else(|| DomainError::NotFound(format!("Key '{}' not found in secret '{}'", key, secret_name)))?;
    String::from_utf8(value.0.clone())
        .map_err(|e| DomainError::Serialization(format!("Failed to decode secret value as UTF-8: {}", e)))
}

pub async fn get_secret_all_data(
    client: &Client,
    namespace: &str,
    secret_name: &str,
) -> Result<BTreeMap<String, String>, DomainError> {
    use base64::Engine;
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    let secret = api.get(secret_name).await?;
    let data = secret.data.unwrap_or_default();
    let mut result = BTreeMap::new();
    for (k, v) in data {
        let b64 = base64::engine::general_purpose::STANDARD.encode(&v.0);
        result.insert(k, b64);
    }
    Ok(result)
}
