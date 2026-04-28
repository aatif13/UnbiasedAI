/**
 * Shared audit / fairness types aligned with the FastAPI payloads.
 */

export type AuditStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MetricStatus = "PASS" | "WARN" | "FAIL";

export interface Violation {
  type: string;
  rule: string;
  severity: string;
  description: string;
  metric_value?: number;
  threshold?: number;
}

export interface IntersectionalCell {
  a0: string;
  a1: string;
  selection_rate: number;
  n: number;
}

export interface IntersectionalAnalysis {
  axes: string[];
  cells: IntersectionalCell[];
  note?: string;
}

export interface AuditMetricBlock {
  demographic_parity_difference?: number;
  demographic_parity_ratio?: number;
  equalized_odds_difference?: number;
  equal_opportunity_difference?: number;
  disparate_impact_ratio?: number;
  selection_rate_by_group?: Record<string, number>;
  base_rate_by_group?: Record<string, number>;
  false_positive_rate_by_group?: Record<string, number>;
  false_negative_rate_by_group?: Record<string, number>;
  precision_by_group?: Record<string, number>;
  consistency_score?: number;
  group_representation?: Record<string, number>;
  intersectional_analysis?: IntersectionalAnalysis;
  same_outcome_all_groups?: boolean;
  warnings?: string[];
  notes?: string;
  violations?: Violation[];
  error?: string;
}

export interface AuditMetrics {
  _meta: Record<string, unknown>;
  [sensitiveAttribute: string]: AuditMetricBlock | Record<string, unknown> | undefined;
}

export interface RemediationStrategy {
  phase: string;
  priority_score?: number;
  match?: boolean;
  name: string;
  description: string;
  library?: string;
  use_when?: string;
  effort?: string;
  impact?: string;
  rationale?: string;
  /** Runnable Python example shown with syntax highlighting. */
  code_snippet?: string;
}

export interface ShapSummary {
  feature_names: string[];
  mean_abs_shap: Record<string, number>;
  proxy_flags: Array<{ column: string; reason: string; mean_abs_shap: number }>;
  waterfall_preview: Array<{ feature: string; value: number }>;
  error?: string;
}

export interface AuditRecord {
  id: string;
  dataset_id: string;
  name: string;
  target_column: string;
  sensitive_attrs: string[];
  privileged_groups?: Record<string, string>;
  model_path?: string | null;
  audit_depth?: string;
  regression_threshold?: number | null;
  domain?: string | null;
  status: AuditStatus;
  progress_percent?: number;
  progress_message?: string;
  overall_score?: number;
  risk_level?: RiskLevel;
  metrics?: AuditMetrics | null;
  remediations?: RemediationStrategy[] | null;
  shap_values?: ShapSummary | null;
  compliance?: Array<Record<string, unknown>> | null;
  report_html?: string | null;
  shared_token?: string | null;
  partial_metrics?: Record<string, unknown> | null;
  error?: string;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  null_count: number;
  unique_values: number;
  sample_values: string[];
  mini_histogram?: number[] | null;
}

export interface SensitiveDetection {
  column: string;
  category: string;
  confidence: number;
  kind: "direct" | "proxy" | string;
  recommended_action: string;
}

/** Dataset row returned from the API store (upload metadata). */
export interface DatasetRecord {
  id: string;
  name: string;
  description?: string | null;
  fileUrl?: string;
  local_path?: string;
  file_size?: number;
  fileSize?: number;
  row_count?: number;
  rowCount?: number;
  status?: string;
  columns?: unknown[];
  sensitive_attrs?: unknown[];
  createdAt?: string;
}

export interface UploadResponse {
  dataset_id: string;
  file_url: string;
  row_count: number;
  columns: ColumnProfile[];
  sensitive_detections: SensitiveDetection[];
  imputation_options: Array<{ strategy: string; label: string; description: string }>;
  warnings: string[];
}
