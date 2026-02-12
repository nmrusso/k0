use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, StatefulSet};
use k8s_openapi::api::batch::v1::Job;
use k8s_openapi::api::core::v1::Pod;
use kube::{Api, Client};
use serde::Serialize;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::{Duration, Instant};

use crate::domain::errors::DomainError;

#[derive(Serialize, Clone)]
pub struct LogData {
    pub lines: Vec<String>,
}

pub async fn resolve_containers(
    client: &Client,
    namespace: &str,
    target_kind: &str,
    target_name: &str,
) -> Result<Vec<String>, DomainError> {
    match target_kind {
        "pod" => {
            let api: Api<Pod> = Api::namespaced(client.clone(), namespace);
            let pod = api.get(target_name).await?;
            let spec = pod.spec.unwrap_or_default();
            Ok(spec.containers.iter().map(|c| c.name.clone()).collect())
        }
        "deployment" => {
            let api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
            let dep = api.get(target_name).await?;
            let spec = dep.spec.and_then(|s| s.template.spec).unwrap_or_default();
            Ok(spec.containers.iter().map(|c| c.name.clone()).collect())
        }
        "statefulset" => {
            let api: Api<StatefulSet> = Api::namespaced(client.clone(), namespace);
            let sts = api.get(target_name).await?;
            let spec = sts.spec.and_then(|s| s.template.spec).unwrap_or_default();
            Ok(spec.containers.iter().map(|c| c.name.clone()).collect())
        }
        "daemonset" => {
            let api: Api<DaemonSet> = Api::namespaced(client.clone(), namespace);
            let ds = api.get(target_name).await?;
            let spec = ds.spec.and_then(|s| s.template.spec).unwrap_or_default();
            Ok(spec.containers.iter().map(|c| c.name.clone()).collect())
        }
        "job" => {
            let api: Api<Job> = Api::namespaced(client.clone(), namespace);
            let job = api.get(target_name).await?;
            let spec = job.spec.and_then(|s| s.template.spec).unwrap_or_default();
            Ok(spec.containers.iter().map(|c| c.name.clone()).collect())
        }
        _ => Err(DomainError::NotFound(format!("Unsupported target kind: {}", target_kind))),
    }
}

fn kubectl_target(target_kind: &str, target_name: &str) -> String {
    match target_kind {
        "pod" => target_name.to_string(),
        "deployment" => format!("deployment/{}", target_name),
        "statefulset" => format!("statefulset/{}", target_name),
        "daemonset" => format!("daemonset/{}", target_name),
        "job" => format!("job/{}", target_name),
        _ => target_name.to_string(),
    }
}

pub async fn stream_logs(
    session_id: String,
    context: String,
    namespace: String,
    target_kind: String,
    target_name: String,
    container: Option<String>,
    tail_lines: u64,
    since_seconds: Option<u64>,
    app_handle: tauri::AppHandle,
) {
    let target = kubectl_target(&target_kind, &target_name);

    let mut cmd = Command::new("kubectl");
    cmd.arg("logs")
        .arg("-f")
        .arg(&target)
        .arg("-n")
        .arg(&namespace)
        .arg("--context")
        .arg(&context)
        .arg("--tail")
        .arg(tail_lines.to_string());

    if let Some(secs) = since_seconds {
        cmd.arg("--since").arg(format!("{}s", secs));
    }

    if let Some(ref c) = container {
        cmd.arg("-c").arg(c);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let event_name = format!("log-data-{}", session_id);
            let _ = app_handle.emit(
                &event_name,
                LogData {
                    lines: vec![format!("[Failed to start kubectl: {}]", e)],
                },
            );
            let end_event = format!("log-ended-{}", session_id);
            let _ = app_handle.emit(&end_event, ());
            return;
        }
    };

    let stdout = child.stdout.take().expect("stdout should be piped");
    let stderr = child.stderr.take().expect("stderr should be piped");

    let stderr_event_name = format!("log-data-{}", session_id);
    let stderr_handle = app_handle.clone();
    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = stderr_handle.emit(
                &stderr_event_name,
                LogData {
                    lines: vec![format!("[stderr] {}", line)],
                },
            );
        }
    });

    let reader = BufReader::new(stdout);
    let mut lines_stream = reader.lines();

    let batch_duration = Duration::from_millis(50);
    let mut batch: Vec<String> = Vec::new();
    let mut last_emit = Instant::now();
    let event_name = format!("log-data-{}", session_id);

    loop {
        tokio::select! {
            result = lines_stream.next_line() => {
                match result {
                    Ok(Some(line)) => {
                        batch.push(line);
                        let now = Instant::now();
                        if now.duration_since(last_emit) >= batch_duration {
                            let _ = app_handle.emit(&event_name, LogData { lines: std::mem::take(&mut batch) });
                            last_emit = now;
                        }
                    }
                    Ok(None) => {
                        if !batch.is_empty() {
                            let _ = app_handle.emit(&event_name, LogData { lines: std::mem::take(&mut batch) });
                        }
                        break;
                    }
                    Err(e) => {
                        batch.push(format!("[Error reading logs: {}]", e));
                        if !batch.is_empty() {
                            let _ = app_handle.emit(&event_name, LogData { lines: std::mem::take(&mut batch) });
                        }
                        break;
                    }
                }
            }
            _ = tokio::time::sleep_until(last_emit + batch_duration), if !batch.is_empty() => {
                let _ = app_handle.emit(&event_name, LogData { lines: std::mem::take(&mut batch) });
                last_emit = Instant::now();
            }
        }
    }

    let _ = stderr_task.await;
    let _ = child.kill().await;

    let end_event = format!("log-ended-{}", session_id);
    let _ = app_handle.emit(&end_event, ());
}
