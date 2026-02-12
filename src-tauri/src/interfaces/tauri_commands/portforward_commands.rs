use tauri::State;

use crate::domain::entities::PortForwardEntry;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn start_port_forward(
    target_kind: String,
    target_name: String,
    remote_port: u16,
    local_port: Option<u16>,
    state: State<'_, AppState>,
) -> Result<PortForwardEntry, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;

    let actual_local = local_port.unwrap_or(remote_port);
    let id = uuid::Uuid::new_v4().to_string();

    // Build kubectl port-forward command
    let resource = match target_kind.as_str() {
        "pod" => format!("pod/{}", target_name),
        "service" | "svc" => format!("svc/{}", target_name),
        _ => format!("{}/{}", target_kind, target_name),
    };

    let child = std::process::Command::new("kubectl")
        .arg("port-forward")
        .arg(&resource)
        .arg(format!("{}:{}", actual_local, remote_port))
        .arg("-n")
        .arg(&ns)
        .arg("--context")
        .arg(&ctx)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start port-forward: {}", e))?;

    let entry = PortForwardEntry {
        id: id.clone(),
        target_kind: target_kind.clone(),
        target_name: target_name.clone(),
        local_port: actual_local,
        remote_port,
    };

    {
        let mut pfs = state.port_forwards.lock().await;
        pfs.insert(id, (entry.clone(), child));
    }

    Ok(entry)
}

#[tauri::command]
pub async fn stop_port_forward(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pfs = state.port_forwards.lock().await;
    if let Some((_, mut child)) = pfs.remove(&id) {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
pub async fn list_port_forwards(
    state: State<'_, AppState>,
) -> Result<Vec<PortForwardEntry>, String> {
    let pfs = state.port_forwards.lock().await;
    Ok(pfs.values().map(|(entry, _)| entry.clone()).collect())
}
