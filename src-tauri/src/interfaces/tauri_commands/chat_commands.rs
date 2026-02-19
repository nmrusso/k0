use kube::Api;
use serde_json::Value;
use tauri::State;
use tokio::process::Command;

use crate::infrastructure::streams::chat_streamer;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn start_chat_session(
    session_id: String,
    message: String,
    context_info: Option<String>,
    active_resource: Option<String>,
    resource_context: Option<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Stop existing session if any
    {
        let mut sessions = state.chat_sessions.lock().await;
        if let Some(session) = sessions.remove(&session_id) {
            session.task_handle.abort();
        }
    }

    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(|e| e.to_string())?;

    let context = context_info.unwrap_or(ctx);
    let resource = active_resource.unwrap_or_default();
    let res_context = resource_context.unwrap_or_default();

    // Read permission mode from config (default: "text_only")
    let permission_mode = state
        .config_db
        .get("claude_permission_mode")
        .unwrap_or(Some("text_only".to_string()))
        .unwrap_or_else(|| "text_only".to_string());

    let session = chat_streamer::start_chat_session(
        session_id.clone(),
        message,
        context,
        ns,
        resource,
        res_context,
        permission_mode,
        app_handle,
    )
    .await?;

    {
        let mut sessions = state.chat_sessions.lock().await;
        sessions.insert(session_id, session);
    }

    Ok(())
}

#[tauri::command]
pub async fn send_chat_message(
    session_id: String,
    message: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sessions = state.chat_sessions.lock().await;
    if let Some(session) = sessions.get(&session_id) {
        session
            .message_tx
            .send(message)
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;
        Ok(())
    } else {
        Err("Chat session not found. It may have ended.".to_string())
    }
}

