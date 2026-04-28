"""
Model explainability helpers using SHAP when installed, with coefficient fallback.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    import shap  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover
    shap = None  # type: ignore[misc, assignment]


def _empty_shap_result(error: str) -> dict[str, Any]:
    return {
        "error": error,
        "feature_names": [],
        "mean_abs_shap": {},
        "proxy_flags": [],
        "waterfall_preview": [],
    }


def _take_explain_rows(num: pd.DataFrame, y: pd.Series, sample_size: int) -> tuple[pd.DataFrame, pd.Series]:
    """
    Take up to ``sample_size`` rows, preferring a slice that contains both outcome classes
    so LogisticRegression does not fail on a single-class fit.
    """
    y = y.reset_index(drop=True)
    num = num.reset_index(drop=True)
    m = min(sample_size, len(num))
    if m == 0:
        return num.iloc[:0].astype(float), y.iloc[:0]

    # Use full matrix when already at or below sample cap (train_test_split needs train_size < n).
    if m >= len(num):
        return num.astype(float).reset_index(drop=True), y.iloc[: len(num)].reset_index(drop=True)

    if y.iloc[:m].nunique() >= 2:
        return num.iloc[:m].astype(float), y.iloc[:m]

    if y.nunique() < 2:
        return num.iloc[:m].astype(float), y.iloc[:m]

    try:
        idx = np.arange(len(num))
        take = m
        _, sel = train_test_split(
            idx,
            train_size=take,
            stratify=y.astype(int),
            random_state=42,
            shuffle=True,
        )
        sel = np.sort(np.asarray(sel))
        return num.iloc[sel].astype(float).reset_index(drop=True), y.iloc[sel].reset_index(drop=True)
    except ValueError:
        # Too few samples per class for stratification
        return num.iloc[:m].astype(float), y.iloc[:m]


def compute_shap_summary(
    X: pd.DataFrame,
    y: pd.Series,
    sample_size: int = 200,
) -> dict[str, Any]:
    """
    Compute feature attributions for numeric columns using SHAP or coefficient fallback.

    Args:
        X: Feature matrix.
        y: Binary labels aligned with ``X``.
        sample_size: Max rows used for fitting / explanation.

    Returns:
        Dict with ``feature_names``, ``mean_abs_shap``, ``waterfall_preview``, and ``proxy_flags``.
    """
    try:
        return _compute_shap_summary_impl(X, y, sample_size=sample_size)
    except Exception as exc:  # noqa: BLE001
        return _empty_shap_result(f"Explainability failed: {exc}")


def _compute_shap_summary_impl(
    X: pd.DataFrame,
    y: pd.Series,
    sample_size: int = 200,
) -> dict[str, Any]:
    X = X.copy().reset_index(drop=True)
    y = pd.to_numeric(y, errors="coerce").fillna(0).astype(int).reset_index(drop=True)
    num = X.select_dtypes(include=[np.number])
    if num.shape[1] == 0:
        return _empty_shap_result("No numeric columns for explainability.")

    Xn, yn = _take_explain_rows(num, y, sample_size)
    if len(yn) == 0:
        return _empty_shap_result("No rows available for explainability.")

    if yn.nunique() < 2:
        return _empty_shap_result(
            "Outcome has only one class in the sampled rows; cannot fit an attribution model."
        )

    pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=400, class_weight="balanced")),
        ]
    )
    pipe.fit(Xn, yn)

    mean_by_col: dict[str, float] = {}
    names = list(Xn.columns)

    if shap is not None:
        try:
            explainer = shap.Explainer(pipe.predict, Xn, algorithm="auto")
            explain_rows = min(40, len(Xn))
            sv = explainer(Xn.iloc[:explain_rows])
            arr = np.array(sv.values)
            if arr.ndim == 1:
                arr = arr.reshape(-1, len(names))
            mean_abs = np.mean(np.abs(arr), axis=0)
            mean_by_col = {names[i]: float(mean_abs[i]) for i in range(min(len(names), len(mean_abs)))}
        except Exception:
            mean_by_col = _coef_fallback(pipe, names)
    else:
        mean_by_col = _coef_fallback(pipe, names)

    if not mean_by_col:
        mean_by_col = _coef_fallback(pipe, names)

    proxy_flags = _flag_proxy_columns(X, mean_by_col)
    waterfall = [
        {"feature": k, "value": v} for k, v in sorted(mean_by_col.items(), key=lambda kv: -abs(kv[1]))[:12]
    ]

    out: dict[str, Any] = {
        "feature_names": names,
        "mean_abs_shap": mean_by_col,
        "proxy_flags": proxy_flags,
        "waterfall_preview": waterfall,
    }
    if shap is None:
        out["note"] = "SHAP not installed — using linear model |coefficients| as attribution proxy."
    return out


def _coef_fallback(pipe: Pipeline, names: list[str]) -> dict[str, float]:
    coef = np.abs(np.ravel(pipe.named_steps["clf"].coef_))
    n = min(len(names), len(coef))
    return {names[i]: float(coef[i]) for i in range(n)}


def _flag_proxy_columns(X: pd.DataFrame, shap_importance: dict[str, float]) -> list[dict[str, Any]]:
    """Flag columns that look like proxies when attribution mass concentrates on them."""
    flags: list[dict[str, Any]] = []
    for col in X.columns:
        low = str(col).lower()
        if any(k in low for k in ("zip", "postal", "name", "address")):
            imp = float(shap_importance.get(str(col), 0.0))
            if imp > 0.02:
                flags.append(
                    {
                        "column": str(col),
                        "reason": "Potential proxy variable correlated with geography or identity.",
                        "mean_abs_shap": imp,
                    }
                )
    return flags


__all__ = ["compute_shap_summary"]
