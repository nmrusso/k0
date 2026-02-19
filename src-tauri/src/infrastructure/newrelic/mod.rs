use std::collections::HashMap;

use crate::domain::entities::newrelic::{
    ActiveAlert, ActiveAlertsSummary, ContainerUsage, ContainerUsageSummary,
    MetricDataPoint, NamespaceMetricsSummary, NodeMetrics, PodMetrics,
};
use crate::domain::errors::DomainError;

pub async fn query_nrql(
    client: &reqwest::Client,
    api_key: &str,
    account_id: &str,
    nrql: &str,
) -> Result<serde_json::Value, DomainError> {
    let graphql_query = format!(
        r#"{{ actor {{ account(id: {}) {{ nrql(query: "{}") {{ results }} }} }} }}"#,
        account_id,
        nrql.replace('\\', "\\\\").replace('"', "\\\"")
    );

    let body = serde_json::json!({ "query": graphql_query });

    let resp = client
        .post("https://api.newrelic.com/graphql")
        .header("API-Key", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(DomainError::ExternalApi(format!(
            "NerdGraph returned {}: {}",
            status, text
        )));
    }

    let json: serde_json::Value = resp.json().await?;

    if let Some(errors) = json.get("errors") {
        if let Some(arr) = errors.as_array() {
            if !arr.is_empty() {
                return Err(DomainError::ExternalApi(format!(
                    "NerdGraph errors: {}",
                    serde_json::to_string(errors).unwrap_or_default()
                )));
            }
        }
    }

    let results = json
        .pointer("/data/actor/account/nrql/results")
        .cloned()
        .unwrap_or(serde_json::Value::Array(vec![]));

    Ok(results)
}

pub async fn get_pod_metrics(
    api_key: &str,
    account_id: &str,
    pod_name: &str,
    namespace: &str,
    cluster_name: &str,
    time_range_minutes: u32,
) -> Result<PodMetrics, DomainError> {
    let client = reqwest::Client::new();

    let cpu_nrql = format!(
        "SELECT average(cpuCoresUtilization) FROM K8sContainerSample WHERE podName = '{}' AND namespaceName = '{}' AND clusterName = '{}' TIMESERIES SINCE {} minutes ago",
        pod_name, namespace, cluster_name, time_range_minutes
    );
    let mem_nrql = format!(
        "SELECT average(memoryWorkingSetBytes) FROM K8sContainerSample WHERE podName = '{}' AND namespaceName = '{}' AND clusterName = '{}' TIMESERIES SINCE {} minutes ago",
        pod_name, namespace, cluster_name, time_range_minutes
    );

    let (cpu_results, mem_results) = tokio::try_join!(
        query_nrql(&client, api_key, account_id, &cpu_nrql),
        query_nrql(&client, api_key, account_id, &mem_nrql),
    )?;

    let cpu_arr = cpu_results.as_array().cloned().unwrap_or_default();
    let mem_arr = mem_results.as_array().cloned().unwrap_or_default();

    // Build timeseries by joining CPU and memory results on timestamp
    let mut mem_by_ts: HashMap<i64, f64> = HashMap::new();
    for item in &mem_arr {
        if let (Some(ts), Some(val)) = (
            item.get("beginTimeSeconds").and_then(|v| v.as_f64()),
            item.get("average.memoryWorkingSetBytes").and_then(|v| v.as_f64()),
        ) {
            mem_by_ts.insert((ts * 1000.0) as i64, val);
        }
    }

    let mut timeseries = Vec::new();
    let mut cpu_sum = 0.0;
    let mut cpu_count = 0;

    for item in &cpu_arr {
        if let Some(ts) = item.get("beginTimeSeconds").and_then(|v| v.as_f64()) {
            let ts_millis = (ts * 1000.0) as i64;
            let cpu_val = item
                .get("average.cpuCoresUtilization")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let mem_val = mem_by_ts.get(&ts_millis).copied().unwrap_or(0.0);

            cpu_sum += cpu_val;
            cpu_count += 1;

            timeseries.push(MetricDataPoint {
                timestamp: ts_millis,
                cpu_cores: cpu_val,
                memory_bytes: mem_val,
            });
        }
    }

    let avg_cpu = if cpu_count > 0 {
        cpu_sum / cpu_count as f64
    } else {
        0.0
    };

    let mem_sum: f64 = mem_arr
        .iter()
        .filter_map(|item| item.get("average.memoryWorkingSetBytes").and_then(|v| v.as_f64()))
        .sum();
    let mem_count = mem_arr
        .iter()
        .filter(|item| item.get("average.memoryWorkingSetBytes").and_then(|v| v.as_f64()).is_some())
        .count();
    let avg_mem = if mem_count > 0 {
        mem_sum / mem_count as f64
    } else {
        0.0
    };

    Ok(PodMetrics {
        pod_name: pod_name.to_string(),
        cpu_usage_cores: avg_cpu,
        memory_usage_bytes: avg_mem,
        cpu_limit_cores: None,
        memory_limit_bytes: None,
        timeseries,
    })
}

