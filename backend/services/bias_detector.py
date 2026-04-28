"""
Core fairness audit engine: fairlearn, optional AIF360, and custom metrics.
Handles binary and multi-class targets; continuous targets can be binarized.
"""

from __future__ import annotations

import json
import pickle
import re
import warnings
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    from fairlearn.metrics import (
        demographic_parity_difference,
        equalized_odds_difference,
        false_negative_rate,
        false_positive_rate,
        selection_rate,
    )

    _FAIRLEARN_METRICS = True
except ImportError:  # pragma: no cover
    demographic_parity_difference = None  # type: ignore[misc, assignment]
    equalized_odds_difference = None  # type: ignore[misc, assignment]
    false_negative_rate = None  # type: ignore[misc, assignment]
    false_positive_rate = None  # type: ignore[misc, assignment]
    selection_rate = None  # type: ignore[misc, assignment]
    _FAIRLEARN_METRICS = False

SENSITIVE_KEYWORDS: dict[str, list[str]] = {
    "gender": ["gender", "sex", "male", "female", "m/f", "woman", "man"],
    "race": ["race", "ethnicity", "ethnic", "nationality", "origin", "color"],
    "age": ["age", "dob", "birth", "born", "year_of_birth", "birthdate"],
    "religion": ["religion", "faith", "belief"],
    "disability": ["disability", "disabled", "handicap"],
    "income": ["income", "salary", "wage", "compensation", "pay"],
    "zipcode": ["zip", "zipcode", "postal", "postcode"],
    "name": ["name", "firstname", "lastname", "surname", "given_name", "family_name"],
}


@dataclass
class SensitiveAttrDetection:
    column: str
    category: str
    confidence: float
    kind: str
    recommended_action: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "column": self.column,
            "category": self.category,
            "confidence": self.confidence,
            "kind": self.kind,
            "recommended_action": self.recommended_action,
        }


def detect_sensitive_attributes(df: pd.DataFrame) -> list[SensitiveAttrDetection]:
    """
    Return columns likely to encode sensitive attributes with confidence scores.

    Returns:
        List of detections with direct vs proxy classification and recommended actions.
    """
    results: list[SensitiveAttrDetection] = []
    for col in df.columns:
        key = str(col).lower().replace(" ", "_")
        for category, keywords in SENSITIVE_KEYWORDS.items():
            for kw in keywords:
                if kw in key or re.search(rf"\b{re.escape(kw)}\b", key):
                    is_proxy = category in ("zipcode", "name")
                    conf = 0.95 if key == kw or key.endswith(kw) else 0.75
                    action = (
                        "Consider removing or encoding as non-identifying aggregates."
                        if is_proxy
                        else "Treat as protected attribute in fairness analysis; limit use in modeling."
                    )
                    results.append(
                        SensitiveAttrDetection(
                            column=str(col),
                            category=category,
                            confidence=min(1.0, conf),
                            kind="proxy" if is_proxy else "direct",
                            recommended_action=action,
                        )
                    )
                    break
    # De-duplicate by column, keep highest confidence
    by_col: dict[str, SensitiveAttrDetection] = {}
    for d in sorted(results, key=lambda x: -x.confidence):
        if d.column not in by_col:
            by_col[d.column] = d
    return list(by_col.values())


