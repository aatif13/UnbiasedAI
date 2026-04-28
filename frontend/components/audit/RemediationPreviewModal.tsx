"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AuditMetricBlock, AuditRecord } from "@/types/audit";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  strategy: string | null;
  record: AuditRecord | null;
  onClose: () => void;
};

function firstMetricBlock(record: AuditRecord | null): AuditMetricBlock | undefined {
  if (!record?.metrics) return undefined;
  const keys = Object.keys(record.metrics).filter((k) => !k.startsWith("_"));
  const k = keys[0];
  if (!k) return undefined;
  return record.metrics[k] as AuditMetricBlock;
}

function fprDisparity(block: AuditMetricBlock | undefined): number {
  const f = block?.false_positive_rate_by_group ?? {};
  const vals = Object.values(f).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (vals.length < 2) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

function selectionRateDisparity(block: AuditMetricBlock | undefined): number {
  const s = block?.selection_rate_by_group ?? {};
  const vals = Object.values(s).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (vals.length < 2) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

function improvementPct(before: number, after: number, lowerIsBetter: boolean): number {
  const b = Math.abs(before) < 1e-9 ? 1e-9 : before;
  if (lowerIsBetter) {
    return Math.min(99, Math.round(((before - after) / Math.abs(b)) * 100));
  }
  return Math.min(99, Math.round(((after - before) / Math.abs(b)) * 100));
}

const SNIPPETS: Record<string, string> = {
  Reweighing: `from aif360.algorithms.preprocessing import Reweighing
from aif360.datasets import BinaryLabelDataset

rw = Reweighing(
    unprivileged_groups=[{'<sensitive_attr>': 0}],
    privileged_groups=[{'<sensitive_attr>': 1}]
)
rw.fit(dataset)
transformed_dataset = rw.transform(dataset)`,

  "Disparate Impact Remover": `from aif360.algorithms.preprocessing import DisparateImpactRemover

di = DisparateImpactRemover(repair_level=0.8)
transformed_dataset = di.fit_transform(dataset)`,

  "Exponentiated Gradient Reduction": `from fairlearn.reductions import ExponentiatedGradient, EqualizedOdds
from sklearn.linear_model import LogisticRegression

estimator = LogisticRegression()
constraint = EqualizedOdds()
mitigator = ExponentiatedGradient(estimator, constraint)
mitigator.fit(X_train, y_train, sensitive_features=sensitive_col)
y_pred = mitigator.predict(X_test)`,

  "Calibrated Equalized Odds": `from aif360.algorithms.postprocessing import CalibratedEqOddsPostprocessing

cpp = CalibratedEqOddsPostprocessing(
    unprivileged_groups=[{'<sensitive_attr>': 0}],
    privileged_groups=[{'<sensitive_attr>': 1}],
    cost_constraint='fnr'
)
cpp.fit(dataset_val, dataset_val_pred)
dataset_transf = cpp.predict(dataset_test_pred)`,

  "Threshold Optimizer": `from fairlearn.postprocessing import ThresholdOptimizer

postprocess_est = ThresholdOptimizer(
    estimator=base_model,
    constraints="equalized_odds",
    predict_method="predict_proba"
)
postprocess_est.fit(X_train, y_train, sensitive_features=sensitive_col)
predictions = postprocess_est.predict(X_test, sensitive_features=sensitive_col)`,

  "Grid Search (Fairlearn)": `from fairlearn.reductions import GridSearch, DemographicParity
from sklearn.tree import DecisionTreeClassifier

sweep = GridSearch(
    DecisionTreeClassifier(),
    constraints=DemographicParity(),
    grid_size=20
)
sweep.fit(X_train, y_train, sensitive_features=sensitive_col)
predictors = sweep.predictors_`,
};

type MetricPair = {
  label: string;
  before: number;
  after: number;
  lowerIsBetter: boolean;
};

function metricsForStrategy(strategy: string, block: AuditMetricBlock | undefined, overall: number): MetricPair | null {
  switch (strategy) {
    case "Reweighing": {
      const before = block?.disparate_impact_ratio ?? 0;
      const after = Math.min(before * 1.35, 0.95);
      return { label: "Disparate impact ratio", before, after, lowerIsBetter: false };
    }
    case "Disparate Impact Remover": {
      const before = block?.demographic_parity_difference ?? 0;
      const after = before * 0.6;
      return { label: "Demographic parity Δ", before, after, lowerIsBetter: true };
    }
    case "Exponentiated Gradient Reduction": {
      const before = block?.equalized_odds_difference ?? 0;
      const after = before * 0.5;
      return { label: "Equalized odds Δ", before, after, lowerIsBetter: true };
    }
    case "Calibrated Equalized Odds": {
      const before = fprDisparity(block);
      const after = before * 0.45;
      return { label: "FPR disparity (max − min)", before, after, lowerIsBetter: true };
    }
    case "Threshold Optimizer": {
      const before = selectionRateDisparity(block);
      const after = before * 0.55;
      return { label: "Selection rate disparity (max − min)", before, after, lowerIsBetter: true };
    }
    case "Grid Search (Fairlearn)": {
      const before = overall;
      const after = Math.min(before + 18, 95);
      return { label: "Overall fairness score", before, after, lowerIsBetter: false };
    }
    default:
      return null;
  }
}

function fmt(n: number): string {
  if (Number.isNaN(n)) return "—";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(3);
}

/**
 * Apply & Preview overlay: estimated metric shift + runnable snippet for a remediation strategy.
 */
export function RemediationPreviewModal({ open, strategy, record, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open, strategy]);

  if (!open || !strategy || !record) return null;

  const block = firstMetricBlock(record);
  const overall = record.overall_score ?? 0;
  const pair = metricsForStrategy(strategy, block, overall);
  const code = SNIPPETS[strategy] ?? "";
  const pct = pair ? improvementPct(pair.before, pair.after, pair.lowerIsBetter) : 0;

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remediation-preview-title"
      onClick={onClose}
    >
      <div
        className="liquid-glass-strong mt-[10vh] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-8 text-[#F9FAFB] shadow-xl"
        style={{ color: "#F9FAFB" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="remediation-preview-title" className="text-lg font-semibold">
            {strategy}
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-[#F9FAFB] hover:bg-[#1F2937]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {pair ? (
          <div className="mt-6">
            <p className="mb-3 text-xs text-[#9CA3AF]">{pair.label}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 md:flex-nowrap">
              <div className="liquid-glass-danger min-w-[120px] flex-1 rounded-2xl p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-red-300/90">Before</div>
                <div className="mt-2 font-mono text-xl text-[#F9FAFB]">{fmt(pair.before)}</div>
              </div>
              <span className="text-2xl text-[#9CA3AF]" aria-hidden>
                →
              </span>
              <div className="liquid-glass-success min-w-[120px] flex-1 rounded-2xl p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-emerald-300/90">After applying</div>
                <div className="mt-2 font-mono text-xl text-[#F9FAFB]">{fmt(pair.after)}</div>
              </div>
            </div>
            <div className="liquid-glass-success mt-4 inline-flex rounded-full px-3 py-1 text-xs font-medium text-emerald-300">
              Estimated improvement: +{pct}%
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#9CA3AF]">No preview metrics for this strategy.</p>
        )}

        <hr className="my-6 border-white/20" />

        <h3 className="text-sm font-semibold text-[#F9FAFB]">Code snippet</h3>
        <pre className="liquid-glass mt-3 overflow-x-auto rounded-xl p-4 font-mono text-sm text-emerald-300">
          <code>{code || "No snippet available."}</code>
        </pre>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => void copyCode()} disabled={!code}>
            {copied ? "Copied!" : "Copy code"}
          </Button>
          <Button type="button" variant="default" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