#[tauri::command]
pub async fn stop_chat_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut sessions = state.chat_sessions.lock().await;
    if let Some(session) = sessions.remove(&session_id) {
        session.task_handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn execute_chat_action(
    action_type: String,
    params: Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (client, ns) = state
        .client_manager
        .get_active_client()
        .await
        .map_err(|e| e.to_string())?;

    match action_type.as_str() {
        "scale" => {
            let name = params["name"]
                .as_str()
                .ok_or("Missing 'name' param for scale")?;
            let replicas = params["replicas"]
                .as_i64()
                .ok_or("Missing 'replicas' param for scale")? as i32;

            use k8s_openapi::api::apps::v1::Deployment;
            use kube::{api::PatchParams, Api};
            let api: Api<Deployment> = Api::namespaced(client, &ns);
            let patch = serde_json::json!({
                "spec": { "replicas": replicas }
            });
            api.patch(
                name,
                &PatchParams::apply("k0"),
                &kube::api::Patch::Merge(&patch),
            )
            .await
            .map_err(|e| e.to_string())?;

            Ok(format!("Scaled deployment/{} to {} replicas", name, replicas))
        }
        "restart" => {
            let name = params["name"]
                .as_str()
                .ok_or("Missing 'name' param for restart")?;

            use k8s_openapi::api::apps::v1::Deployment;
            use kube::{api::PatchParams, Api};
            let api: Api<Deployment> = Api::namespaced(client, &ns);
            let now = chrono::Utc::now().to_rfc3339();
            let patch = serde_json::json!({
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": now
                            }
                        }
                    }
                }
            });
            api.patch(
                name,
                &PatchParams::apply("k0"),
                &kube::api::Patch::Merge(&patch),
            )
            .await
            .map_err(|e| e.to_string())?;

            Ok(format!("Restarted deployment/{}", name))
        }
        "delete_pod" => {
            let name = params["name"]
                .as_str()
                .ok_or("Missing 'name' param for delete_pod")?;

            crate::application::handlers::pod_handler::PodHandler::delete(&client, &ns, name)
                .await
                .map_err(|e| e.to_string())?;

            Ok(format!("Deleted pod/{}", name))
        }
        "apply_yaml" => {
            let yaml_content = params["yaml_content"]
                .as_str()
                .ok_or("Missing 'yaml_content' param for apply_yaml")?;

            // Parse the YAML to extract resource info
            let doc: Value =
                serde_yaml::from_str(yaml_content).map_err(|e| format!("Invalid YAML: {}", e))?;
            let kind = doc["kind"]
                .as_str()
                .ok_or("YAML missing 'kind'")?
                .to_lowercase();
            let api_version = doc["apiVersion"]
                .as_str()
                .ok_or("YAML missing 'apiVersion'")?;
            let name = doc["metadata"]["name"]
                .as_str()
                .ok_or("YAML missing 'metadata.name'")?;

            // Parse group/version from apiVersion
            let (group, version) = if api_version.contains('/') {
                let parts: Vec<&str> = api_version.splitn(2, '/').collect();
                (parts[0].to_string(), parts[1].to_string())
            } else {
                (String::new(), api_version.to_string())
            };

            // Build plural (simple heuristic)
            let plural = if kind.ends_with('s') {
                format!("{}es", kind)
            } else {
                format!("{}s", kind)
            };

            let api_resource = kube::api::ApiResource {
                group: group.clone(),
                version: version.clone(),
                api_version: api_version.to_string(),
                kind: kind.clone(),
                plural: plural.clone(),
            };

            let api: Api<kube::api::DynamicObject> =
                Api::namespaced_with(client, &ns, &api_resource);

            let data: kube::api::DynamicObject =
                serde_json::from_value(serde_json::to_value(&doc).unwrap())
                    .map_err(|e| format!("Failed to parse as dynamic object: {}", e))?;

            let _: kube::api::DynamicObject = api.patch(
                name,
                &kube::api::PatchParams::apply("k0"),
                &kube::api::Patch::Apply(&data),
            )
            .await
            .map_err(|e: kube::Error| e.to_string())?;

            Ok(format!("Applied {}/{}", kind, name))
        }
        "patch_resource" => {
            let group = params["group"].as_str().unwrap_or("");
            let version = params["version"]
                .as_str()
                .ok_or("Missing 'version' param")?;
            let kind = params["kind"].as_str().ok_or("Missing 'kind' param")?;
            let plural = params["plural"]
                .as_str()
                .ok_or("Missing 'plural' param")?;
            let name = params["name"].as_str().ok_or("Missing 'name' param")?;
            let patch_data = &params["patch"];

            let api_version = if group.is_empty() {
                version.to_string()
            } else {
                format!("{}/{}", group, version)
            };

            let api_resource = kube::api::ApiResource {
                group: group.to_string(),
                version: version.to_string(),
                api_version,
                kind: kind.to_string(),
                plural: plural.to_string(),
            };

            let api: Api<kube::api::DynamicObject> =
                Api::namespaced_with(client, &ns, &api_resource);

            let _: kube::api::DynamicObject = api.patch(
                name,
                &kube::api::PatchParams::apply("k0"),
                &kube::api::Patch::Merge(patch_data),
            )
            .await
            .map_err(|e: kube::Error| e.to_string())?;

            Ok(format!("Patched {}/{}", kind, name))
        }
        "rollback" => {
            let release_name = params["release_name"]
                .as_str()
                .ok_or("Missing 'release_name' param for rollback")?;
            let revision = params["revision"]
                .as_i64()
                .ok_or("Missing 'revision' param for rollback")? as i32;

            let output = std::process::Command::new("helm")
                .args(["rollback", release_name, &revision.to_string()])
                .output()
                .map_err(|e| format!("Failed to run helm rollback: {}", e))?;

            if output.status.success() {
                Ok(format!(
                    "Rolled back {} to revision {}",
                    release_name, revision
                ))
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Helm rollback failed: {}", stderr))
            }
        }
        "port_forward" => {
            let target_kind = params["target_kind"]
                .as_str()
                .unwrap_or("pod");
            let target_name = params["target_name"]
                .as_str()
                .ok_or("Missing 'target_name' param for port_forward")?;
            let remote_port = params["remote_port"]
                .as_u64()
                .ok_or("Missing 'remote_port' param for port_forward")? as u16;
            let local_port = params["local_port"]
                .as_u64()
                .map(|p| p as u16)
                .unwrap_or(remote_port);

            let (_, pf_ns, pf_ctx) = state
                .client_manager
                .get_active_client_and_context()
                .await
                .map_err(|e| e.to_string())?;

            let resource = match target_kind {
                "service" | "svc" => format!("svc/{}", target_name),
                _ => format!("pod/{}", target_name),
            };

            let child = std::process::Command::new("kubectl")
                .arg("port-forward")
                .arg(&resource)
                .arg(format!("{}:{}", local_port, remote_port))
                .arg("-n")
                .arg(&pf_ns)
                .arg("--context")
                .arg(&pf_ctx)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to start port-forward: {}", e))?;

            let id = uuid::Uuid::new_v4().to_string();
            let entry = crate::domain::entities::PortForwardEntry {
                id: id.clone(),
                target_kind: target_kind.to_string(),
                target_name: target_name.to_string(),
                local_port,
                remote_port,
            };

            {
                let mut pfs = state.port_forwards.lock().await;
                pfs.insert(id, (entry, child));
            }

            Ok(format!(
                "Port-forwarding {}:{} → localhost:{}",
                target_name, remote_port, local_port
            ))
        }
        _ => Err(format!("Unknown action type: {}", action_type)),
    }
}

#[tauri::command]
pub async fn check_claude_cli() -> Result<bool, String> {
    match Command::new("claude").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}
