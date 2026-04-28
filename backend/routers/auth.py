"""Authentication helpers (prototype — integrate with NextAuth JWT in production)."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/health")
async def auth_health(authorization: str | None = Header(default=None)) -> dict[str, str]:
    """
    Lightweight auth probe for upstream gateways.

    Args:
        authorization: Optional ``Bearer`` token.

    Returns:
        Status payload describing whether a token was supplied.
    """
    if authorization and authorization.lower().startswith("bearer "):
        return {"status": "ok", "mode": "token-present"}
    return {"status": "ok", "mode": "anonymous"}


@router.post("/verify")
async def verify_token(authorization: str | None = Header(default=None)) -> dict[str, str]:
    """
    Stub token verification — replace with JWT validation against NextAuth.

    Args:
        authorization: Bearer token header.

    Returns:
        Simple accepted/rejected response.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return {"status": "accepted"}
