use std::collections::HashSet;

use kube::Client;

use crate::domain::entities::incident::*;
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::incident_repository;

pub struct IncidentHandler;

impl IncidentHandler {
    pub async fn get_incident_summary(
        client: &Client,
        namespace: &str,
    ) -> Result<IncidentSummary, DomainError> {
        // Run unhealthy, changes, events, and saturation in parallel
        let (unhealthy_result, changes_result, events_result, saturation_result) = tokio::join!(
            incident_repository::find_unhealthy_workloads(client, namespace),
            incident_repository::detect_recent_changes(client, namespace, 15),
            incident_repository::fetch_namespace_events(client, namespace, Some(30)),
            incident_repository::get_workload_saturation(client, namespace),
        );

        let unhealthy_workloads = unhealthy_result?;
        let recent_changes = changes_result?;
        let saturation = saturation_result?;

        // Filter to only Warning events
        let error_events: Vec<NamespaceEventInfo> = events_result?
            .into_iter()
            .filter(|e| e.event_type == "Warning")
            .collect();

        // Affected routes depends on unhealthy workloads
        let unhealthy_names: HashSet<String> =
            unhealthy_workloads.iter().map(|w| w.name.clone()).collect();
        let affected_routes =
            incident_repository::find_affected_routes(client, namespace, &unhealthy_names).await?;

        Ok(IncidentSummary {
            unhealthy_workloads,
            recent_changes,
            error_events,
            saturation,
            affected_routes,
        })
    }

    pub async fn get_what_changed(
        client: &Client,
        namespace: &str,
        since_minutes: u32,
    ) -> Result<Vec<ChangeEvent>, DomainError> {
        incident_repository::detect_recent_changes(client, namespace, since_minutes).await
    }

    pub async fn get_rollout_timeline(
        client: &Client,
        namespace: &str,
        deployment_name: &str,
    ) -> Result<RolloutTimeline, DomainError> {
        incident_repository::build_rollout_timeline(client, namespace, deployment_name).await
    }

    pub async fn get_namespace_events(
        client: &Client,
        namespace: &str,
        since_minutes: Option<u32>,
    ) -> Result<Vec<NamespaceEventInfo>, DomainError> {
        incident_repository::fetch_namespace_events(client, namespace, since_minutes).await
    }
}
