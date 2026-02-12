use k8s_openapi::api::events::v1::Event;
use kube::api::{ApiResource, DynamicObject, ListParams};
use kube::{Api, Client};
use std::collections::BTreeMap;

use crate::application::services::formatting::format_age;
use crate::domain::entities::common::{EventInfo, GenericResourceDetailInfo, OwnerRefInfo};
use crate::domain::errors::DomainError;

pub async fn fetch_events_for(client: &Client, namespace: &str, name: &str, kind: &str) -> Vec<EventInfo> {
    let events_api: Api<Event> = Api::namespaced(client.clone(), namespace);
    let events_lp = ListParams::default()
        .fields(&format!("regarding.name={},regarding.kind={}", name, kind));
    let events_list = events_api.list(&events_lp).await.unwrap_or_else(|_| kube::api::ObjectList {
        types: Default::default(),
        metadata: Default::default(),
        items: vec![],
    });
    events_list
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
        .collect()
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
    let ar = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        kind: kind.to_string(),
        api_version: if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        },
        plural: plural.to_string(),
    };
    let api: Api<DynamicObject> = if cluster_scoped {
        Api::all_with(client.clone(), &ar)
    } else {
        Api::namespaced_with(client.clone(), namespace, &ar)
    };
    let obj = api.get(name).await?;

    let meta = obj.metadata;
    let res_name = meta.name.clone().unwrap_or_default();
    let res_ns = meta.namespace.clone().unwrap_or_default();

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

    let finalizers = meta.finalizers.unwrap_or_default();

    let data = obj.data;
    let spec = data.get("spec").cloned().unwrap_or(serde_json::Value::Null);
    let status = data.get("status").cloned().unwrap_or(serde_json::Value::Null);

    let mut extra = BTreeMap::new();
    if let Some(map) = data.as_object() {
        for (k, v) in map {
            match k.as_str() {
                "metadata" | "spec" | "status" | "apiVersion" | "kind" => {}
                _ => { extra.insert(k.clone(), v.clone()); }
            }
        }
    }

    let events = fetch_events_for(client, namespace, &res_name, kind).await;

    Ok(GenericResourceDetailInfo {
        name: res_name,
        namespace: res_ns,
        created,
        labels,
        annotations,
        controlled_by,
        finalizers,
        spec,
        status,
        extra,
        events,
    })
}
