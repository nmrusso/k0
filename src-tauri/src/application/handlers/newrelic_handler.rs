use crate::domain::entities::newrelic::{
    ActiveAlertsSummary, ContainerUsageSummary, NamespaceMetricsSummary, NodeMetrics, PodMetrics,
};
use crate::domain::errors::DomainError;
use crate::infrastructure::newrelic;

pub struct NewRelicHandler;

impl NewRelicHandler {
    pub async fn get_pod_metrics(
        api_key: &str,
        account_id: &str,
        pod_name: &str,
        namespace: &str,
        cluster_name: &str,
        time_range_minutes: u32,
    ) -> Result<PodMetrics, DomainError> {
        newrelic::get_pod_metrics(api_key, account_id, pod_name, namespace, cluster_name, time_range_minutes)
            .await
    }

    pub async fn get_namespace_metrics(
        api_key: &str,
        account_id: &str,
        namespace: &str,
        cluster_name: &str,
        time_range_minutes: u32,
    ) -> Result<NamespaceMetricsSummary, DomainError> {
        newrelic::get_namespace_metrics(api_key, account_id, namespace, cluster_name, time_range_minutes).await
    }

    pub async fn get_node_metrics(
        api_key: &str,
        account_id: &str,
        cluster_name: &str,
    ) -> Result<Vec<NodeMetrics>, DomainError> {
        newrelic::get_node_metrics(api_key, account_id, cluster_name).await
    }

    pub async fn get_active_alerts(
        api_key: &str,
        account_id: &str,
        cluster_name: &str,
    ) -> Result<ActiveAlertsSummary, DomainError> {
        newrelic::get_active_alerts(api_key, account_id, cluster_name).await
    }

    pub async fn get_container_usage(
        api_key: &str,
        account_id: &str,
        pod_name: &str,
        namespace: &str,
        cluster_name: &str,
    ) -> Result<ContainerUsageSummary, DomainError> {
        newrelic::get_container_usage(api_key, account_id, pod_name, namespace, cluster_name).await
    }
}
