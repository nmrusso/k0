use serde::Deserialize;
use tokio::process::Command;

use crate::domain::entities::helm::{HelmRelease, HelmRevision};
use crate::domain::errors::DomainError;

#[derive(Deserialize)]
struct HelmListEntry {
    name: String,
    namespace: String,
    revision: String,
    updated: String,
    status: String,
    chart: String,
    app_version: String,
}

#[derive(Deserialize)]
struct HelmHistoryEntry {
    revision: i64,
    updated: String,
    status: String,
    chart: String,
    app_version: String,
    description: String,
}

async fn run_helm(args: &[&str], context: &str, namespace: &str) -> Result<String, DomainError> {
    let mut cmd = Command::new("helm");
    for arg in args {
        cmd.arg(arg);
    }
    cmd.arg("--kube-context").arg(context);
    cmd.arg("-n").arg(namespace);

    let output = cmd.output().await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            DomainError::Configuration(
                "Helm CLI not found. Install: https://helm.sh/docs/intro/install/".to_string(),
            )
        } else {
            DomainError::Configuration(format!("Failed to run helm: {}", e))
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.contains("plugin \"diff\" not found") {
            return Err(DomainError::Configuration(
                "helm-diff plugin required. Install: helm plugin install https://github.com/databus23/helm-diff".to_string(),
            ));
        }
        return Err(DomainError::KubernetesApi(format!(
            "helm command failed: {}",
            stderr.trim()
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub async fn list_releases(
    context: &str,
    namespace: &str,
) -> Result<Vec<HelmRelease>, DomainError> {
    let output = run_helm(&["list", "-o", "json"], context, namespace).await?;
    if output.trim().is_empty() || output.trim() == "null" {
        return Ok(vec![]);
    }
    let entries: Vec<HelmListEntry> = serde_json::from_str(&output)?;
    Ok(entries
        .into_iter()
        .map(|e| HelmRelease {
            name: e.name,
            namespace: e.namespace,
            revision: e.revision,
            updated: e.updated,
            status: e.status,
            chart: e.chart,
            app_version: e.app_version,
        })
        .collect())
}

pub async fn get_history(
    context: &str,
    namespace: &str,
    release_name: &str,
) -> Result<Vec<HelmRevision>, DomainError> {
    let output = run_helm(
        &["history", release_name, "-o", "json"],
        context,
        namespace,
    )
    .await?;
    if output.trim().is_empty() || output.trim() == "null" {
        return Ok(vec![]);
    }
    let entries: Vec<HelmHistoryEntry> = serde_json::from_str(&output)?;
    Ok(entries
        .into_iter()
        .map(|e| HelmRevision {
            revision: e.revision,
            updated: e.updated,
            status: e.status,
            chart: e.chart,
            app_version: e.app_version,
            description: e.description,
        })
        .collect())
}

pub async fn rollback(
    context: &str,
    namespace: &str,
    release_name: &str,
    revision: i64,
) -> Result<String, DomainError> {
    let rev_str = revision.to_string();
    let output = run_helm(
        &["rollback", release_name, &rev_str],
        context,
        namespace,
    )
    .await?;
    Ok(output)
}

pub async fn get_manifest(
    context: &str,
    namespace: &str,
    release_name: &str,
    revision: i64,
) -> Result<String, DomainError> {
    let rev_str = revision.to_string();
    let output = run_helm(
        &["get", "manifest", release_name, "--revision", &rev_str],
        context,
        namespace,
    )
    .await?;
    Ok(output)
}

pub async fn get_values(
    context: &str,
    namespace: &str,
    release_name: &str,
    revision: i64,
) -> Result<String, DomainError> {
    let rev_str = revision.to_string();
    let output = run_helm(
        &["get", "values", release_name, "--revision", &rev_str, "-a"],
        context,
        namespace,
    )
    .await?;
    Ok(output)
}

pub async fn diff_revisions(
    context: &str,
    namespace: &str,
    release_name: &str,
    from_revision: i64,
    to_revision: i64,
) -> Result<String, DomainError> {
    let from_str = from_revision.to_string();
    let to_str = to_revision.to_string();
    let output = run_helm(
        &["diff", "revision", release_name, &from_str, &to_str],
        context,
        namespace,
    )
    .await?;
    Ok(output)
}

pub async fn template_local(
    context: &str,
    namespace: &str,
    release_name: &str,
    chart_path: &str,
    values_files: &[String],
) -> Result<String, DomainError> {
    let mut args = vec!["template", release_name, chart_path];
    let mut owned_args: Vec<String> = Vec::new();
    for vf in values_files {
        owned_args.push("-f".to_string());
        owned_args.push(vf.clone());
    }
    for a in &owned_args {
        args.push(a.as_str());
    }
    let output = run_helm(&args, context, namespace).await?;
    Ok(output)
}

pub async fn diff_local(
    context: &str,
    namespace: &str,
    release_name: &str,
    revision: i64,
    chart_path: &str,
    values_files: &[String],
) -> Result<String, DomainError> {
    let deployed = get_manifest(context, namespace, release_name, revision).await?;
    let local = template_local(context, namespace, release_name, chart_path, values_files).await?;

    // Write to temp files and diff
    let dir = std::env::temp_dir();
    let deployed_path = dir.join(format!("k0-deployed-{}-{}.yaml", release_name, revision));
    let local_path = dir.join(format!("k0-local-{}.yaml", release_name));

    tokio::fs::write(&deployed_path, &deployed)
        .await
        .map_err(|e| DomainError::Configuration(format!("Failed to write temp file: {}", e)))?;
    tokio::fs::write(&local_path, &local)
        .await
        .map_err(|e| DomainError::Configuration(format!("Failed to write temp file: {}", e)))?;

    let output = Command::new("diff")
        .arg("-u")
        .arg("--label")
        .arg(format!("deployed (rev {})", revision))
        .arg("--label")
        .arg("local (template)")
        .arg(&deployed_path)
        .arg(&local_path)
        .output()
        .await
        .map_err(|e| DomainError::Configuration(format!("Failed to run diff: {}", e)))?;

    // Clean up temp files
    let _ = tokio::fs::remove_file(&deployed_path).await;
    let _ = tokio::fs::remove_file(&local_path).await;

    // diff returns exit code 1 when files differ — that's expected
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if output.status.success() || output.status.code() == Some(1) {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(DomainError::KubernetesApi(format!(
            "diff command failed: {}",
            stderr.trim()
        )))
    }
}
