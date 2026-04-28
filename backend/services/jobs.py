"""
Background audit execution: loads data, runs metrics, SHAP, remediation, and report HTML.
"""

from __future__ import annotations

import html
import json
import pickle
from pathlib import Path
from typing import Any

import pandas as pd

from core.config import get_settings
from core.store import get_audit, get_dataset, update_audit
from services.bias_detector import results_to_jsonable
from services.compliance import frameworks_for_domain, frameworks_for_violations
from services.explainability import compute_shap_summary
from services.metrics import run_detector_audit
from services.remediation import RemediationEngine


def _progress(audit_id: str, percent: int, message: str, partial: dict[str, Any] | None = None) -> None:
    update_audit(
        audit_id,
        {
            "progress_percent": percent,
            "progress_message": message,
            "partial_metrics": partial,
        },
    )


def run_audit_job(audit_id: str) -> None:
    """
    Execute a full audit pipeline and persist results on the in-memory audit record.

    Args:
        audit_id: Identifier created by the audits router.
    """
    settings = get_settings()
    record = get_audit(audit_id)
    if not record:
        return

    try:
        update_audit(audit_id, {"status": "RUNNING", "progress_percent": 1, "progress_message": "Starting…"})
        ds = get_dataset(record["dataset_id"])
        if not ds:
            raise RuntimeError("Dataset not found")

        path = Path(ds["local_path"])
        if not path.exists():
            raise RuntimeError("Dataset file missing on disk")

        _progress(audit_id, 10, "Analyzing data distribution…")
        if path.suffix.lower() in (".xlsx", ".xls"):
            df = pd.read_excel(path)
        elif path.suffix.lower() == ".json":
            df = pd.read_json(path)
        else:
            df = pd.read_csv(path)

        target = record["target_column"]
        sens = list(record["sensitive_attrs"])
        privileged = record.get("privileged_groups") or {}

        model = None
        mp = record.get("model_path")
        if mp and Path(mp).exists():
            try:
                with open(mp, "rb") as fh:
                    model = pickle.load(fh)
            except Exception:
                model = None

        _progress(audit_id, 35, "Computing demographic parity…")
        partial: dict[str, Any] = {}
        for i, attr in enumerate(sens):
            if attr in df.columns:
                partial[attr] = {"status": "computing"}
            _progress(audit_id, 35 + int(30 * (i + 1) / max(1, len(sens))), f"Analyzing attribute: {attr}", partial)

        _progress(audit_id, 70, "Running equalized odds analysis…")
        metrics = run_detector_audit(
            df,
            target,
            sens,
            model,
            privileged_groups=privileged,
            regression_threshold=record.get("regression_threshold"),
        )

        _progress(audit_id, 82, "Detecting intersectional bias…", metrics)

        raw_for_engine = {k: v for k, v in metrics.items() if not str(k).startswith("_")}
        # Reconstruct numpy-less dict for remediation engine
        remediation_engine = RemediationEngine()
        remediations = remediation_engine.recommend(metrics)

        all_violations: list[dict[str, Any]] = []
        for _k, block in metrics.items():
            if isinstance(block, dict) and "violations" in block:
                all_violations.extend(block.get("violations") or [])

        compliance_cards = frameworks_for_violations(all_violations)
        domain = record.get("domain")
        if domain:
            compliance_cards = frameworks_for_domain(str(domain)) + compliance_cards
        seen_names: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for card in compliance_cards:
            name = str(card.get("name", ""))
            if name in seen_names:
                continue
            seen_names.add(name)
            deduped.append(card)
        compliance_cards = deduped

        _progress(audit_id, 90, "Generating SHAP explainability…", metrics)
        X = df.drop(columns=[target], errors="ignore")
        y_series = pd.to_numeric(df[target], errors="coerce").fillna(0)
        y_bin = (y_series >= y_series.median()).astype(int) if y_series.nunique() > 2 else y_series.astype(int)
        try:
            shap_values = compute_shap_summary(X, y_bin)
        except Exception as shap_exc:  # noqa: BLE001
            shap_values = {
                "error": f"Explainability step failed: {shap_exc}",
                "feature_names": [],
                "mean_abs_shap": {},
                "proxy_flags": [],
                "waterfall_preview": [],
            }

        _progress(audit_id, 95, "Generating remediations…", metrics)

        score = float(metrics.get("_meta", {}).get("overall_score", 0.0))
        risk = str(metrics.get("_meta", {}).get("risk_level", "MEDIUM"))

        html = _render_report_html(record["name"], metrics, remediations, compliance_cards)

        update_audit(
            audit_id,
            {
                "status": "COMPLETED",
                "progress_percent": 100,
                "progress_message": "Completed",
                "metrics": metrics,
                "remediations": remediations,
                "shap_values": shap_values,
                "compliance": compliance_cards,
                "overall_score": score,
                "risk_level": risk,
                "report_html": html,
                "partial_metrics": None,
            },
        )
    except Exception as exc:  # noqa: BLE001
        update_audit(
            audit_id,
            {
                "status": "FAILED",
                "progress_message": str(exc),
                "error": str(exc),
            },
        )


def _render_report_html(
    title: str,
    metrics: dict[str, Any],
    remediations: list[dict[str, Any]],
    compliance: list[dict[str, Any]],
) -> str:
    """Build a simple static HTML report for sharing."""

    safe_title = html.escape(str(title), quote=True)
    try:
        body = json.dumps(results_to_jsonable(metrics), indent=2, allow_nan=False)
    except (TypeError, ValueError):
        body = json.dumps({"serialization_error": "metrics could not be encoded"}, indent=2)
    try:
        rem = json.dumps(results_to_jsonable(remediations), indent=2, allow_nan=False)
    except (TypeError, ValueError):
        rem = json.dumps([], indent=2)
    try:
        comp = json.dumps(results_to_jsonable(compliance), indent=2, allow_nan=False)
    except (TypeError, ValueError):
        comp = json.dumps([], indent=2)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{safe_title} — UnbiasedAI Report</title>
  <style>
    body {{ font-family: system-ui, sans-serif; background:#070B14; color:#F9FAFB; padding:2rem; }}
    pre {{ background:#111827; padding:1rem; overflow:auto; border:1px solid #1F2937; }}
    h1,h2 {{ color:#3B82F6; }}
  </style>
</head>
<body>
  <h1>UnbiasedAI Audit Report — {safe_title}</h1>
  <h2>Metrics</h2>
  <pre>{body}</pre>
  <h2>Remediation</h2>
  <pre>{rem}</pre>
  <h2>Compliance context</h2>
  <pre>{comp}</pre>
  <p style="color:#6B7280;font-size:12px;">Informational only — not legal advice.</p>
</body>
</html>"""


__all__ = ["run_audit_job"]
