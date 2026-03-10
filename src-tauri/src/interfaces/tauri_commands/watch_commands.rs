use std::collections::HashMap;
use std::process::Command;
use tauri::State;

use crate::infrastructure::watchers::pod_watcher::run_pod_watcher;
use crate::interfaces::state::AppState;
use crate::interfaces::tauri_commands::sanitize_error_msg;

#[tauri::command]
pub fn get_process_env() -> HashMap<String, String> {
    std::env::vars().collect()
}

#[tauri::command]
pub async fn start_watching_pods(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Abort previous watcher if any
    {
        let mut handle = state.pod_watch_handle.lock().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }

    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;

    let handle = tokio::spawn(run_pod_watcher(client, ns, app_handle));

    let mut watch_handle = state.pod_watch_handle.lock().await;
    *watch_handle = Some(handle);

    Ok(())
}

#[tauri::command]
pub async fn stop_watching_pods(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut handle = state.pod_watch_handle.lock().await;
    if let Some(h) = handle.take() {
        h.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_pod(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(|e| sanitize_error_msg(e.to_string()))?;
    crate::application::handlers::pod_handler::PodHandler::delete(&client, &ns, &name)
        .await
        .map_err(|e| sanitize_error_msg(e.to_string()))
}

/// Validates that a string only contains characters valid in Kubernetes names.
/// Prevents command injection when values are passed as process arguments.
fn validate_k8s_name(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} must not be empty", field));
    }
    let valid = value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_');
    if !valid {
        return Err(format!("{} contains invalid characters", field));
    }
    Ok(())
}

#[tauri::command]
pub async fn exec_pod_shell(
    name: String,
    container: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    validate_k8s_name(&name, "pod name")?;
    validate_k8s_name(&container, "container name")?;

    let (_, ns, ctx) = state.client_manager.get_active_client_and_context().await.map_err(String::from)?;

    validate_k8s_name(&ns, "namespace")?;

    // kubectl args passed as a separate Vec — no shell interpolation, no injection risk.
    // Each terminal receives: <terminal> <prefix> kubectl exec -it <name> -n <ns> --context <ctx> -c <container> -- /bin/sh
    let kubectl_args = [
        "exec", "-it", name.as_str(), "-n", ns.as_str(),
        "--context", ctx.as_str(), "-c", container.as_str(), "--", "/bin/sh",
    ];

    // (terminal, args that precede "kubectl")
    let terminals: &[(&str, &[&str])] = &[
        ("gnome-terminal", &["--"]),
        ("konsole",         &["-e"]),
        ("xfce4-terminal",  &["-e"]),
        ("xterm",           &["-e"]),
        ("x-terminal-emulator", &["-e"]),
    ];

    for (term, prefix) in terminals {
        let mut cmd = Command::new(term);
        cmd.args(*prefix);
        cmd.arg("kubectl");
        cmd.args(kubectl_args);

        match cmd.spawn() {
            Ok(_) => return Ok(()),
            Err(_) => continue,
        }
    }

    Err("No supported terminal emulator found. Tried: gnome-terminal, konsole, xfce4-terminal, xterm, x-terminal-emulator".to_string())
}
