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
    pub _system_prompt: String,
    /// Sender for follow-up messages. The receiver loop spawns new processes.
    pub message_tx: mpsc::Sender<String>,
    pub task_handle: tokio::task::JoinHandle<()>,
}

fn build_system_prompt(context: &str, namespace: &str, active_resource: &str, resource_context: &str, permission_mode: &str) -> String {
    let resource_data_section = if resource_context.is_empty() {
        String::new()
    } else {
        format!(
            r#"

## Resource Data (pre-loaded from K0)
```
{resource_context}
```"#
        )
    };

    let tools_section = match permission_mode {
        "allow_bash" | "bypass_all" => format!(
            r#"
## Tool Access
You have access to kubectl and helm on this machine.
- Always use: `--context {context}` and `-n {namespace}` with kubectl/helm commands.
- Use the Resource Data above FIRST. Only run commands when the data doesn't answer the question.
- When you run a command, show the command and its output concisely."#
        ),
        _ =>
            r#"
## Tool Access
You are in **text-only mode** — you cannot run kubectl, helm, or any commands.
Answer strictly from the Resource Data above. If a question requires information not present in the data, say:
"I don't have that information in the current context. Enable 'Allow kubectl & helm' in K0 Settings > Claude Integration to let me query the cluster directly.""#
            .to_string(),
    };

    format!(
        r#"You are a senior Kubernetes and Helm expert embedded in K0, a Kubernetes dashboard.

## Rules
1. Be CONCISE. Give direct answers. No preambles, no "Let me check", no summaries of what you're about to do.
2. Answer with facts, not speculation. If the data says it, state it. If it doesn't, say you don't know.
3. Use short sentences. Use bullet points for lists. Use `code formatting` for resource names, commands, and values.
4. Do NOT explain Kubernetes basics unless explicitly asked. The user is an engineer.
5. When asked yes/no questions, answer yes or no first, then brief evidence.
6. Do NOT suggest the user "navigate to" or "check" things in K0 — you ARE K0.

## Current Environment
- Context: `{context}`
- Namespace: `{namespace}`
- Viewing: `{active_resource}`
{resource_data_section}
{tools_section}

## K0 Features You Can Reference
- K0 shows resource detail panels with status, events, conditions, and metrics.
- K0 has a terminal for exec-ing into pods.
- K0 shows pod logs with level filtering and JSON parsing.
- K0 supports port-forwarding via UI.
- K0 has Helm release management with diff, rollback, and upgrade.
- K0 integrates with New Relic for CPU/memory metrics and alerts (if configured).
- K0 has network overview, dependency graphs, error dashboards, and incident mode.

## K0 Actions
For cluster-modifying operations, emit on a single line:
K0_ACTION:{{"action_type":"<type>","description":"<short description>","params":{{...}}}}

Types: scale, restart, delete_pod, apply_yaml, patch_resource, rollback, port_forward.
The user sees a confirmation card and must approve before execution."#
    )
}

/// Extract all text content from a verbose stream-json assistant message.
/// The content array may contain thinking, text, and tool_use blocks.
/// Returns (thinking_text, combined_text_content).
fn extract_content_from_assistant(value: &serde_json::Value) -> (Option<String>, String) {
    let mut thinking = None;
    let mut text_parts = Vec::new();

    if let Some(content) = value.pointer("/message/content").and_then(|c| c.as_array()) {
        for block in content {
            let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
            match block_type {
                "thinking" => {
                    if let Some(t) = block.get("thinking").and_then(|t| t.as_str()) {
                        thinking = Some(t.to_string());
                    }
                }
                "text" => {
                    if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                        text_parts.push(t.to_string());
                    }
                }
                _ => {}
            }
        }
    }

    (thinking, text_parts.join(""))
}

/// Check text for K0_ACTION markers and emit appropriate events.
/// Returns the text with K0_ACTION lines removed.
fn extract_and_emit_actions(text: &str, event_prefix: &str, app_handle: &tauri::AppHandle) -> String {
    let mut clean_lines = Vec::new();
    for line in text.lines() {
        if let Some(action_json) = line.strip_prefix("K0_ACTION:") {
            if let Ok(mut action) = serde_json::from_str::<ActionRequest>(action_json) {
                if action.action_id.is_empty() {
                    action.action_id = uuid::Uuid::new_v4().to_string();
                }
                let _ = app_handle.emit(
                    event_prefix,
                    ChatEvent {
                        event_type: "action_request".to_string(),
                        content: None,
                        action: Some(action),
                    },
                );
                continue;
            }
        }
        clean_lines.push(line);
    }
    clean_lines.join("\n")
}

