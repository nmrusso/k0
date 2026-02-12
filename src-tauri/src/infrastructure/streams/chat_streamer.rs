use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

#[derive(Serialize, Clone, Debug)]
pub struct ChatEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "text", "action_request", "error", "thinking", "message_end"
    pub content: Option<String>,
    pub action: Option<ActionRequest>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActionRequest {
    pub action_id: String,
    pub action_type: String,
    pub description: String,
    pub params: serde_json::Value,
}

/// Represents a running chat session with the Claude CLI.
/// Each turn spawns a new `claude` process. Follow-ups use `--continue`.
pub struct ChatSession {
    pub system_prompt: String,
    /// Sender for follow-up messages. The receiver loop spawns new processes.
    pub message_tx: mpsc::Sender<String>,
    pub task_handle: tokio::task::JoinHandle<()>,
}

/// Claude CLI stream-json event types we care about.
/// Uses `serde_json::Value` for fields that vary by event type, to avoid
/// deserialization failures (e.g. "result" is a string in result events
/// but absent in delta events).
#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct ClaudeStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    content_block: Option<ContentBlock>,
    #[serde(default)]
    delta: Option<Delta>,
    #[serde(default)]
    subtype: Option<String>,
    // Catch-all for extra fields so deserialization never fails on unknown keys
    #[serde(flatten)]
    _extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct ContentBlock {
    #[serde(rename = "type")]
    #[serde(default)]
    block_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct Delta {
    #[serde(rename = "type")]
    #[serde(default)]
    delta_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

fn build_system_prompt(context: &str, namespace: &str, active_resource: &str) -> String {
    format!(
        r#"You are a Kubernetes assistant for K0, a Kubernetes dashboard application. Current context:
- Cluster: {context}
- Namespace: {namespace}
- Viewing: {active_resource}

You can help diagnose issues, explain resources, and suggest actions.

For write operations, output on a single line:
K0_ACTION:{{"action_type":"<type>","description":"<human readable>","params":{{...}}}}

Available action_types:
- scale: params {{ "name": "<deployment>", "replicas": <number> }}
- restart: params {{ "name": "<deployment>" }}
- delete_pod: params {{ "name": "<pod>" }}
- apply_yaml: params {{ "yaml_content": "<yaml string>" }}
- patch_resource: params {{ "group": "", "version": "v1", "kind": "...", "plural": "...", "name": "...", "patch": {{...}} }}

The user will see a confirmation card and must approve before execution. Always use K0_ACTION for any cluster-modifying operations."#
    )
}

/// Spawn a single claude CLI turn and stream its output as Tauri events.
/// Returns when the process completes.
async fn run_claude_turn(
    session_id: &str,
    message: &str,
    system_prompt: &str,
    is_continuation: bool,
    app_handle: &tauri::AppHandle,
) {
    let mut cmd = Command::new("claude");
    cmd.arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .arg("--system-prompt")
        .arg(system_prompt);

    if is_continuation {
        cmd.arg("--continue");
    }

    // The message is passed as the prompt (positional argument) in print mode
    cmd.arg("-p")
        .arg(message);

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let _ = app_handle.emit(
                &format!("chat-event-{}", session_id),
                ChatEvent {
                    event_type: "error".to_string(),
                    content: Some(format!(
                        "Failed to start claude CLI: {}. Is 'claude' installed and in PATH?",
                        e
                    )),
                    action: None,
                },
            );
            let _ = app_handle.emit(&format!("chat-ended-{}", session_id), ());
            return;
        }
    };

    let stdout = child.stdout.take().expect("stdout should be piped");
    let stderr = child.stderr.take().expect("stderr should be piped");

    // Spawn stderr reader
    let stderr_sid = session_id.to_string();
    let stderr_handle = app_handle.clone();
    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[chat-{stderr_sid}] stderr: {line}");
        }
    });

    // Read stdout line-by-line
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut accumulated_text = String::new();
    let event_prefix = format!("chat-event-{}", session_id);

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }

        // Check for K0_ACTION marker in raw text
        if let Some(action_json) = line.strip_prefix("K0_ACTION:") {
            if let Ok(mut action) = serde_json::from_str::<ActionRequest>(action_json) {
                if action.action_id.is_empty() {
                    action.action_id = uuid::Uuid::new_v4().to_string();
                }
                let _ = app_handle.emit(
                    &event_prefix,
                    ChatEvent {
                        event_type: "action_request".to_string(),
                        content: None,
                        action: Some(action),
                    },
                );
                continue;
            }
        }

        // Try to parse as Claude stream-json
        if let Ok(event) = serde_json::from_str::<ClaudeStreamEvent>(&line) {
            match event.event_type.as_str() {
                "content_block_delta" => {
                    if let Some(delta) = &event.delta {
                        if let Some(text) = &delta.text {
                            // Check if this delta contains a K0_ACTION
                            if let Some(action_start) = text.find("K0_ACTION:") {
                                let before = &text[..action_start];
                                if !before.is_empty() {
                                    let _ = app_handle.emit(
                                        &event_prefix,
                                        ChatEvent {
                                            event_type: "text".to_string(),
                                            content: Some(before.to_string()),
                                            action: None,
                                        },
                                    );
                                }
                                let action_str = &text[action_start + 10..];
                                accumulated_text.push_str(action_str);
                                if let Ok(mut action) =
                                    serde_json::from_str::<ActionRequest>(&accumulated_text)
                                {
                                    if action.action_id.is_empty() {
                                        action.action_id = uuid::Uuid::new_v4().to_string();
                                    }
                                    let _ = app_handle.emit(
                                        &event_prefix,
                                        ChatEvent {
                                            event_type: "action_request".to_string(),
                                            content: None,
                                            action: Some(action),
                                        },
                                    );
                                    accumulated_text.clear();
                                }
                            } else if !accumulated_text.is_empty() {
                                accumulated_text.push_str(text);
                                if let Ok(mut action) =
                                    serde_json::from_str::<ActionRequest>(&accumulated_text)
                                {
                                    if action.action_id.is_empty() {
                                        action.action_id = uuid::Uuid::new_v4().to_string();
                                    }
                                    let _ = app_handle.emit(
                                        &event_prefix,
                                        ChatEvent {
                                            event_type: "action_request".to_string(),
                                            content: None,
                                            action: Some(action),
                                        },
                                    );
                                    accumulated_text.clear();
                                }
                            } else {
                                let _ = app_handle.emit(
                                    &event_prefix,
                                    ChatEvent {
                                        event_type: "text".to_string(),
                                        content: Some(text.clone()),
                                        action: None,
                                    },
                                );
                            }
                        }
                    }
                }
                "content_block_start" => {
                    if let Some(block) = &event.content_block {
                        if block.block_type.as_deref() == Some("thinking") {
                            let _ = app_handle.emit(
                                &event_prefix,
                                ChatEvent {
                                    event_type: "thinking".to_string(),
                                    content: Some("Thinking...".to_string()),
                                    action: None,
                                },
                            );
                        }
                    }
                }
                "message_stop" | "result" => {
                    if !accumulated_text.is_empty() {
                        let _ = app_handle.emit(
                            &event_prefix,
                            ChatEvent {
                                event_type: "text".to_string(),
                                content: Some(accumulated_text.clone()),
                                action: None,
                            },
                        );
                        accumulated_text.clear();
                    }
                    let _ = app_handle.emit(
                        &event_prefix,
                        ChatEvent {
                            event_type: "message_end".to_string(),
                            content: None,
                            action: None,
                        },
                    );
                }
                _ => {}
            }
        } else {
            // Line didn't parse as ClaudeStreamEvent.
            // If it looks like JSON (starts with '{'), it's likely a metadata/usage line — skip it.
            if line.trim_start().starts_with('{') {
                continue;
            }
            // Plain text from claude — check for K0_ACTION
            if let Some(action_start) = line.find("K0_ACTION:") {
                let before = &line[..action_start];
                if !before.trim().is_empty() {
                    let _ = app_handle.emit(
                        &event_prefix,
                        ChatEvent {
                            event_type: "text".to_string(),
                            content: Some(before.to_string()),
                            action: None,
                        },
                    );
                }
                let action_str = &line[action_start + 10..];
                if let Ok(mut action) = serde_json::from_str::<ActionRequest>(action_str) {
                    if action.action_id.is_empty() {
                        action.action_id = uuid::Uuid::new_v4().to_string();
                    }
                    let _ = app_handle.emit(
                        &event_prefix,
                        ChatEvent {
                            event_type: "action_request".to_string(),
                            content: None,
                            action: Some(action),
                        },
                    );
                }
            } else {
                let _ = app_handle.emit(
                    &event_prefix,
                    ChatEvent {
                        event_type: "text".to_string(),
                        content: Some(line),
                        action: None,
                    },
                );
            }
        }
    }

    let _ = stderr_task.await;
    let _ = child.wait().await;

    // Signal this turn is done
    let _ = app_handle.emit(
        &format!("chat-event-{}", session_id),
        ChatEvent {
            event_type: "message_end".to_string(),
            content: None,
            action: None,
        },
    );
}

pub async fn start_chat_session(
    session_id: String,
    initial_message: String,
    context_info: String,
    namespace: String,
    active_resource: String,
    app_handle: tauri::AppHandle,
) -> Result<ChatSession, String> {
    let system_prompt = build_system_prompt(&context_info, &namespace, &active_resource);

    let (message_tx, mut message_rx) = mpsc::channel::<String>(32);

    let sid = session_id.clone();
    let prompt = system_prompt.clone();
    let handle = app_handle.clone();

    let task_handle = tokio::spawn(async move {
        // Run initial turn
        run_claude_turn(&sid, &initial_message, &prompt, false, &handle).await;

        // Wait for follow-up messages
        while let Some(msg) = message_rx.recv().await {
            run_claude_turn(&sid, &msg, &prompt, true, &handle).await;
        }

        // Session ended
        let _ = handle.emit(&format!("chat-ended-{}", sid), ());
    });

    Ok(ChatSession {
        system_prompt,
        message_tx,
        task_handle,
    })
}
