use std::collections::HashMap;
use std::process::Command;
use tauri::State;

use crate::infrastructure::watchers::pod_watcher::run_pod_watcher;
use crate::interfaces::state::AppState;

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
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    crate::application::handlers::pod_handler::PodHandler::delete(&client, &ns, &name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn exec_pod_shell(
    name: String,
    container: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (_, ns, ctx) = state.client_manager.get_active_client_and_context().await.map_err(String::from)?;

    let kubectl_cmd = format!(
        "kubectl exec -it {} -n {} --context {} -c {} -- /bin/sh",
        name, ns, ctx, container
    );

    let terminals: Vec<(&str, Vec<&str>)> = vec![
        ("gnome-terminal", vec!["--", "sh", "-c"]),
        ("konsole", vec!["-e", "sh", "-c"]),
        ("xfce4-terminal", vec!["-e", "sh", "-c"]),
        ("xterm", vec!["-e", "sh", "-c"]),
        ("x-terminal-emulator", vec!["-e", "sh", "-c"]),
    ];

    for (term, args) in &terminals {
        let mut cmd = Command::new(term);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.arg(&kubectl_cmd);

        match cmd.spawn() {
            Ok(_) => return Ok(()),
            Err(_) => continue,
        }
    }

    Err("No supported terminal emulator found. Tried: gnome-terminal, konsole, xfce4-terminal, xterm, x-terminal-emulator".to_string())
}
