use tauri::State;

use crate::infrastructure::streams::log_streamer;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn start_log_stream(
    session_id: String,
    target_kind: String,
    target_name: String,
    container: Option<String>,
    tail_lines: Option<u64>,
    since_seconds: Option<u64>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let (client, ns, ctx) = state.client_manager.get_active_client_and_context().await.map_err(String::from)?;

    // Resolve available containers
    let containers = log_streamer::resolve_containers(&client, &ns, &target_kind, &target_name)
        .await
        .map_err(|e| e.to_string())?;

    // Stop existing session with this ID if any
    {
        let mut sessions = state.log_sessions.lock().await;
        if let Some(h) = sessions.remove(&session_id) {
            h.abort();
        }
    }

    let tail = tail_lines.unwrap_or(100);
    let sid = session_id.clone();

    let handle = tokio::spawn(log_streamer::stream_logs(
        sid,
        ctx,
        ns,
        target_kind,
        target_name,
        container,
        tail,
        since_seconds,
        app_handle,
    ));

    {
        let mut sessions = state.log_sessions.lock().await;
        sessions.insert(session_id, handle);
    }

    Ok(containers)
}

#[tauri::command]
pub async fn stop_log_stream(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut sessions = state.log_sessions.lock().await;
    if let Some(h) = sessions.remove(&session_id) {
        h.abort();
    }
    Ok(())
}
