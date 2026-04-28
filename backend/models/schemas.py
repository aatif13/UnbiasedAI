"""Pydantic request/response models for the UnbiasedAI FastAPI service."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AuditDepth(str, Enum):
    """Depth of fairness computation."""

    QUICK = "quick"
    STANDARD = "standard"
    DEEP = "deep"


class SensitiveAttrDetection(BaseModel):
    """Detected column that may encode sensitive information."""

    column: str
    category: str
    confidence: float = Field(ge=0.0, le=1.0)
    kind: str = Field(description="'direct' or 'proxy'")
    recommended_action: str


class AuditRequest(BaseModel):
    """Payload to start a bias audit job."""

    dataset_id: str
    name: str
    target_column: str
    sensitive_attrs: list[str]
    privileged_groups: dict[str, str] | None = None
    model_path: str | None = None
    audit_depth: AuditDepth = AuditDepth.STANDARD
    domain: str | None = Field(
        default=None,
        description="Business domain hint for compliance mapping (e.g. hiring, lending).",
    )
    regression_threshold: float | None = Field(
        default=None,
        description="If target is continuous, values >= threshold become positive class (1).",
    )


class AuditStatusResponse(BaseModel):
    """Polling response for audit progress."""

    audit_id: str
    status: str
    progress_percent: int
    message: str
    partial_metrics: dict[str, Any] | None = None


class DatasetPreviewResponse(BaseModel):
    """Column statistics and sensitive-attribute hints."""

    dataset_id: str
    columns: list[dict[str, Any]]
    sensitive_detections: list[SensitiveAttrDetection]
    warnings: list[str] = Field(default_factory=list)


class ImputationOption(BaseModel):
    """Suggested handling for missing values."""

    strategy: str
    label: str
    description: str


class UploadResponse(BaseModel):
    """Result of dataset upload."""

    dataset_id: str
    file_url: str
    row_count: int
    columns: list[dict[str, Any]]
    sensitive_detections: list[SensitiveAttrDetection]
    imputation_options: list[ImputationOption] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
