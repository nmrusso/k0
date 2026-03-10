/**
 * Centralised badge variant helpers for Kubernetes resource statuses.
 * Import from here so status colours are consistent across all views.
 */

type BadgeVariant = "success" | "warning" | "destructive" | "secondary";

export function getPodStatusVariant(status: string): BadgeVariant {
  if (status === "Running" || status === "Succeeded") return "success";
  if (status === "Pending" || status === "Terminating") return "warning";
  if (
    status === "Failed" ||
    status === "CrashLoopBackOff" ||
    status === "Error" ||
    status === "OOMKilled" ||
    status === "ImagePullBackOff"
  )
    return "destructive";
  return "secondary";
}

export function getJobStatusVariant(status: string): BadgeVariant {
  if (status === "Complete" || status === "Succeeded") return "success";
  if (status === "Running" || status === "Active") return "warning";
  return "destructive";
}

export function getDeploymentStatusVariant(ready: string): BadgeVariant {
  // ready format is "n/m"
  const [cur, total] = ready.split("/").map(Number);
  if (!total) return "secondary";
  if (cur === total) return "success";
  if (cur === 0) return "destructive";
  return "warning";
}

/** True / False / Unknown conditions (Gateway API, etc.) */
export function getConditionVariant(status: string): BadgeVariant {
  if (status === "True") return "success";
  if (status === "False") return "destructive";
  return "secondary";
}

/** Generic boolean-ish variants */
export function getBoolVariant(value: boolean, trueIsGood = true): BadgeVariant {
  return value === trueIsGood ? "success" : "destructive";
}
