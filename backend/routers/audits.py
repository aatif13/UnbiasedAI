"""Audit lifecycle routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from core.config import get_settings
from core.rate_limit import check_rate_limit
from core.store import get_audit, list_audits, new_id, save_audit, update_audit
from models.schemas import AuditRequest, AuditStatusResponse
from services.jobs import run_audit_job

router = APIRouter(prefix="/audits", tags=["audits"])


@router.get("")
async def audits_index() -> list[dict[str, Any]]:
    """List audits currently held in the in-memory store."""

    return list_audits()


def _client_id(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "anonymous"


@router.post("/run")
async def run_audit(payload: AuditRequest, background_tasks: BackgroundTasks, request: Request) -> dict[str, str]:
    """
    Start an asynchronous bias audit job.

    Args:
        payload: Audit configuration.
        background_tasks: FastAPI background task queue.
        request: HTTP request for rate limiting.

    Returns:
        JSON object with ``audit_id``.
    """
    settings = get_settings()
    allowed, retry = check_rate_limit(
        _client_id(request),
        max_events=settings.rate_limit_audits_per_hour,
        window_seconds=3600,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Retry after {retry}s.")

    audit_id = f"au_{new_id()}"
    record: dict[str, Any] = {
        "id": audit_id,
        "dataset_id": payload.dataset_id,
        "name": payload.name,
        "target_column": payload.target_column,
        "sensitive_attrs": payload.sensitive_attrs,
        "privileged_groups": payload.privileged_groups or {},
        "model_path": payload.model_path,
        "audit_depth": payload.audit_depth.value,
        "regression_threshold": payload.regression_threshold,
        "domain": payload.domain,
        "status": "PENDING",
        "progress_percent": 0,
        "progress_message": "Queued",
        "metrics": None,
        "remediations": None,
        "shap_values": None,
        "compliance": None,
        "report_html": None,
        "partial_metrics": None,
    }
    save_audit(record)
    background_tasks.add_task(run_audit_job, audit_id)
    return {"audit_id": audit_id}


@router.get("/{audit_id}/status", response_model=AuditStatusResponse)
async def get_audit_status(audit_id: str) -> AuditStatusResponse:
    """
    Poll audit progress.

    Args:
        audit_id: Identifier returned from ``/audits/run``.

    Returns:
        ``AuditStatusResponse`` with percent complete and optional partial metrics.
    """
    rec = get_audit(audit_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Audit not found")
    return AuditStatusResponse(
        audit_id=audit_id,
        status=str(rec.get("status", "UNKNOWN")),
        progress_percent=int(rec.get("progress_percent", 0)),
        message=str(rec.get("progress_message", "")),
        partial_metrics=rec.get("partial_metrics"),
    )


@router.get("/{audit_id}/results")
async def get_audit_results(audit_id: str) -> dict[str, Any]:
    """
    Fetch completed metrics, violations, remediations, and explainability output.

    Args:
        audit_id: Audit identifier.

    Returns:
        Full audit record including nested metrics.
    """
    rec = get_audit(audit_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Audit not found")
    return rec


@router.get("/{audit_id}/report")
async def get_report(audit_id: str) -> dict[str, Any]:
    """
    Return generated HTML report payload and optional shared token.

    Args:
        audit_id: Audit identifier.

    Returns:
        Dict with ``html`` and ``shared_token`` when available.
    """
    rec = get_audit(audit_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Audit not found")
    html = rec.get("report_html")
    if not html:
        raise HTTPException(status_code=400, detail="Report not ready yet.")
    token = rec.get("shared_token")
    if not token:
        token = f"tok_{new_id()[:16]}"
        update_audit(audit_id, {"shared_token": token})
    return {"audit_id": audit_id, "html": html, "shared_token": token}
