use kube::{Client, Api, api::ListParams};
use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::CustomResourceDefinition;
use kube::api::DynamicObject;

use crate::domain::entities::{CRDInfo, CRDInstanceInfo};
use crate::domain::errors::DomainError;
use crate::application::services::formatting::format_age;

pub struct CRDHandler;

impl CRDHandler {
    pub async fn list_crds(client: &Client) -> Result<Vec<CRDInfo>, DomainError> {
        let api: Api<CustomResourceDefinition> = Api::all(client.clone());
        let crds = api.list(&ListParams::default()).await?;

        let mut result: Vec<CRDInfo> = crds
            .items
            .into_iter()
            .filter_map(|crd| {
                let spec = &crd.spec;
                let name = crd.metadata.name.unwrap_or_default();
                let group = spec.group.clone();
                let kind = spec.names.kind.clone();
                let plural = spec.names.plural.clone();
                let scope = match spec.scope.as_str() {
                    "Namespaced" => "Namespaced",
                    _ => "Cluster",
                }.to_string();

                // Use the first served version
                let version = spec.versions.iter()
                    .find(|v| v.served)
                    .map(|v| v.name.clone())
                    .unwrap_or_else(|| "v1".to_string());

                Some(CRDInfo {
                    name,
                    group,
                    version,
                    kind,
                    plural,
                    scope,
                })
            })
            .collect();

        result.sort_by(|a, b| a.kind.cmp(&b.kind));
        Ok(result)
    }

    pub async fn list_crd_instances(
        client: &Client,
        namespace: &str,
        group: &str,
        version: &str,
        plural: &str,
        scope: &str,
    ) -> Result<Vec<CRDInstanceInfo>, DomainError> {
        let ar = kube::api::ApiResource {
            group: group.to_string(),
            version: version.to_string(),
            api_version: if group.is_empty() {
                version.to_string()
            } else {
                format!("{}/{}", group, version)
            },
            kind: plural.to_string(),
            plural: plural.to_string(),
        };

        let api: Api<DynamicObject> = if scope == "Cluster" {
            Api::all_with(client.clone(), &ar)
        } else {
            Api::namespaced_with(client.clone(), namespace, &ar)
        };
        let list = api.list(&ListParams::default()).await?;

        let result = list
            .items
            .into_iter()
            .map(|obj| {
                let name = obj.metadata.name.unwrap_or_default();
                let ns = obj.metadata.namespace.unwrap_or_default();
                let age = format_age(obj.metadata.creation_timestamp.as_ref());
                CRDInstanceInfo { name, namespace: ns, age }
            })
            .collect();

        Ok(result)
    }
}
