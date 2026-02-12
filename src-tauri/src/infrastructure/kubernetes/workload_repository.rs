use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::batch::v1::{CronJob, Job};
use k8s_openapi::api::core::v1::ReplicationController;
use kube::{api::ListParams, Api, Client};

use crate::application::services::formatting::format_age;
use crate::domain::entities::workload::*;
use crate::domain::errors::DomainError;

pub async fn list_deployments(client: &Client, namespace: &str) -> Result<Vec<DeploymentInfo>, DomainError> {
    let api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|dep| {
            let meta = dep.metadata;
            let status = dep.status.unwrap_or_default();
            let spec = dep.spec.unwrap_or_default();

            let replicas = spec.replicas.unwrap_or(0);
            let ready = status.ready_replicas.unwrap_or(0);

            DeploymentInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                ready: format!("{}/{}", ready, replicas),
                up_to_date: status.updated_replicas.unwrap_or(0),
                available: status.available_replicas.unwrap_or(0),
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_daemonsets(client: &Client, namespace: &str) -> Result<Vec<DaemonSetInfo>, DomainError> {
    let api: Api<DaemonSet> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|ds| {
            let meta = ds.metadata;
            let status = ds.status.unwrap_or_default();

            DaemonSetInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                desired: status.desired_number_scheduled,
                current: status.current_number_scheduled,
                ready: status.number_ready,
                available: status.number_available.unwrap_or(0),
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_statefulsets(client: &Client, namespace: &str) -> Result<Vec<StatefulSetInfo>, DomainError> {
    let api: Api<StatefulSet> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|ss| {
            let meta = ss.metadata;
            let status = ss.status.unwrap_or_default();
            let spec = ss.spec.unwrap_or_default();

            let replicas = spec.replicas.unwrap_or(0);
            let ready = status.ready_replicas.unwrap_or(0);

            StatefulSetInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                ready: format!("{}/{}", ready, replicas),
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_replicasets(client: &Client, namespace: &str) -> Result<Vec<ReplicaSetInfo>, DomainError> {
    let api: Api<ReplicaSet> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|rs| {
            let meta = rs.metadata;
            let status = rs.status.unwrap_or_default();
            let spec = rs.spec.unwrap_or_default();

            ReplicaSetInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                desired: spec.replicas.unwrap_or(0),
                current: status.replicas,
                ready: status.ready_replicas.unwrap_or(0),
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_replication_controllers(client: &Client, namespace: &str) -> Result<Vec<ReplicationControllerInfo>, DomainError> {
    let api: Api<ReplicationController> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|rc| {
            let meta = rc.metadata;
            let status = rc.status.unwrap_or_default();
            let spec = rc.spec.unwrap_or_default();

            ReplicationControllerInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                desired: spec.replicas.unwrap_or(0),
                current: status.replicas,
                ready: status.ready_replicas.unwrap_or(0),
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}

pub async fn list_jobs(client: &Client, namespace: &str) -> Result<Vec<JobInfo>, DomainError> {
    let api: Api<Job> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|job| {
            let meta = job.metadata;
            let status = job.status.unwrap_or_default();
            let spec = job.spec.unwrap_or_default();

            let completions = spec.completions.unwrap_or(1);
            let succeeded = status.succeeded.unwrap_or(0);

            let job_status = if status.active.unwrap_or(0) > 0 {
                "Running".to_string()
            } else if succeeded >= completions {
                "Complete".to_string()
            } else {
                "Failed".to_string()
            };

            let duration = match (status.start_time.as_ref(), status.completion_time.as_ref()) {
                (Some(start), Some(end)) => {
                    let dur = end.0.signed_duration_since(start.0);
                    format!("{}s", dur.num_seconds())
                }
                _ => "-".to_string(),
            };

            JobInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                completions: format!("{}/{}", succeeded, completions),
                duration,
                age: format_age(meta.creation_timestamp.as_ref()),
                status: job_status,
            }
        })
        .collect())
}

pub async fn list_cronjobs(client: &Client, namespace: &str) -> Result<Vec<CronJobInfo>, DomainError> {
    let api: Api<CronJob> = Api::namespaced(client.clone(), namespace);
    let list = api.list(&ListParams::default()).await?;

    Ok(list
        .items
        .into_iter()
        .map(|cj| {
            let meta = cj.metadata;
            let spec = cj.spec.unwrap_or_default();
            let status = cj.status.unwrap_or_default();

            CronJobInfo {
                name: meta.name.unwrap_or_default(),
                namespace: meta.namespace.unwrap_or_default(),
                schedule: spec.schedule,
                suspend: spec.suspend.unwrap_or(false),
                active: status.active.map(|a| a.len() as i32).unwrap_or(0),
                last_schedule: status
                    .last_schedule_time
                    .as_ref()
                    .map(|t| format_age(Some(t)))
                    .unwrap_or_else(|| "-".to_string()),
                age: format_age(meta.creation_timestamp.as_ref()),
            }
        })
        .collect())
}
