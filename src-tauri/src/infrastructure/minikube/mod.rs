use serde::Deserialize;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::domain::entities::minikube::{
    MinikubeAddon, MinikubeProfile, MinikubeServiceEntry, MinikubeStatus,
};
use crate::domain::errors::DomainError;

async fn run_minikube(args: &[&str]) -> Result<String, DomainError> {
    let mut cmd = Command::new("minikube");
    for arg in args {
        cmd.arg(arg);
    }

    let output = cmd.output().await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            DomainError::Configuration(
                "minikube CLI not found. Install: https://minikube.sigs.k8s.io/docs/start/"
                    .to_string(),
            )
        } else {
            DomainError::Configuration(format!("Failed to run minikube: {}", e))
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(DomainError::Configuration(format!(
            "minikube command failed: {}",
            stderr.trim()
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub async fn check_installed() -> bool {
    Command::new("minikube")
        .arg("version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// --- Profile list parsing ---

#[derive(Deserialize)]
struct ProfileListOutput {
    valid: Option<Vec<ProfileEntry>>,
}

#[derive(Deserialize)]
struct ProfileEntry {
    #[serde(alias = "Name")]
    name: String,
    #[serde(alias = "Status")]
    status: String,
    #[serde(alias = "Config")]
    config: ProfileConfig,
}

#[derive(Deserialize)]
struct ProfileConfig {
    #[serde(alias = "Driver")]
    #[serde(default)]
    driver: String,
    #[serde(alias = "ContainerRuntime", default)]
    container_runtime: String,
    #[serde(alias = "KubernetesConfig")]
    kubernetes_config: KubernetesConfig,
    #[serde(alias = "CPUs", alias = "cpus", default)]
    cpus: u32,
    #[serde(alias = "Memory", alias = "memory", default)]
    memory: u64,
    #[serde(alias = "Nodes", default)]
    nodes: Option<Vec<serde_json::Value>>,
}

#[derive(Deserialize)]
struct KubernetesConfig {
    #[serde(alias = "KubernetesVersion", default)]
    kubernetes_version: String,
}

pub async fn list_profiles() -> Result<Vec<MinikubeProfile>, DomainError> {
    let output = run_minikube(&["profile", "list", "-o", "json"]).await?;
    if output.trim().is_empty() {
        return Ok(vec![]);
    }

    let parsed: ProfileListOutput =
        serde_json::from_str(&output).map_err(|e| {
            DomainError::Serialization(format!("Failed to parse minikube profiles: {}", e))
        })?;

    let profiles = parsed.valid.unwrap_or_default();
    let mut result = Vec::new();
    for p in profiles {
        let node_count = p.config.nodes.map(|n| n.len() as u32).unwrap_or(1);
        // Get IP for running profiles
        let ip = if p.status == "Running" {
            run_minikube(&["ip", "-p", &p.name])
                .await
                .unwrap_or_default()
                .trim()
                .to_string()
        } else {
            String::new()
        };
        result.push(MinikubeProfile {
            name: p.name,
            status: p.status,
            driver: p.config.driver,
            container_runtime: p.config.container_runtime,
            kubernetes_version: p.config.kubernetes_config.kubernetes_version,
            cpus: p.config.cpus,
            memory: p.config.memory,
            nodes: node_count,
            ip,
        });
    }
    Ok(result)
}

// --- Status parsing ---

#[derive(Deserialize)]
struct StatusOutput {
    #[serde(alias = "Name", default)]
    name: String,
    #[serde(alias = "Host", default)]
    host: String,
    #[serde(alias = "Kubelet", default)]
    kubelet: String,
    #[serde(alias = "APIServer", default)]
    apiserver: String,
    #[serde(alias = "Kubeconfig", default)]
    kubeconfig: String,
}

pub async fn get_status(profile: &str) -> Result<MinikubeStatus, DomainError> {
    let output = run_minikube(&["status", "-p", profile, "-o", "json"]).await?;
    let parsed: StatusOutput = serde_json::from_str(&output).map_err(|e| {
        DomainError::Serialization(format!("Failed to parse minikube status: {}", e))
    })?;
    Ok(MinikubeStatus {
        name: parsed.name,
        host: parsed.host,
        kubelet: parsed.kubelet,
        apiserver: parsed.apiserver,
        kubeconfig: parsed.kubeconfig,
    })
}

// --- Streaming operations (start/stop/delete) ---

pub async fn start_cluster(
    profile: String,
    cpus: Option<String>,
    memory: Option<String>,
    driver: Option<String>,
    kubernetes_version: Option<String>,
    session_id: String,
    app_handle: tauri::AppHandle,
) {
    let mut cmd = Command::new("minikube");
    cmd.arg("start").arg("-p").arg(&profile);

    if let Some(ref c) = cpus {
        cmd.arg("--cpus").arg(c);
    }
    if let Some(ref m) = memory {
        cmd.arg("--memory").arg(m);
    }
    if let Some(ref d) = driver {
        cmd.arg("--driver").arg(d);
    }
    if let Some(ref v) = kubernetes_version {
        cmd.arg("--kubernetes-version").arg(v);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    stream_command(cmd, &session_id, &app_handle).await;
}

pub async fn stop_cluster(profile: String, session_id: String, app_handle: tauri::AppHandle) {
    let mut cmd = Command::new("minikube");
    cmd.arg("stop").arg("-p").arg(&profile);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    stream_command(cmd, &session_id, &app_handle).await;
}

pub async fn delete_cluster(profile: String, session_id: String, app_handle: tauri::AppHandle) {
    let mut cmd = Command::new("minikube");
    cmd.arg("delete").arg("-p").arg(&profile);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    stream_command(cmd, &session_id, &app_handle).await;
}

async fn stream_command(mut cmd: Command, session_id: &str, app_handle: &tauri::AppHandle) {
    let output_event = format!("minikube-output-{}", session_id);
    let done_event = format!("minikube-done-{}", session_id);

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let _ = app_handle.emit(&output_event, format!("[Error] Failed to start minikube: {}", e));
            let _ = app_handle.emit(&done_event, false);
            return;
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stderr
    let stderr_event = output_event.clone();
    let stderr_handle = app_handle.clone();
    let stderr_task = tokio::spawn(async move {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = stderr_handle.emit(&stderr_event, &line);
            }
        }
    });

    // Stream stdout
    let stdout_event = output_event.clone();
    let stdout_handle = app_handle.clone();
    let stdout_task = tokio::spawn(async move {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = stdout_handle.emit(&stdout_event, &line);
            }
        }
    });

    let _ = stderr_task.await;
    let _ = stdout_task.await;

    let status = child.wait().await;
    let success = status.map(|s| s.success()).unwrap_or(false);
    let _ = app_handle.emit(&done_event, success);
}

// --- Addons ---

#[derive(Deserialize)]
struct AddonsOutput {
    #[serde(flatten)]
    addons: std::collections::HashMap<String, AddonEntry>,
}

#[derive(Deserialize)]
struct AddonEntry {
    #[serde(alias = "Status")]
    status: String,
    #[serde(alias = "Profile")]
    #[serde(default)]
    profile: String,
}

pub async fn list_addons(profile: &str) -> Result<Vec<MinikubeAddon>, DomainError> {
    let output = run_minikube(&["addons", "list", "-p", profile, "-o", "json"]).await?;
    if output.trim().is_empty() {
        return Ok(vec![]);
    }

    let parsed: AddonsOutput = serde_json::from_str(&output).map_err(|e| {
        DomainError::Serialization(format!("Failed to parse minikube addons: {}", e))
    })?;

    let mut addons: Vec<MinikubeAddon> = parsed
        .addons
        .into_iter()
        .map(|(name, entry)| MinikubeAddon {
            name,
            enabled: entry.status == "enabled",
            profile: entry.profile,
        })
        .collect();
    addons.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(addons)
}

pub async fn toggle_addon(
    profile: &str,
    addon_name: &str,
    enable: bool,
) -> Result<String, DomainError> {
    let action = if enable { "enable" } else { "disable" };
    run_minikube(&["addons", action, addon_name, "-p", profile]).await
}

// --- Services ---

pub async fn list_services(profile: &str) -> Result<Vec<MinikubeServiceEntry>, DomainError> {
    let output = run_minikube(&["service", "list", "-p", profile, "-o", "json"]).await?;
    if output.trim().is_empty() {
        return Ok(vec![]);
    }

    // minikube service list -o json returns an array of objects
    let parsed: Vec<serde_json::Value> = serde_json::from_str(&output).map_err(|e| {
        DomainError::Serialization(format!("Failed to parse minikube services: {}", e))
    })?;

    let mut services = Vec::new();
    for item in parsed {
        let namespace = item["namespace"].as_str().unwrap_or("").to_string();
        let name = item["name"].as_str().unwrap_or("").to_string();
        let target_port = item["targetPort"]
            .as_str()
            .or_else(|| item["targetPort"].as_i64().map(|_| ""))
            .unwrap_or("")
            .to_string();
        let url = if let Some(urls) = item["urls"].as_array() {
            urls.iter()
                .filter_map(|u| u.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        } else {
            String::new()
        };
        services.push(MinikubeServiceEntry {
            namespace,
            name,
            target_port,
            url,
        });
    }
    Ok(services)
}

// --- Dashboard URL ---

pub async fn get_dashboard_url(profile: &str) -> Result<String, DomainError> {
    let mut cmd = Command::new("minikube");
    cmd.arg("dashboard")
        .arg("--url")
        .arg("-p")
        .arg(profile);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        DomainError::Configuration(format!("Failed to start minikube dashboard: {}", e))
    })?;

    let stdout = child.stdout.take().ok_or_else(|| {
        DomainError::Configuration("Failed to capture dashboard stdout".to_string())
    })?;

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    let url = tokio::time::timeout(std::time::Duration::from_secs(30), async {
        while let Ok(Some(line)) = lines.next_line().await {
            if line.contains("http://") || line.contains("https://") {
                // Extract URL from line
                let trimmed = line.trim();
                if let Some(start) = trimmed.find("http") {
                    return Some(trimmed[start..].to_string());
                }
            }
        }
        None
    })
    .await
    .map_err(|_| DomainError::Configuration("Timeout waiting for dashboard URL".to_string()))?
    .ok_or_else(|| {
        DomainError::Configuration("Dashboard process exited without producing a URL".to_string())
    })?;

    // Kill the dashboard process since we just need the URL
    let _ = child.kill().await;

    Ok(url)
}

// --- IP ---

pub async fn get_ip(profile: &str) -> Result<String, DomainError> {
    let output = run_minikube(&["ip", "-p", profile]).await?;
    Ok(output.trim().to_string())
}
