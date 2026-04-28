import type { AuditRecord, DatasetRecord, UploadResponse } from "@/types/audit";

const DEFAULT_API = "http://127.0.0.1:8000";

/**
 * Resolve the configured FastAPI base URL.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API;
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Perform a typed JSON request against the FastAPI service.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`Request failed: ${res.status}`, res.status, text);
  }
  return JSON.parse(text) as T;
}

/**
 * Upload a dataset file as multipart form data.
 */
export async function uploadDatasetFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${getApiBaseUrl()}/datasets/upload`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`Upload failed: ${res.status}`, res.status, text);
  }
  return JSON.parse(text) as UploadResponse;
}

/**
 * Start an audit job on the backend.
 */
export async function runAudit(payload: {
  dataset_id: string;
  name: string;
  target_column: string;
  sensitive_attrs: string[];
  privileged_groups?: Record<string, string>;
  audit_depth?: "quick" | "standard" | "deep";
  domain?: string;
  regression_threshold?: number | null;
}): Promise<{ audit_id: string }> {
  return apiFetch("/audits/run", {
    method: "POST",
    body: JSON.stringify({
      dataset_id: payload.dataset_id,
      name: payload.name,
      target_column: payload.target_column,
      sensitive_attrs: payload.sensitive_attrs,
      privileged_groups: payload.privileged_groups,
      audit_depth: payload.audit_depth ?? "standard",
      domain: payload.domain,
      regression_threshold: payload.regression_threshold,
    }),
  });
}

/**
 * Poll audit status until completion or timeout.
 */
export async function pollAuditStatus(auditId: string): Promise<{
  audit_id: string;
  status: string;
  progress_percent: number;
  message: string;
}> {
  return apiFetch(`/audits/${auditId}/status`);
}

/**
 * Fetch full audit results payload.
 */
export async function getAuditResults(auditId: string): Promise<AuditRecord> {
  return apiFetch(`/audits/${auditId}/results`);
}

/**
 * List audits currently available from the API store.
 */
export async function listAudits(): Promise<AuditRecord[]> {
  return apiFetch("/audits");
}

/**
 * List datasets registered with the FastAPI upload store.
 */
export async function listDatasets(): Promise<DatasetRecord[]> {
  return apiFetch("/datasets");
}

/**
 * Fetch generated HTML report metadata.
 */
export async function getAuditReport(auditId: string): Promise<{ html: string; shared_token: string }> {
  return apiFetch(`/audits/${auditId}/report`);
}
