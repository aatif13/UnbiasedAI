"""
In-memory persistence for datasets and audits (prototype).
Replace with PostgreSQL + Prisma via a dedicated service in production.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from threading import Lock
from typing import Any

_lock = Lock()
_datasets: dict[str, dict[str, Any]] = {}
_audits: dict[str, dict[str, Any]] = {}


def new_id() -> str:
    """Generate a cuid-like identifier."""

    return uuid.uuid4().hex[:24]


def save_dataset(meta: dict[str, Any]) -> str:
    """Register a dataset record."""

    ds_id = str(meta.get("id") or new_id())
    meta = {**meta, "id": ds_id}
    with _lock:
        _datasets[ds_id] = meta
    return ds_id


def get_dataset(ds_id: str) -> dict[str, Any] | None:
    """Fetch dataset metadata by id."""

    with _lock:
        return _datasets.get(ds_id)


def list_datasets() -> list[dict[str, Any]]:
    """Return all dataset records (prototype; paginate in production)."""

    with _lock:
        return list(_datasets.values())


def save_audit(meta: dict[str, Any]) -> str:
    """Register an audit record."""

    audit_id = str(meta.get("id") or new_id())
    meta = {**meta, "id": audit_id}
    with _lock:
        _audits[audit_id] = meta
    return audit_id


def update_audit(audit_id: str, patch: dict[str, Any]) -> None:
    """Merge fields into an audit record."""

    with _lock:
        if audit_id in _audits:
            _audits[audit_id] = {**_audits[audit_id], **patch}


def list_audits() -> list[dict[str, Any]]:
    """Return all audit records (prototype; paginate in production)."""

    with _lock:
        return list(_audits.values())


def get_audit(audit_id: str) -> dict[str, Any] | None:
    """Fetch audit metadata and results."""

    with _lock:
        return _audits.get(audit_id)


def get_audit_by_share_token(token: str) -> dict[str, Any] | None:
    """Locate an audit by its public ``shared_token``."""

    with _lock:
        for rec in _audits.values():
            if rec.get("shared_token") == token:
                return rec
    return None


def load_demo_audits(path: Path) -> None:
    """Hydrate store from a JSON file of precomputed audits."""

    if not path.exists():
        return
    root = path.parent
    data = json.loads(path.read_text(encoding="utf-8"))
    for ds in data.get("datasets", []):
        lp = str(ds.get("local_path", ""))
        if lp.startswith("SAMPLE_PATH/"):
            ds["local_path"] = str(root / lp.replace("SAMPLE_PATH/", ""))
            ds["file_url"] = ds["local_path"]
    with _lock:
        for ds in data.get("datasets", []):
            _datasets[str(ds["id"])] = ds
        for au in data.get("audits", []):
            _audits[str(au["id"])] = au


__all__ = [
    "get_audit",
    "get_audit_by_share_token",
    "get_dataset",
    "list_audits",
    "list_datasets",
    "load_demo_audits",
    "new_id",
    "save_audit",
    "save_dataset",
    "update_audit",
]