pub async fn get_namespace_metrics(
    api_key: &str,
    account_id: &str,
    namespace: &str,
    cluster_name: &str,
    time_range_minutes: u32,
) -> Result<NamespaceMetricsSummary, DomainError> {
    let client = reqwest::Client::new();

    let cpu_nrql = format!(
        "SELECT average(cpuCoresUtilization) FROM K8sContainerSample WHERE namespaceName = '{}' AND clusterName = '{}' FACET podName TIMESERIES SINCE {} minutes ago",
        namespace, cluster_name, time_range_minutes
    );
    let mem_nrql = format!(
        "SELECT average(memoryWorkingSetBytes) FROM K8sContainerSample WHERE namespaceName = '{}' AND clusterName = '{}' FACET podName TIMESERIES SINCE {} minutes ago",
        namespace, cluster_name, time_range_minutes
    );

    let (cpu_results, mem_results) = tokio::try_join!(
        query_nrql(&client, api_key, account_id, &cpu_nrql),
        query_nrql(&client, api_key, account_id, &mem_nrql),
    )?;

    let cpu_arr = cpu_results.as_array().cloned().unwrap_or_default();
    let mem_arr = mem_results.as_array().cloned().unwrap_or_default();

    // Group by pod name
    let mut pod_cpu: HashMap<String, Vec<(i64, f64)>> = HashMap::new();
    for item in &cpu_arr {
        if let Some(pod) = item.get("facet").and_then(|v| v.as_str()) {
            if let Some(ts) = item.get("beginTimeSeconds").and_then(|v| v.as_f64()) {
                let val = item
                    .get("average.cpuCoresUtilization")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                pod_cpu
                    .entry(pod.to_string())
                    .or_default()
                    .push(((ts * 1000.0) as i64, val));
            }
        }
    }

    let mut pod_mem: HashMap<String, Vec<(i64, f64)>> = HashMap::new();
    for item in &mem_arr {
        if let Some(pod) = item.get("facet").and_then(|v| v.as_str()) {
            if let Some(ts) = item.get("beginTimeSeconds").and_then(|v| v.as_f64()) {
                let val = item
                    .get("average.memoryWorkingSetBytes")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                pod_mem
                    .entry(pod.to_string())
                    .or_default()
                    .push(((ts * 1000.0) as i64, val));
            }
        }
    }

    // Collect all pod names
    let mut all_pods: std::collections::HashSet<String> = pod_cpu.keys().cloned().collect();
    all_pods.extend(pod_mem.keys().cloned());

    let mut pods = Vec::new();
    for pod_name in all_pods {
        let cpu_points = pod_cpu.get(&pod_name).cloned().unwrap_or_default();
        let mem_points = pod_mem.get(&pod_name).cloned().unwrap_or_default();

        let mem_by_ts: HashMap<i64, f64> = mem_points.iter().copied().collect();

        let mut timeseries = Vec::new();
        for (ts, cpu_val) in &cpu_points {
            let mem_val = mem_by_ts.get(ts).copied().unwrap_or(0.0);
            timeseries.push(MetricDataPoint {
                timestamp: *ts,
                cpu_cores: *cpu_val,
                memory_bytes: mem_val,
            });
        }

        let avg_cpu = if cpu_points.is_empty() {
            0.0
        } else {
            cpu_points.iter().map(|(_, v)| v).sum::<f64>() / cpu_points.len() as f64
        };
        let avg_mem = if mem_points.is_empty() {
            0.0
        } else {
            mem_points.iter().map(|(_, v)| v).sum::<f64>() / mem_points.len() as f64
        };

        pods.push(PodMetrics {
            pod_name,
            cpu_usage_cores: avg_cpu,
            memory_usage_bytes: avg_mem,
            cpu_limit_cores: None,
            memory_limit_bytes: None,
            timeseries,
        });
    }

    // Sort by CPU descending
    pods.sort_by(|a, b| b.cpu_usage_cores.partial_cmp(&a.cpu_usage_cores).unwrap_or(std::cmp::Ordering::Equal));

    Ok(NamespaceMetricsSummary { pods })
}

