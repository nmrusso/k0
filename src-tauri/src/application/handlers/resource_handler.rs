use std::collections::HashMap;
use kube::api::{Api, ApiResource, DynamicObject, ListParams};
use kube::Client;
use k8s_openapi::api::core::v1::{Endpoints, Pod, Service};
use k8s_openapi::api::networking::v1::Ingress;
use k8s_openapi::api::apps::v1::{Deployment, ReplicaSet, StatefulSet, DaemonSet};
use k8s_openapi::api::batch::v1::{Job, CronJob};

use crate::application::services::formatting::format_age;
use crate::domain::entities::*;
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::*;

pub struct ResourceHandler;

impl ResourceHandler {
    pub async fn list_pods(client: &Client, namespace: &str) -> Result<Vec<PodInfo>, DomainError> {
        pod_repository::list_pods(client, namespace).await
    }

    pub async fn list_deployments(client: &Client, namespace: &str) -> Result<Vec<DeploymentInfo>, DomainError> {
        workload_repository::list_deployments(client, namespace).await
    }

    pub async fn list_daemonsets(client: &Client, namespace: &str) -> Result<Vec<DaemonSetInfo>, DomainError> {
        workload_repository::list_daemonsets(client, namespace).await
    }

    pub async fn list_statefulsets(client: &Client, namespace: &str) -> Result<Vec<StatefulSetInfo>, DomainError> {
        workload_repository::list_statefulsets(client, namespace).await
    }

    pub async fn list_replicasets(client: &Client, namespace: &str) -> Result<Vec<ReplicaSetInfo>, DomainError> {
        workload_repository::list_replicasets(client, namespace).await
    }

    pub async fn list_replication_controllers(client: &Client, namespace: &str) -> Result<Vec<ReplicationControllerInfo>, DomainError> {
        workload_repository::list_replication_controllers(client, namespace).await
    }

    pub async fn list_jobs(client: &Client, namespace: &str) -> Result<Vec<JobInfo>, DomainError> {
        workload_repository::list_jobs(client, namespace).await
    }

    pub async fn list_cronjobs(client: &Client, namespace: &str) -> Result<Vec<CronJobInfo>, DomainError> {
        workload_repository::list_cronjobs(client, namespace).await
    }

    pub async fn list_services(client: &Client, namespace: &str) -> Result<Vec<ServiceInfo>, DomainError> {
        networking_repository::list_services(client, namespace).await
    }

    pub async fn list_configmaps(client: &Client, namespace: &str) -> Result<Vec<ConfigMapInfo>, DomainError> {
        config_repository::list_configmaps(client, namespace).await
    }

    pub async fn list_secrets(client: &Client, namespace: &str) -> Result<Vec<SecretInfo>, DomainError> {
        config_repository::list_secrets(client, namespace).await
    }

    pub async fn list_ingresses(client: &Client, namespace: &str) -> Result<Vec<IngressInfo>, DomainError> {
        networking_repository::list_ingresses(client, namespace).await
    }

    pub async fn list_gateways(client: &Client, namespace: &str) -> Result<Vec<GatewayInfo>, DomainError> {
        gateway_repository::list_gateways(client, namespace).await
    }

