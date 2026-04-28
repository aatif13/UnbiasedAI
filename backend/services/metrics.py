"""
Fairness metric helpers and serialization utilities shared by routers and jobs.
"""

from __future__ import annotations

from typing import Any

from services.bias_detector import BiasDetector, dumps_results, fairness_score_from_results, results_to_jsonable


def run_detector_audit(
    df,
    target_col: str,
    sensitive_attrs: list[str],
    model: Any | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Execute ``BiasDetector.run_full_audit`` and attach aggregate score metadata.

    Args:
        df: pandas DataFrame.
        target_col: Outcome column.
        sensitive_attrs: Sensitive feature columns.
        model: Optional estimator.
        **kwargs: Passed through to ``run_full_audit``.

    Returns:
        JSON-serializable audit payload including ``overall_score`` and ``risk_level``.
    """
    detector = BiasDetector()
    raw = detector.run_full_audit(df, target_col, sensitive_attrs, model, **kwargs)
    score, risk = fairness_score_from_results(raw)
    payload = results_to_jsonable(raw)
    payload["_meta"]["overall_score"] = score
    payload["_meta"]["risk_level"] = risk
    return payload


__all__ = [
    "BiasDetector",
    "dumps_results",
    "fairness_score_from_results",
    "results_to_jsonable",
    "run_detector_audit",
]
