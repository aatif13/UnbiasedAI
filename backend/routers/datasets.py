"""Dataset upload and preview routes."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from core.config import get_settings
from core.store import get_dataset, list_datasets, new_id, save_dataset
from models.schemas import DatasetPreviewResponse, ImputationOption, SensitiveAttrDetection, UploadResponse
from services.bias_detector import detect_sensitive_attributes

router = APIRouter(prefix="/datasets", tags=["datasets"])

MAX_BYTES = 100 * 1024 * 1024


@router.get("")
async def list_datasets_route() -> list[dict[str, Any]]:
    """List datasets currently held in the in-memory store."""

    return list_datasets()


def _ensure_upload_dir() -> Path:
    settings = get_settings()
    p = Path(settings.upload_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _profile_column(series: pd.Series) -> dict[str, Any]:
    """Return lightweight column statistics for preview tables."""

    name = str(series.name)
    dtype = str(series.dtype)
    nulls = int(series.isna().sum())
    uniques = int(series.nunique(dropna=True))
    sample = series.dropna().astype(str).head(5).tolist()
    mini_hist: list[float] | None = None
    if pd.api.types.is_numeric_dtype(series):
        vals = pd.to_numeric(series, errors="coerce").dropna()
        if len(vals) > 0:
            hist, _ = np.histogram(vals, bins=min(10, max(3, len(vals) // 5)))
            mini_hist = [float(x) for x in hist.tolist()]
    return {
        "name": name,
        "dtype": dtype,
        "null_count": nulls,
        "unique_values": uniques,
        "sample_values": sample,
        "mini_histogram": mini_hist,
    }


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(request: Request, file: UploadFile = File(...)) -> UploadResponse:
    """
    Accept CSV/JSON/XLSX uploads, persist to disk, and return schema hints.

    Args:
        request: Incoming HTTP request (used for tracing only).
        file: Multipart file payload.

    Returns:
        ``UploadResponse`` including dataset id and sensitive column guesses.
    """
    _ = request
    filename = file.filename or "dataset"
    suffix = Path(filename).suffix.lower()
    if suffix not in {".csv", ".json", ".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use CSV, JSON, or Excel.")

    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100MB limit.")

    dataset_id = f"ds_{new_id()}"
    dest = _ensure_upload_dir() / f"{dataset_id}{suffix}"
    dest.write_bytes(raw)

    try:
        if suffix in (".xlsx", ".xls"):
            df = pd.read_excel(dest, nrows=5000)
        elif suffix == ".json":
            df = pd.read_json(dest)
        else:
            df = pd.read_csv(dest, nrows=5000)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}") from exc

    columns = [_profile_column(df[c]) for c in df.columns]
    dets = [SensitiveAttrDetection(**d.to_dict()) for d in detect_sensitive_attributes(df)]

    null_frac = float(df.isna().mean().mean())
    imputation_options = [
        ImputationOption(
            strategy="median",
            label="Median / mode imputation",
            description="Impute numeric columns with median and categorical with most frequent value.",
        ),
        ImputationOption(
            strategy="drop",
            label="Drop rows with missing target",
            description="Remove rows where the outcome or key sensitive fields are missing.",
        ),
    ]
    warnings: list[str] = []
    if null_frac > 0.05:
        warnings.append("Material missingness detected — choose an imputation strategy before running an audit.")

    meta = {
        "id": dataset_id,
        "name": Path(filename).stem,
        "local_path": str(dest),
        "file_url": str(dest),
        "file_size": len(raw),
        "row_count": int(len(df)),
        "columns": columns,
        "sensitive_attrs": [d.model_dump() for d in dets],
        "status": "READY",
    }
    save_dataset(meta)

    return UploadResponse(
        dataset_id=dataset_id,
        file_url=str(dest),
        row_count=int(len(df)),
        columns=columns,
        sensitive_detections=dets,
        imputation_options=imputation_options,
        warnings=warnings,
    )


@router.post("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
async def preview_dataset(dataset_id: str) -> DatasetPreviewResponse:
    """
    Re-scan stored dataset file and return column statistics.

    Args:
        dataset_id: Dataset identifier returned from upload.

    Returns:
        ``DatasetPreviewResponse`` suitable for wizard step 1 UI.
    """
    ds = get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    path = Path(ds["local_path"])
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        df = pd.read_excel(path, nrows=5000)
    elif suffix == ".json":
        df = pd.read_json(path)
    else:
        df = pd.read_csv(path, nrows=5000)

    columns = [_profile_column(df[c]) for c in df.columns]
    dets = [SensitiveAttrDetection(**d.to_dict()) for d in detect_sensitive_attributes(df)]
    warnings: list[str] = []
    for c in columns:
        if c["unique_values"] <= 1:
            warnings.append(f"Column '{c['name']}' is constant — not useful for fairness analysis.")

    return DatasetPreviewResponse(
        dataset_id=dataset_id,
        columns=columns,
        sensitive_detections=dets,
        warnings=warnings,
    )


@router.get("/{dataset_id}/raw-head")
async def raw_head(dataset_id: str, rows: int = 12) -> dict[str, Any]:
    """Return first N rows as JSON for quick table preview (prototype)."""

    ds = get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    path = Path(ds["local_path"])
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        df = pd.read_excel(path, nrows=rows)
    elif suffix == ".json":
        df = pd.read_json(path).head(rows)
    else:
        df = pd.read_csv(path, nrows=rows)
    return {"rows": json.loads(df.to_json(orient="records"))}