    pub async fn list_generic_resources(
        client: &Client,
        namespace: &str,
        group: &str,
        version: &str,
        kind: &str,
        plural: &str,
        cluster_scoped: bool,
    ) -> Result<Vec<GenericResourceListItem>, DomainError> {
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

        let list = api.list(&ListParams::default()).await?;

        let result = list
            .items
            .into_iter()
            .map(|obj| {
                let name = obj.metadata.name.unwrap_or_default();
                let ns = obj.metadata.namespace.unwrap_or_default();
                let age = format_age(obj.metadata.creation_timestamp.as_ref());

                // Try to extract a status phase from .status.phase
                let status = obj
                    .data
                    .get("status")
                    .and_then(|s| s.get("phase"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();

                GenericResourceListItem {
                    name,
                    namespace: ns,
                    age,
                    status,
                }
            })
            .collect();

        Ok(result)
    }

    pub async fn get_network_graph(client: &Client, namespace: &str) -> Result<NetworkGraphData, DomainError> {
        let svc_api: Api<Service> = Api::namespaced(client.clone(), namespace);
        let ing_api: Api<Ingress> = Api::namespaced(client.clone(), namespace);
        let pod_api: Api<Pod> = Api::namespaced(client.clone(), namespace);
        let ep_api: Api<Endpoints> = Api::namespaced(client.clone(), namespace);
        let deploy_api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
        let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);

        let lp = ListParams::default();
        let (services, ingresses, pods, endpoints, deploys, rsets) = tokio::try_join!(
            svc_api.list(&lp),
            ing_api.list(&lp),
            pod_api.list(&lp),
            ep_api.list(&lp),
            deploy_api.list(&lp),
            rs_api.list(&lp),
        )?;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // Build endpoint details map: svc_name -> (count, pod_names)
        let mut ep_details: HashMap<String, (i32, Vec<String>)> = HashMap::new();
        for ep in &endpoints.items {
            let name = ep.metadata.name.clone().unwrap_or_default();
            let mut count = 0i32;
            let mut pod_names = Vec::new();
            if let Some(subs) = &ep.subsets {
                for subset in subs {
                    if let Some(addrs) = &subset.addresses {
                        count += addrs.len() as i32;
                        for addr in addrs {
                            let pod_name = addr.target_ref.as_ref()
                                .and_then(|tr| tr.name.clone())
                                .unwrap_or_else(|| addr.ip.clone());
                            pod_names.push(pod_name);
                        }
                    }
                }
            }
            ep_details.insert(name, (count, pod_names));
        }

        // Build RS UID -> Deployment name map
        let mut rs_uid_to_deploy: HashMap<String, String> = HashMap::new();
        for rs in &rsets.items {
            let rs_uid = rs.metadata.uid.clone().unwrap_or_default();
            if let Some(refs) = &rs.metadata.owner_references {
                for oref in refs {
                    if oref.kind == "Deployment" {
                        rs_uid_to_deploy.insert(rs_uid.clone(), oref.name.clone());
                    }
                }
            }
        }

        // Build pod name -> owner workload name via ownerRef chain
        let mut pod_to_deploy: HashMap<String, String> = HashMap::new();
        for pod in &pods.items {
            let pod_name = pod.metadata.name.clone().unwrap_or_default();
            if let Some(refs) = &pod.metadata.owner_references {
                for oref in refs {
                    if oref.kind == "ReplicaSet" {
                        if let Some(deploy_name) = rs_uid_to_deploy.get(&oref.uid) {
                            pod_to_deploy.insert(pod_name.clone(), deploy_name.clone());
                        }
                    }
                    if oref.kind == "StatefulSet" || oref.kind == "DaemonSet" {
                        pod_to_deploy.insert(pod_name.clone(), oref.name.clone());
                    }
                }
            }
        }

        // Build deployment info map: name -> "ready/desired|podCount"
        let mut deploy_info: HashMap<String, String> = HashMap::new();
        for deploy in &deploys.items {
            let name = deploy.metadata.name.clone().unwrap_or_default();
            let ready = deploy.status.as_ref().and_then(|s| s.ready_replicas).unwrap_or(0);
            let desired = deploy.spec.as_ref().and_then(|s| s.replicas).unwrap_or(1);
            let pod_count = pod_to_deploy.values().filter(|d| **d == name).count() as i32;
            deploy_info.insert(name, format!("{}/{}|{}", ready, desired, pod_count));
        }

        // Build service selector map and resolve service -> deployments
        let mut svc_selectors: HashMap<String, HashMap<String, String>> = HashMap::new();

        for svc in &services.items {
            let name = svc.metadata.name.clone().unwrap_or_default();
            if let Some(spec) = &svc.spec {
                if let Some(sel) = &spec.selector {
                    svc_selectors.insert(name, sel.iter().map(|(k, v)| (k.clone(), v.clone())).collect());
                }
            }
        }

        // Match pods to services, resolve service -> deployments
        let pod_labels_map: HashMap<String, HashMap<String, String>> = pods.items.iter()
            .map(|p| {
                let name = p.metadata.name.clone().unwrap_or_default();
                let labels: HashMap<String, String> = p.metadata.labels.clone()
                    .unwrap_or_default()
                    .into_iter()
                    .collect();
                (name, labels)
            })
            .collect();

        let mut svc_to_deploys: HashMap<String, Vec<String>> = HashMap::new();
        for (svc_name, sel) in &svc_selectors {
            let mut deploy_set: Vec<String> = Vec::new();
            for pod in &pods.items {
                let pod_name = pod.metadata.name.clone().unwrap_or_default();
                let pod_labels = pod_labels_map.get(&pod_name).cloned().unwrap_or_default();
                let matches = sel.iter().all(|(k, v)| pod_labels.get(k).map(|pv| pv == v).unwrap_or(false));
                if matches {
                    if let Some(deploy_name) = pod_to_deploy.get(&pod_name) {
                        if !deploy_set.contains(deploy_name) {
                            deploy_set.push(deploy_name.clone());
                        }
                    }
                }
            }
            svc_to_deploys.insert(svc_name.clone(), deploy_set);
        }

        // Add Service nodes with embedded endpoint + deployment data in status
        // Format: "svcType|epCount|epPod1,epPod2,...|deployName:ready/desired:podCount;deployName2:..."
        for svc in &services.items {
            let name = svc.metadata.name.clone().unwrap_or_default();
            let svc_type = svc.spec.as_ref()
                .and_then(|s| s.type_.as_deref())
                .unwrap_or("ClusterIP");
            let (ep_count, ep_pods) = ep_details.get(&name).cloned().unwrap_or((0, Vec::new()));
            let deploys_str: String = svc_to_deploys.get(&name)
                .map(|ds| ds.iter().map(|d| {
                    let info = deploy_info.get(d).cloned().unwrap_or_else(|| "0/0|0".to_string());
                    format!("{}:{}", d, info)
                }).collect::<Vec<_>>().join(";"))
                .unwrap_or_default();
            let ep_pods_str = ep_pods.join(",");

            nodes.push(GraphNode {
                id: format!("svc:{}", name),
                label: name.clone(),
                node_type: "Service".to_string(),
                status: format!("{}|{}|{}|{}", svc_type, ep_count, ep_pods_str, deploys_str),
            });
        }

        // Ingress nodes + edges to services (deduplicated)
        for ing in &ingresses.items {
            let name = ing.metadata.name.clone().unwrap_or_default();
            let node_id = format!("ing:{}", name);
            let hosts: Vec<String> = ing.spec.as_ref()
                .and_then(|s| s.rules.as_ref())
                .map(|rules| rules.iter().filter_map(|r| r.host.clone()).collect())
                .unwrap_or_default();
            nodes.push(GraphNode {
                id: node_id.clone(),
                label: name.clone(),
                node_type: "Ingress".to_string(),
                status: hosts.join(", "),
            });
            // Collect unique service targets
            let mut seen_targets: HashMap<String, String> = HashMap::new();
            if let Some(spec) = &ing.spec {
                if let Some(rules) = &spec.rules {
                    for rule in rules {
                        if let Some(http) = &rule.http {
                            for path in &http.paths {
                                if let Some(backend_svc) = &path.backend.service {
                                    let svc_name = &backend_svc.name;
                                    let target = format!("svc:{}", svc_name);
                                    let port_label = backend_svc.port.as_ref()
                                        .map(|p| p.number.map(|n| n.to_string()).unwrap_or_default())
                                        .unwrap_or_default();
                                    seen_targets.entry(target).or_insert(port_label);
                                }
                            }
                        }
                    }
                }
            }
            for (target, label) in seen_targets {
                edges.push(GraphEdge {
                    source: node_id.clone(),
                    target,
                    label,
                });
            }
        }

        // Gateway API nodes (if any exist)
        match gateway_repository::list_gateways(client, namespace).await {
            Ok(gateways) => {
                for gw in &gateways {
                    let node_id = format!("gw:{}", gw.name);
                    nodes.push(GraphNode {
                        id: node_id,
                        label: gw.name.clone(),
                        node_type: "Gateway".to_string(),
                        status: gw.gateway_class.clone(),
                    });
                }
                // Resolve HTTPRoutes: Gateway -> Service (deduplicated)
                let ar = kube::api::ApiResource {
                    group: "gateway.networking.k8s.io".to_string(),
                    version: "v1".to_string(),
                    kind: "HTTPRoute".to_string(),
                    api_version: "gateway.networking.k8s.io/v1".to_string(),
                    plural: "httproutes".to_string(),
                };
                let route_api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &ar);
                // Collect unique gw->svc edges, combining route names
                let mut gw_svc_edges: HashMap<(String, String), Vec<String>> = HashMap::new();
                if let Ok(routes) = route_api.list(&lp).await {
                    for route in &routes.items {
                        let route_name = route.metadata.name.clone().unwrap_or_default();
                        if let Some(spec) = route.data.get("spec") {
                            if let Some(parent_refs) = spec.get("parentRefs").and_then(|p| p.as_array()) {
                                for pref in parent_refs {
                                    if let Some(gw_name) = pref.get("name").and_then(|n| n.as_str()) {
                                        let gw_id = format!("gw:{}", gw_name);
                                        if let Some(rules) = spec.get("rules").and_then(|r| r.as_array()) {
                                            for rule in rules {
                                                if let Some(backend_refs) = rule.get("backendRefs").and_then(|b| b.as_array()) {
                                                    for bref in backend_refs {
                                                        if let Some(svc_name) = bref.get("name").and_then(|n| n.as_str()) {
                                                            let target = format!("svc:{}", svc_name);
                                                            let key = (gw_id.clone(), target);
                                                            gw_svc_edges.entry(key)
                                                                .or_default()
                                                                .push(route_name.clone());
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                // Emit one edge per unique gw->svc pair
                for ((source, target), route_names) in gw_svc_edges {
                    let mut unique: Vec<String> = route_names;
                    unique.sort();
                    unique.dedup();
                    let label = if unique.len() == 1 {
                        unique[0].clone()
                    } else {
                        format!("{} routes", unique.len())
                    };
                    edges.push(GraphEdge { source, target, label });
                }
            }
            Err(_) => {} // Gateway API not available, skip
        }

        Ok(NetworkGraphData { nodes, edges })
    }

    pub async fn get_dependency_graph(client: &Client, namespace: &str) -> Result<DependencyGraphData, DomainError> {
        let deploy_api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
        let rs_api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
        let sts_api: Api<StatefulSet> = Api::namespaced(client.clone(), namespace);
        let ds_api: Api<DaemonSet> = Api::namespaced(client.clone(), namespace);
        let job_api: Api<Job> = Api::namespaced(client.clone(), namespace);
        let cj_api: Api<CronJob> = Api::namespaced(client.clone(), namespace);
        let pod_api: Api<Pod> = Api::namespaced(client.clone(), namespace);

        let lp = ListParams::default();
        let (deploys, rsets, stsets, dsets, jobs, cjobs, pods) = tokio::try_join!(
            deploy_api.list(&lp),
            rs_api.list(&lp),
            sts_api.list(&lp),
            ds_api.list(&lp),
            job_api.list(&lp),
            cj_api.list(&lp),
            pod_api.list(&lp),
        )?;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        // Track UIDs to names for ownerRef matching
        let mut uid_to_id: HashMap<String, String> = HashMap::new();

        // Helper macro to add nodes
        macro_rules! add_nodes {
            ($items:expr, $kind:expr) => {
                for item in &$items.items {
                    let name = item.metadata.name.clone().unwrap_or_default();
                    let uid = item.metadata.uid.clone().unwrap_or_default();
                    let node_id = format!("{}:{}", $kind.to_lowercase(), name);

                    let status = String::new();
                    nodes.push(GraphNode {
                        id: node_id.clone(),
                        label: name,
                        node_type: $kind.to_string(),
                        status,
                    });
                    if !uid.is_empty() {
                        uid_to_id.insert(uid, node_id);
                    }
                }
            };
        }

        add_nodes!(deploys, "Deployment");
        add_nodes!(rsets, "ReplicaSet");
        add_nodes!(stsets, "StatefulSet");
        add_nodes!(dsets, "DaemonSet");
        add_nodes!(jobs, "Job");
        add_nodes!(cjobs, "CronJob");

        // Pods
        for pod in &pods.items {
            let name = pod.metadata.name.clone().unwrap_or_default();
            let uid = pod.metadata.uid.clone().unwrap_or_default();
            let phase = pod.status.as_ref()
                .and_then(|s| s.phase.as_deref())
                .unwrap_or("Unknown")
                .to_string();
            let node_id = format!("pod:{}", name);
            nodes.push(GraphNode {
                id: node_id.clone(),
                label: name,
                node_type: "Pod".to_string(),
                status: phase,
            });
            if !uid.is_empty() {
                uid_to_id.insert(uid, node_id);
            }
        }

        // Build edges from ownerReferences
        for rs in &rsets.items {
            let name = rs.metadata.name.clone().unwrap_or_default();
            let node_id = format!("replicaset:{}", name);
            if let Some(refs) = &rs.metadata.owner_references {
                for oref in refs {
                    if let Some(parent_id) = uid_to_id.get(&oref.uid) {
                        edges.push(GraphEdge {
                            source: parent_id.clone(),
                            target: node_id.clone(),
                            label: String::new(),
                        });
                    }
                }
            }
        }

        for job in &jobs.items {
            let name = job.metadata.name.clone().unwrap_or_default();
            let node_id = format!("job:{}", name);
            if let Some(refs) = &job.metadata.owner_references {
                for oref in refs {
                    if let Some(parent_id) = uid_to_id.get(&oref.uid) {
                        edges.push(GraphEdge {
                            source: parent_id.clone(),
                            target: node_id.clone(),
                            label: String::new(),
                        });
                    }
                }
            }
        }

        for pod in &pods.items {
            let name = pod.metadata.name.clone().unwrap_or_default();
            let node_id = format!("pod:{}", name);
            if let Some(refs) = &pod.metadata.owner_references {
                for oref in refs {
                    if let Some(parent_id) = uid_to_id.get(&oref.uid) {
                        edges.push(GraphEdge {
                            source: parent_id.clone(),
                            target: node_id.clone(),
                            label: String::new(),
                        });
                    }
                }
            }
        }

        Ok(DependencyGraphData { nodes, edges })
    }
}
