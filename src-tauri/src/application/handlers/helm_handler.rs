use crate::domain::entities::helm::{HelmRelease, HelmRevision};
use crate::domain::errors::DomainError;
use crate::infrastructure::helm;

pub struct HelmHandler;

impl HelmHandler {
    pub async fn list_releases(
        context: &str,
        namespace: &str,
    ) -> Result<Vec<HelmRelease>, DomainError> {
        helm::list_releases(context, namespace).await
    }

    pub async fn get_history(
        context: &str,
        namespace: &str,
        release_name: &str,
    ) -> Result<Vec<HelmRevision>, DomainError> {
        helm::get_history(context, namespace, release_name).await
    }

    pub async fn rollback(
        context: &str,
        namespace: &str,
        release_name: &str,
        revision: i64,
    ) -> Result<String, DomainError> {
        helm::rollback(context, namespace, release_name, revision).await
    }

    pub async fn get_manifest(
        context: &str,
        namespace: &str,
        release_name: &str,
        revision: i64,
    ) -> Result<String, DomainError> {
        helm::get_manifest(context, namespace, release_name, revision).await
    }

    pub async fn get_values(
        context: &str,
        namespace: &str,
        release_name: &str,
        revision: i64,
    ) -> Result<String, DomainError> {
        helm::get_values(context, namespace, release_name, revision).await
    }

    pub async fn diff_revisions(
        context: &str,
        namespace: &str,
        release_name: &str,
        from_revision: i64,
        to_revision: i64,
    ) -> Result<String, DomainError> {
        helm::diff_revisions(context, namespace, release_name, from_revision, to_revision).await
    }

    pub async fn diff_local(
        context: &str,
        namespace: &str,
        release_name: &str,
        revision: i64,
        chart_path: &str,
        values_files: &[String],
    ) -> Result<String, DomainError> {
        helm::diff_local(context, namespace, release_name, revision, chart_path, values_files).await
    }
}
