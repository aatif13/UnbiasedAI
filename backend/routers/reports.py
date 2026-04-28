"""Public report sharing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import HTMLResponse

from core.store import get_audit, get_audit_by_share_token

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/share/{token}", response_class=HTMLResponse)
async def shared_report(token: str) -> HTMLResponse:
    """
    Render a shareable HTML report using an opaque token.

    Args:
        token: Public token stored on the audit record.

    Returns:
        HTML page suitable for embedding or PDF export.
    """
    rec = get_audit_by_share_token(token)
    if not rec or not rec.get("report_html"):
        raise HTTPException(status_code=404, detail="Report not found")
    return HTMLResponse(content=str(rec["report_html"]))


@router.get("/{audit_id}/export")
async def export_stub(audit_id: str) -> Response:
    """
    Placeholder for PDF export — returns HTML with download hint.

    Args:
        audit_id: Audit identifier.

    Returns:
        Raw HTML response (PDF generation can be wired to headless Chrome later).
    """
    rec = get_audit(audit_id)
    if not rec or not rec.get("report_html"):
        raise HTTPException(status_code=404, detail="Report not available")
    return Response(
        content=str(rec["report_html"]),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="audit-{audit_id}.html"'},
    )