pub async fn get_node_metrics(
    api_key: &str,
    account_id: &str,
    cluster_name: &str,
) -> Result<Vec<NodeMetrics>, DomainError> {
    let client = reqwest::Client::new();

    let nrql = format!(
        "SELECT latest(cpuUsedCores), latest(allocatableCpuCores), latest(allocatableCpuCoresUtilization), latest(memoryWorkingSetBytes), latest(allocatableMemoryBytes), latest(fsUsedBytes), latest(fsCapacityBytes), latest(allocatablePods), latest(capacityPods) FROM K8sNodeSample WHERE clusterName = '{}' FACET nodeName SINCE 5 minutes ago",
        cluster_name
    );

    let results = query_nrql(&client, api_key, account_id, &nrql).await?;
    let arr = results.as_array().cloned().unwrap_or_default();

    let mut nodes = Vec::new();
    for item in &arr {
        let node_name = item.get("facet").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if node_name.is_empty() {
            continue;
        }
        nodes.push(NodeMetrics {
            node_name,
            cpu_used_cores: item.get("latest.cpuUsedCores").and_then(|v| v.as_f64()).unwrap_or(0.0),
            allocatable_cpu_cores: item.get("latest.allocatableCpuCores").and_then(|v| v.as_f64()).unwrap_or(0.0),
            cpu_utilization_pct: item.get("latest.allocatableCpuCoresUtilization").and_then(|v| v.as_f64()).unwrap_or(0.0),
            memory_working_set_bytes: item.get("latest.memoryWorkingSetBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
            allocatable_memory_bytes: item.get("latest.allocatableMemoryBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
            fs_used_bytes: item.get("latest.fsUsedBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
            fs_capacity_bytes: item.get("latest.fsCapacityBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
            allocatable_pods: item.get("latest.allocatablePods").and_then(|v| v.as_f64()).unwrap_or(0.0),
            capacity_pods: item.get("latest.capacityPods").and_then(|v| v.as_f64()).unwrap_or(0.0),
        });
    }

    Ok(nodes)
}

pub async fn get_active_alerts(
    api_key: &str,
    account_id: &str,
    cluster_name: &str,
) -> Result<ActiveAlertsSummary, DomainError> {
    let client = reqwest::Client::new();

    let nrql = format!(
        "SELECT conditionName, policyName, targetName, priority, openTime FROM NrAiIncident WHERE event = 'open' AND tags.clusterName = '{}' SINCE 2 hours ago LIMIT 100",
        cluster_name
    );

    let results = query_nrql(&client, api_key, account_id, &nrql).await?;
    let arr = results.as_array().cloned().unwrap_or_default();

    let mut alerts: Vec<ActiveAlert> = arr
        .iter()
        .map(|item| ActiveAlert {
            condition_name: item.get("conditionName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            policy_name: item.get("policyName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            target_name: item.get("targetName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            priority: item.get("priority").and_then(|v| v.as_str()).unwrap_or("warning").to_string(),
            open_time: item.get("openTime").and_then(|v| v.as_i64()).unwrap_or(0),
        })
        .collect();

    // Sort critical-first, then by open_time descending
    alerts.sort_by(|a, b| {
        let pri_a = if a.priority == "critical" { 0 } else { 1 };
        let pri_b = if b.priority == "critical" { 0 } else { 1 };
        pri_a.cmp(&pri_b).then(b.open_time.cmp(&a.open_time))
    });

    Ok(ActiveAlertsSummary { alerts })
}

pub async fn get_container_usage(
    api_key: &str,
    account_id: &str,
    pod_name: &str,
    namespace: &str,
    cluster_name: &str,
) -> Result<ContainerUsageSummary, DomainError> {
    let client = reqwest::Client::new();

    let nrql = format!(
        "SELECT latest(cpuUsedCores), latest(cpuLimitCores), latest(cpuRequestedCores), latest(memoryWorkingSetBytes), latest(memoryLimitBytes), latest(memoryRequestedBytes) FROM K8sContainerSample WHERE podName = '{}' AND namespaceName = '{}' AND clusterName = '{}' FACET containerName SINCE 5 minutes ago",
        pod_name, namespace, cluster_name
    );

    let results = query_nrql(&client, api_key, account_id, &nrql).await?;
    let arr = results.as_array().cloned().unwrap_or_default();

    let containers: Vec<ContainerUsage> = arr
        .iter()
        .filter_map(|item| {
            let container_name = item.get("facet").and_then(|v| v.as_str())?.to_string();
            Some(ContainerUsage {
                container_name,
                cpu_used_cores: item.get("latest.cpuUsedCores").and_then(|v| v.as_f64()).unwrap_or(0.0),
                cpu_limit_cores: item.get("latest.cpuLimitCores").and_then(|v| v.as_f64()).unwrap_or(0.0),
                cpu_requested_cores: item.get("latest.cpuRequestedCores").and_then(|v| v.as_f64()).unwrap_or(0.0),
                memory_working_set_bytes: item.get("latest.memoryWorkingSetBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
                memory_limit_bytes: item.get("latest.memoryLimitBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
                memory_requested_bytes: item.get("latest.memoryRequestedBytes").and_then(|v| v.as_f64()).unwrap_or(0.0),
            })
        })
        .collect();

    Ok(ContainerUsageSummary { containers })
}