class BiasDetector:
    """
    Full fairness audit engine using fairlearn + optional aif360 + custom metrics.
    """

    MIN_ROWS_PER_GROUP = 30

    def run_full_audit(
        self,
        df: pd.DataFrame,
        target_col: str,
        sensitive_attrs: list[str],
        model: Any | None = None,
        *,
        privileged_groups: dict[str, str] | None = None,
        regression_threshold: float | None = None,
        positive_class: str | int | None = None,
    ) -> dict[str, Any]:
        """
        Run fairness metrics per sensitive attribute.

        Args:
            df: Input tabular data.
            target_col: Outcome column name.
            sensitive_attrs: List of column names treated as sensitive.
            model: Optional fitted sklearn-style classifier with predict / predict_proba.
            privileged_groups: Map sensitive column -> privileged level string for DI ratio.
            regression_threshold: If target is numeric, binarize y >= threshold as positive.
            positive_class: For multi-class, which class label is treated as the positive outcome.

        Returns:
            Nested dict keyed by sensitive attribute with metrics and violations.
        """
        privileged_groups = privileged_groups or {}
        df_work = df.copy()
        df_work = df_work.dropna(subset=[target_col])
        y_series = df_work[target_col]
        y_bin, multi_info = self._prepare_y(y_series, regression_threshold, positive_class)
        df_work = df_work.loc[y_bin.index]
        y_bin = y_bin.astype(int)

        X = df_work.drop(columns=[target_col], errors="ignore")
        y_pred, model_meta = self._get_predictions(X, y_bin, model)

        results: dict[str, Any] = {
            "_meta": {
                "target_column": target_col,
                "model": model_meta,
                "multi_class": multi_info,
                "rows_used": int(len(df_work)),
            }
        }

        global_warnings: list[str] = []
        for attr in sensitive_attrs:
            if attr not in df_work.columns:
                results[attr] = {"error": f"Sensitive attribute '{attr}' not found in dataframe."}
                continue

            s = df_work[attr].astype(str)
            counts = s.value_counts()
            small_groups = counts[counts < self.MIN_ROWS_PER_GROUP]
            if len(small_groups) > 0:
                global_warnings.append(
                    f"Attribute '{attr}': groups {list(small_groups.index)} have fewer than "
                    f"{self.MIN_ROWS_PER_GROUP} rows; fairness estimates may be unreliable."
                )

            grp_means = (
                pd.DataFrame({"y": y_bin.values, "g": s.astype(str).values}).groupby("g")["y"].mean()
            )
            same_rate = bool(grp_means.nunique() == 1)

            attr_block: dict[str, Any] = {
                "demographic_parity_difference": self._demographic_parity_diff(
                    y_bin.values, y_pred, s.values
                ),
                "demographic_parity_ratio": self._demographic_parity_ratio(y_bin.values, s.values),
                "equalized_odds_difference": self._equalized_odds_diff(
                    y_bin.values, y_pred, s.values
                ),
                "equal_opportunity_difference": self._equal_opportunity_diff(
                    y_bin.values, y_pred, s.values
                ),
                "disparate_impact_ratio": self._disparate_impact(
                    df_work, attr, target_col, y_bin, privileged_groups.get(attr)
                ),
                "selection_rate_by_group": self._selection_rates(y_bin.values, y_pred, s.values),
                "base_rate_by_group": self._base_rates(y_bin.values, s.values),
                "false_positive_rate_by_group": self._fpr_by_group(y_bin.values, y_pred, s.values),
                "false_negative_rate_by_group": self._fnr_by_group(y_bin.values, y_pred, s.values),
                "precision_by_group": self._precision_by_group(y_bin.values, y_pred, s.values),
                "consistency_score": self._consistency_score(X, y_pred),
                "group_representation": self._group_representation(df_work, attr),
                "intersectional_analysis": self._intersectional_analysis(
                    df_work, sensitive_attrs, target_col, y_bin
                ),
                "same_outcome_all_groups": same_rate,
            }

            attr_block["warnings"] = list(global_warnings)
            if same_rate:
                attr_block["notes"] = "All groups exhibit the same base rate; no disparity in outcomes detected."

            metrics_for_violations = {k: v for k, v in attr_block.items() if k not in ("warnings", "notes")}
            attr_block["violations"] = self._detect_violations(metrics_for_violations)
            results[attr] = attr_block

        results["_meta"]["warnings"] = global_warnings
        return results

    def _prepare_y(
        self,
        y: pd.Series,
        regression_threshold: float | None,
        positive_class: str | int | None,
    ) -> tuple[pd.Series, dict[str, Any]]:
        """Return binary y and metadata for multi-class / regression."""
        info: dict[str, Any] = {"mode": "binary"}
        if pd.api.types.is_numeric_dtype(y) and y.nunique() > 2:
            if regression_threshold is None:
                regression_threshold = float(np.nanmedian(pd.to_numeric(y, errors="coerce")))
            info["mode"] = "regression_binarized"
            info["threshold"] = regression_threshold
            y_num = pd.to_numeric(y, errors="coerce")
            y_bin = (y_num >= regression_threshold).astype(int)
            return y_bin, info

        unique = pd.Series(y.dropna().unique())
        if len(unique) > 2:
            info["mode"] = "multiclass"
            pos = positive_class if positive_class is not None else unique.iloc[-1]
            info["positive_label"] = pos
            y_bin = (y.astype(str) == str(pos)).astype(int)
            return y_bin, info

        # Binary classification or boolean
        if y.dtype == bool:
            return y.astype(int), info
        le = pd.Series(y).astype(str)
        vals = sorted(le.unique())
        if len(vals) == 2:
            # map lexicographically smaller to 0, larger to 1 — or use positive_class
            if positive_class is not None:
                y_bin = (le == str(positive_class)).astype(int)
            else:
                y_bin = (le == vals[1]).astype(int)
            return y_bin, info

        y_num = pd.to_numeric(y, errors="coerce").fillna(0)
        return (y_num > 0).astype(int), info

    def _get_predictions(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        model: Any | None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        """Obtain binary predictions; train baseline logistic regression if needed."""
        meta: dict[str, Any] = {"source": "user_model"}
        if model is not None:
            try:
                if hasattr(model, "predict_proba"):
                    proba = model.predict_proba(X)
                    if proba.shape[1] == 2:
                        pred = (proba[:, 1] >= 0.5).astype(int)
                    else:
                        pred = np.argmax(proba, axis=1)
                        warnings.warn("Multi-class proba: using argmax class index as discrete prediction.")
                else:
                    pred = np.asarray(model.predict(X))
                return pred.astype(int), meta
            except Exception as exc:
                meta["error"] = str(exc)
                meta["source"] = "fallback_after_error"

        num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = [c for c in X.columns if c not in num_cols]

        numeric_pipe = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]
        )
        cat_pipe = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]
        )
        pre = ColumnTransformer(
            transformers=[
                ("num", numeric_pipe, num_cols),
                ("cat", cat_pipe, cat_cols),
            ],
            remainder="drop",
        )
        clf = LogisticRegression(max_iter=200, class_weight="balanced")
        pipe = Pipeline(steps=[("pre", pre), ("clf", clf)])
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.25, random_state=42, stratify=y if y.nunique() > 1 else None
            )
        except ValueError:
            # Too few rows per class for stratified split (common on tiny CSVs / heavy dropna).
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
        try:
            pipe.fit(X_train, y_train)
            pred = pipe.predict(X)
        except Exception:
            # extreme fallback: majority class
            pred = np.full(len(y), int(y.mode().iloc[0]))
            meta["source"] = "majority_fallback"
            return pred, meta

        meta["source"] = "baseline_logistic_regression"
        meta["holdout_accuracy"] = float(pipe.score(X_test, y_test))
        return pred.astype(int), meta

    def _sensitive_series_for_fairlearn(self, s_values: np.ndarray) -> np.ndarray:
        """Encode sensitive attribute as integer codes for fairlearn."""
        codes, _ = pd.factorize(pd.Series(s_values).astype(str))
        return codes

    def _demographic_parity_diff(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> float:
        if not _FAIRLEARN_METRICS or demographic_parity_difference is None:
            return float("nan")
        sf = self._sensitive_series_for_fairlearn(sensitive)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return float(demographic_parity_difference(y_true, y_pred, sensitive_features=sf))

    def _demographic_parity_ratio(self, y_true: np.ndarray, sensitive: np.ndarray) -> float:
        """Ratio of min/max positive rate across groups (not odds ratio)."""
        s = pd.Series(sensitive.astype(str))
        y = pd.Series(y_true)
        rates = y.groupby(s).mean()
        if rates.empty:
            return 1.0
        mn, mx = float(rates.min()), float(rates.max())
        if mx == 0:
            return 1.0
        return mn / mx

    def _equalized_odds_diff(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> float:
        if not _FAIRLEARN_METRICS or equalized_odds_difference is None:
            return float("nan")
        sf = self._sensitive_series_for_fairlearn(sensitive)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return float(equalized_odds_difference(y_true, y_pred, sensitive_features=sf))

    def _equal_opportunity_diff(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> float:
        """Max TPR gap between groups among positive label y=1."""
        dfm = pd.DataFrame({"y": y_true, "p": y_pred, "g": sensitive.astype(str)})
        tprs = []
        for _, sub in dfm.groupby("g"):
            pos = sub[sub["y"] == 1]
            if len(pos) == 0:
                continue
            tprs.append(float((pos["p"] == 1).mean()))
        if len(tprs) < 2:
            return 0.0
        return float(max(tprs) - min(tprs))

    def _disparate_impact(
        self,
        df: pd.DataFrame,
        attr: str,
        target_col: str,
        y_bin: pd.Series,
        privileged_value: str | None,
    ) -> float:
        """
        Disparate Impact Ratio = P(Y=1|unprivileged) / P(Y=1|privileged).

        Uses privileged group when provided; otherwise uses group with highest base rate.
        """
        s = df[attr].astype(str)
        y = y_bin.values
        rates: dict[str, float] = {}
        for g in s.unique():
            mask = (s == g).values
            if mask.sum() == 0:
                continue
            rates[str(g)] = float(y[mask].mean())
        if len(rates) < 2:
            return 1.0
        if privileged_value is not None and str(privileged_value) in rates:
            priv_rate = rates[str(privileged_value)]
            others = [v for k, v in rates.items() if k != str(privileged_value)]
        else:
            priv_key = max(rates, key=rates.get)
            priv_rate = rates[priv_key]
            others = [v for k, v in rates.items() if k != priv_key]
        if priv_rate == 0:
            return 1.0
        worst = min(others) if others else priv_rate
        return float(worst / priv_rate)

    def _selection_rates(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> dict[str, float]:
        if not _FAIRLEARN_METRICS or selection_rate is None:
            return {}
        out: dict[str, float] = {}
        s = pd.Series(sensitive.astype(str))
        for g in s.unique():
            mask = (s == g).values
            out[str(g)] = float(selection_rate(y_true[mask], y_pred[mask]))
        return out

    def _base_rates(self, y_true: np.ndarray, sensitive: np.ndarray) -> dict[str, float]:
        s = pd.Series(sensitive.astype(str))
        y = pd.Series(y_true)
        return {str(g): float(sub.mean()) for g, sub in y.groupby(s)}

    def _fpr_by_group(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> dict[str, float]:
        if not _FAIRLEARN_METRICS or false_positive_rate is None:
            return {}
        out: dict[str, float] = {}
        s = pd.Series(sensitive.astype(str))
        for g in s.unique():
            mask = (s == g).values & (y_true == 0)
            if mask.sum() == 0:
                out[str(g)] = float("nan")
            else:
                out[str(g)] = float(false_positive_rate(y_true[mask], y_pred[mask]))
        return out

    def _fnr_by_group(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> dict[str, float]:
        if not _FAIRLEARN_METRICS or false_negative_rate is None:
            return {}
        out: dict[str, float] = {}
        s = pd.Series(sensitive.astype(str))
        for g in s.unique():
            mask = (s == g).values & (y_true == 1)
            if mask.sum() == 0:
                out[str(g)] = float("nan")
            else:
                out[str(g)] = float(false_negative_rate(y_true[mask], y_pred[mask]))
        return out

    def _precision_by_group(
        self, y_true: np.ndarray, y_pred: np.ndarray, sensitive: np.ndarray
    ) -> dict[str, float]:
        out: dict[str, float] = {}
        s = pd.Series(sensitive.astype(str))
        for g in s.unique():
            mask = (s == g).values
            if mask.sum() == 0 or (y_pred[mask] == 1).sum() == 0:
                out[str(g)] = float("nan")
            else:
                out[str(g)] = float(
                    precision_score(y_true[mask], y_pred[mask], zero_division=0)
                )
        return out

    def _consistency_score(self, X: pd.DataFrame, y_pred: np.ndarray, k: int = 5) -> float:
        """
        Individual fairness proxy: average label agreement with k nearest neighbors
        in standardized numeric feature space.
        """
        num = X.select_dtypes(include=[np.number])
        if num.shape[1] == 0:
            return 1.0
        imputed = SimpleImputer(strategy="median").fit_transform(num)
        scaled = StandardScaler().fit_transform(imputed)
        n = scaled.shape[0]
        kk = min(k, max(1, n - 1))
        if n <= 1:
            return 1.0
        nn = NearestNeighbors(n_neighbors=kk + 1).fit(scaled)
        _, idx = nn.kneighbors(scaled)
        scores = []
        for i in range(n):
            neigh = idx[i][1:]
            agree = np.mean(y_pred[neigh] == y_pred[i])
            scores.append(float(agree))
        return float(np.mean(scores))

    def _group_representation(self, df: pd.DataFrame, attr: str) -> dict[str, float]:
        s = df[attr].astype(str)
        vc = s.value_counts(normalize=True)
        return {str(k): float(v) for k, v in vc.items()}

    def _intersectional_analysis(
        self,
        df: pd.DataFrame,
        sensitive_attrs: list[str],
        target_col: str,
        y_bin: pd.Series,
    ) -> dict[str, Any]:
        """Build heatmap-style grid for first two sensitive attributes present in df."""
        attrs = [a for a in sensitive_attrs if a in df.columns][:2]
        if len(attrs) < 2:
            return {"axes": attrs, "cells": [], "note": "Need two sensitive columns for cross heatmap."}
        a0, a1 = attrs[0], attrs[1]
        grid: list[dict[str, Any]] = []
        for g0 in sorted(df[a0].astype(str).unique()):
            for g1 in sorted(df[a1].astype(str).unique()):
                mask = (df[a0].astype(str) == g0) & (df[a1].astype(str) == g1)
                if int(mask.sum()) == 0:
                    rate = float("nan")
                else:
                    idx = df.index[mask]
                    rate = float(y_bin.reindex(idx).dropna().mean())
                grid.append({"a0": g0, "a1": g1, "selection_rate": rate, "n": int(mask.sum())})
        return {"axes": [a0, a1], "cells": grid}

    def _detect_violations(self, metrics: dict[str, Any]) -> list[dict[str, Any]]:
        """Map metric thresholds to legal/ethical violation cards."""
        violations: list[dict[str, Any]] = []
        di = metrics.get("disparate_impact_ratio", 1.0)
        if isinstance(di, (int, float)) and di < 0.8:
            violations.append(
                {
                    "type": "LEGAL",
                    "rule": "EEOC 80% Rule",
                    "severity": "CRITICAL",
                    "description": (
                        "Disparate impact ratio below 0.8 may indicate adverse impact under "
                        "US employment selection guidelines (four-fifths rule)."
                    ),
                    "metric_value": di,
                    "threshold": 0.8,
                }
            )
        dpd = metrics.get("demographic_parity_difference", 0.0)
        if isinstance(dpd, (int, float)) and abs(float(dpd)) > 0.1:
            violations.append(
                {
                    "type": "ETHICAL",
                    "rule": "Demographic Parity",
                    "severity": "HIGH",
                    "description": "Large gap in positive decision rates between groups.",
                    "metric_value": dpd,
                    "threshold": 0.1,
                }
            )
        eod = metrics.get("equalized_odds_difference", 0.0)
        if isinstance(eod, (int, float)) and abs(float(eod)) > 0.1:
            violations.append(
                {
                    "type": "ETHICAL",
                    "rule": "Equalized Odds",
                    "severity": "HIGH",
                    "description": "False positive/negative error rates differ materially across groups.",
                    "metric_value": eod,
                    "threshold": 0.1,
                }
            )
        fprs = metrics.get("false_positive_rate_by_group", {}) or {}
        if isinstance(fprs, dict) and fprs:
            vals = [v for v in fprs.values() if isinstance(v, (int, float)) and not np.isnan(v)]
            if len(vals) >= 2 and (max(vals) - min(vals)) > 0.05:
                violations.append(
                    {
                        "type": "ETHICAL",
                        "rule": "False Positive Rate Parity",
                        "severity": "MEDIUM",
                        "description": "False positive rate disparity exceeds 5 percentage points between groups.",
                        "metric_value": max(vals) - min(vals),
                        "threshold": 0.05,
                    }
                )
        return violations


def fairness_score_from_results(results: dict[str, Any]) -> tuple[float, str]:
    """
    Compute overall 0-100 fairness score and coarse risk label from audit results.

    Returns:
        Tuple of (score, risk_level).
    """
    violations = 0
    critical = 0
    for key, block in results.items():
        if key.startswith("_") or not isinstance(block, dict):
            continue
        for v in block.get("violations", []) or []:
            violations += 1
            if v.get("severity") == "CRITICAL":
                critical += 1
    # Start from 100, penalize
    score = 100.0
    score -= violations * 8
    score -= critical * 12
    score = max(0.0, min(100.0, score))
    if critical > 0 or score < 50:
        risk = "CRITICAL"
    elif violations >= 3 or score < 70:
        risk = "HIGH"
    elif violations >= 1:
        risk = "MEDIUM"
    else:
        risk = "LOW"
    return score, risk


def results_to_jsonable(obj: Any) -> Any:
    """Convert numpy/pandas types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: results_to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [results_to_jsonable(v) for v in obj]
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, (np.floating, float)):
        x = float(obj)
        if np.isnan(x):
            return None
        if np.isinf(x):
            return None
        return x
    if isinstance(obj, (np.integer, int)) and not isinstance(obj, bool):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return results_to_jsonable(obj.tolist())
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()
    if isinstance(obj, np.generic) and not isinstance(obj, (np.floating, np.integer, np.bool_)):
        try:
            return results_to_jsonable(obj.item())
        except (ValueError, AttributeError):
            return str(obj)
    return obj


def dumps_results(obj: Any) -> str:
    return json.dumps(results_to_jsonable(obj), allow_nan=False)
