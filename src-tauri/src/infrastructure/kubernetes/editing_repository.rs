use kube::{
    api::{Api, DynamicObject, Patch, PatchParams, PostParams},
    discovery::ApiResource,
    Client,
};
use serde_json::Value;

use crate::domain::errors::DomainError;

fn build_api_resource(group: &str, version: &str, kind: &str, plural: &str) -> ApiResource {
    ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        kind: kind.to_string(),
        api_version: if group.is_empty() {
            version.to_string()
        } else {
            format!("{}/{}", group, version)
        },
        plural: plural.to_string(),
    }
}

fn build_api(client: &Client, ns: &str, ar: &ApiResource, cluster_scoped: bool) -> Api<DynamicObject> {
    if cluster_scoped {
        Api::all_with(client.clone(), ar)
    } else {
        Api::namespaced_with(client.clone(), ns, ar)
    }
}

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
    let ar = build_api_resource(group, version, kind, plural);
    let api = build_api(client, ns, &ar, cluster_scoped);
    let obj = api.get(name).await?;

    let mut val = serde_json::to_value(&obj)?;
    if let Some(metadata) = val.get_mut("metadata").and_then(|m| m.as_object_mut()) {
        metadata.remove("managedFields");
    }

    let yaml = serde_yaml::to_string(&val)?;
    Ok(yaml)
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
    let ar = build_api_resource(group, version, kind, plural);
    let api = build_api(client, ns, &ar, cluster_scoped);

    let mut obj: DynamicObject = serde_yaml::from_str(yaml_content)?;
    obj.metadata.name = Some(name.to_string());
    if !cluster_scoped {
        obj.metadata.namespace = Some(ns.to_string());
    }

    let current = api.get(name).await?;
    obj.metadata.resource_version = current.metadata.resource_version;

    let pp = PostParams::default();
    api.replace(name, &pp, &obj).await?;
    Ok(())
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
    let ar = build_api_resource(group, version, kind, plural);
    let api = build_api(client, ns, &ar, cluster_scoped);

    let patch = Patch::Strategic(patch_json);
    let pp = PatchParams::default();
    api.patch(name, &pp, &patch).await?;
    Ok(())
}