/// Spawn a single claude CLI turn and stream its output as Tauri events.
/// Returns when the process completes.
async fn run_claude_turn(
    session_id: &str,
    message: &str,
    system_prompt: &str,
    permission_mode: &str,
    is_continuation: bool,
    app_handle: &tauri::AppHandle,
) {
    let mut cmd = Command::new("claude");
    cmd.arg("--output-format")
        .arg("stream-json")
        .arg("--verbose");

    // Apply permission mode from settings
    match permission_mode {
        "allow_bash" => {
            cmd.arg("--allowedTools").arg("Bash");
        }
        "bypass_all" => {
            cmd.arg("--dangerously-skip-permissions");
        }
        _ => {
            // "text_only" (default) — no tools available
        }
    }

    cmd.arg("--system-prompt")
        .arg(system_prompt);

    if is_continuation {
        cmd.arg("--continue");
    }

    // The message is passed as the prompt (positional argument) in print mode
    cmd.arg("-p")
        .arg(message);

    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    eprintln!("[chat-{}] spawning claude [perm={}] --system-prompt <{}chars> {} -p <{}chars>",
        session_id, permission_mode, system_prompt.len(),
        if is_continuation { "--continue" } else { "" },
        message.len()
    );

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

    // Spawn stderr reader — log to terminal, collect for error reporting on failure
    let stderr_sid = session_id.to_string();
    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut stderr_lines = Vec::new();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[chat-{stderr_sid}] stderr: {line}");
            stderr_lines.push(line);
        }
        stderr_lines
    });

    // Read stdout line-by-line — verbose stream-json format
    // Events: {"type":"system",...}, {"type":"assistant","message":{...}}, {"type":"result",...}
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let event_prefix = format!("chat-event-{}", session_id);

    // Track previously emitted text to compute deltas from cumulative assistant messages
    let mut emitted_text_len: usize = 0;
    let mut sent_thinking = false;

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }

        // Parse as JSON
        let value: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => {
                // Not JSON — treat as plain text
                eprintln!("[chat-{}] non-json: {}", session_id, &line[..line.len().min(200)]);
                let clean = extract_and_emit_actions(&line, &event_prefix, app_handle);
                if !clean.trim().is_empty() {
                    let _ = app_handle.emit(
                        &event_prefix,
                        ChatEvent {
                            event_type: "text".to_string(),
                            content: Some(clean),
                            action: None,
                        },
                    );
                }
                continue;
            }
        };

        let event_type = value.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match event_type {
            "assistant" => {
                let (thinking, full_text) = extract_content_from_assistant(&value);

                // Emit thinking indicator once
                if thinking.is_some() && !sent_thinking {
                    sent_thinking = true;
                    let _ = app_handle.emit(
                        &event_prefix,
                        ChatEvent {
                            event_type: "thinking".to_string(),
                            content: Some("Thinking...".to_string()),
                            action: None,
                        },
                    );
                }

                // Emit text delta (only the new part since last emit)
                if full_text.len() > emitted_text_len {
                    let delta = &full_text[emitted_text_len..];
                    let clean = extract_and_emit_actions(delta, &event_prefix, app_handle);
                    if !clean.is_empty() {
                        let _ = app_handle.emit(
                            &event_prefix,
                            ChatEvent {
                                event_type: "text".to_string(),
                                content: Some(clean),
                                action: None,
                            },
                        );
                    }
                    emitted_text_len = full_text.len();
                }
            }
            "result" => {
                // Final result — emit any remaining text not yet sent
                if let Some(result_text) = value.get("result").and_then(|r| r.as_str()) {
                    if result_text.len() > emitted_text_len {
                        let delta = &result_text[emitted_text_len..];
                        let clean = extract_and_emit_actions(delta, &event_prefix, app_handle);
                        if !clean.is_empty() {
                            let _ = app_handle.emit(
                                &event_prefix,
                                ChatEvent {
                                    event_type: "text".to_string(),
                                    content: Some(clean),
                                    action: None,
                                },
                            );
                        }
                    }
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
            // Skip system, user, and other event types
            _ => {}
        }
    }

    // Wait for process to finish and check exit code
    let exit_status = child.wait().await;
    let stderr_lines = stderr_task.await.unwrap_or_default();

    if let Ok(status) = &exit_status {
        if !status.success() {
            let code = status.code().unwrap_or(-1);
            eprintln!("[chat-{}] claude exited with code {}", session_id, code);
            let stderr_msg = if stderr_lines.is_empty() {
                String::new()
            } else {
                format!("\n{}", stderr_lines.join("\n"))
            };
            let _ = app_handle.emit(
                &format!("chat-event-{}", session_id),
                ChatEvent {
                    event_type: "error".to_string(),
                    content: Some(format!("Claude CLI exited with code {}.{}", code, stderr_msg)),
                    action: None,
                },
            );
        }
    }

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
    resource_context: String,
    permission_mode: String,
    app_handle: tauri::AppHandle,
) -> Result<ChatSession, String> {
    let system_prompt = build_system_prompt(&context_info, &namespace, &active_resource, &resource_context, &permission_mode);

    let (message_tx, mut message_rx) = mpsc::channel::<String>(32);

    let sid = session_id.clone();
    let prompt = system_prompt.clone();
    let perm = permission_mode.clone();
    let handle = app_handle.clone();

    let task_handle = tokio::spawn(async move {
        // Run initial turn
        run_claude_turn(&sid, &initial_message, &prompt, &perm, false, &handle).await;

        // Wait for follow-up messages
        while let Some(msg) = message_rx.recv().await {
            run_claude_turn(&sid, &msg, &prompt, &perm, true, &handle).await;
        }

        // Session ended
        let _ = handle.emit(&format!("chat-ended-{}", sid), ());
    });

    Ok(ChatSession {
        _system_prompt: system_prompt,
        message_tx,
        task_handle,
    })
}
