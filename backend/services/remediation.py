"""
Bias mitigation strategy catalog and recommendation engine.
Code snippets are runnable Python examples (adapt paths/column names).
"""

from __future__ import annotations

from typing import Any


class RemediationEngine:
    """
    Suggests bias mitigation strategies based on audit metrics and violations.
    """

    STRATEGIES: dict[str, list[dict[str, Any]]] = {
        "pre_processing": [
            {
                "name": "Reweighing",
                "description": "Assigns instance weights so that joint distribution of labels and groups is closer to independence.",
                "library": "aif360",
                "use_when": "disparate_impact_ratio < 0.8",
                "code_snippet": (
                    "import pandas as pd\n"
                    "from aif360.datasets import BinaryLabelDataset\n"
                    "from aif360.algorithms.preprocessing import Reweighing\n"
                    "\n"
                    "df = pd.read_csv('your_dataset.csv')\n"
                    "privileged_groups = [{protected_attr: 1}]\n"
                    "unprivileged_groups = [{protected_attr: 0}]\n"
                    "dataset = BinaryLabelDataset(\n"
                    "    favorable_label=1,\n"
                    "    unfavorable_label=0,\n"
                    "    df=df,\n"
                    "    label_names=['label'],\n"
                    "    protected_attribute_names=['protected_attr'],\n"
                    ")\n"
                    "rw = Reweighing(unprivileged_groups=unprivileged_groups, privileged_groups=privileged_groups)\n"
                    "transformed = rw.fit_transform(dataset)\n"
                    "weights = transformed.instance_weights\n"
                ),
                "effort": "LOW",
                "impact": "HIGH",
            },
            {
                "name": "Disparate Impact Remover",
                "description": "Repairs feature distributions to remove disparate impact while preserving rank ordering within groups.",
                "library": "aif360",
                "use_when": "demographic_parity_difference > 0.1",
                "code_snippet": (
                    "from aif360.algorithms.preprocessing import DisparateImpactRemover\n"
                    "from aif360.datasets import BinaryLabelDataset\n"
                    "\n"
                    "di = DisparateImpactRemover(repair_level=1.0, sensitive_attribute='gender')\n"
                    "repaired = di.fit_transform(dataset)\n"
                    "df_repaired = repaired.convert_to_dataframe()[0]\n"
                ),
                "effort": "MEDIUM",
                "impact": "HIGH",
            },
        ],
        "in_processing": [
            {
                "name": "Exponentiated Gradient Reduction",
                "description": "Fairlearn reduction approach that wraps a scikit-learn estimator and enforces demographic parity or equalized odds.",
                "library": "fairlearn",
                "use_when": "equalized_odds_difference > 0.1",
                "code_snippet": (
                    "import numpy as np\n"
                    "import pandas as pd\n"
                    "from sklearn.linear_model import LogisticRegression\n"
                    "from fairlearn.reductions import ExponentiatedGradient, DemographicParity\n"
                    "\n"
                    "X = pd.read_csv('features.csv')\n"
                    "y = np.load('labels.npy')\n"
                    "sensitive = X['gender'].astype(str)\n"
                    "X_model = X.drop(columns=['gender'])\n"
                    "est = LogisticRegression(max_iter=200)\n"
                    "mitigator = ExponentiatedGradient(est, constraints=DemographicParity())\n"
                    "mitigator.fit(X_model, y, sensitive_features=sensitive)\n"
                    "y_pred_mitigated = mitigator.predict(X_model)\n"
                ),
                "effort": "MEDIUM",
                "impact": "HIGH",
            },
            {
                "name": "Grid Search (Fairlearn)",
                "description": "Searches over constraint strengths to trade accuracy for fairness objectives.",
                "library": "fairlearn",
                "use_when": "any_metric_violation",
                "code_snippet": (
                    "from fairlearn.reductions import GridSearch, DemographicParity\n"
                    "from sklearn.linear_model import LogisticRegression\n"
                    "\n"
                    "constraint = DemographicParity()\n"
                    "sweep = GridSearch(LogisticRegression(max_iter=200), constraint, grid_size=11, sample_weight_name='sample_weight')\n"
                    "sweep.fit(X_train, y_train, sensitive_features=s_train)\n"
                    "predictors = sweep.predictors_\n"
                ),
                "effort": "MEDIUM",
                "impact": "MEDIUM",
            },
        ],
        "post_processing": [
            {
                "name": "Threshold Optimizer",
                "description": "Chooses group-specific thresholds on ROC to satisfy fairness constraints at deployment time.",
                "library": "fairlearn",
                "use_when": "equalized_odds or equal_opportunity violation",
                "code_snippet": (
                    "import numpy as np\n"
                    "from fairlearn.postprocessing import ThresholdOptimizer, demographic_parity_difference\n"
                    "from sklearn.linear_model import LogisticRegression\n"
                    "\n"
                    "est = LogisticRegression(max_iter=200).fit(X_train, y_train)\n"
                    "scores = est.predict_proba(X_train)[:, 1]\n"
                    "to = ThresholdOptimizer(estimator=est, constraints='demographic_parity', prefit=False)\n"
                    "to.fit(X_train, y_train, sensitive_features=s_train, scores=scores)\n"
                    "adjusted = to.predict(X_test, sensitive_features=s_test, scores=est.predict_proba(X_test)[:, 1])\n"
                ),
                "effort": "LOW",
                "impact": "MEDIUM",
            },
            {
                "name": "Calibrated Equalized Odds",
                "description": "Post-processing that equalizes false positive and false negative rates across groups.",
                "library": "aif360",
                "use_when": "false_positive_rate_disparity > 0.05",
                "code_snippet": (
                    "from aif360.algorithms.postprocessing import CalibratedEqOddsPostprocessing\n"
                    "\n"
                    "cpp = CalibratedEqOddsPostprocessing(\n"
                    "    privileged_groups=privileged_groups,\n"
                    "    unprivileged_groups=unprivileged_groups,\n"
                    "    cost_constraint='weighted',\n"
                    "    seed=42,\n"
                    ")\n"
                    "cpp = cpp.fit(val_dataset, val_pred_dataset)\n"
                    "pred_eq = cpp.predict(test_pred_dataset)\n"
                ),
                "effort": "LOW",
                "impact": "HIGH",
            },
        ],
    }

    def recommend(self, audit_results: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Return prioritized remediation strategies inferred from audit metrics.

        Args:
            audit_results: Output of ``BiasDetector.run_full_audit`` (JSON-serializable dict).

        Returns:
            Ordered list of strategy dicts including ``phase``, ``priority``, and ``rationale``.
        """
        flags: set[str] = set()
        for _attr, block in audit_results.items():
            if not isinstance(block, dict) or _attr.startswith("_"):
                continue
            di = block.get("disparate_impact_ratio")
            if isinstance(di, (int, float)) and di < 0.8:
                flags.add("disparate_impact_ratio < 0.8")
            dpd = block.get("demographic_parity_difference")
            if isinstance(dpd, (int, float)) and abs(dpd) > 0.1:
                flags.add("demographic_parity_difference > 0.1")
            eod = block.get("equalized_odds_difference")
            if isinstance(eod, (int, float)) and abs(eod) > 0.1:
                flags.add("equalized_odds_difference > 0.1")
            fprs = block.get("false_positive_rate_by_group") or {}
            if isinstance(fprs, dict) and fprs:
                vals = [v for v in fprs.values() if isinstance(v, (int, float)) and v == v]
                if len(vals) >= 2 and (max(vals) - min(vals)) > 0.05:
                    flags.add("false_positive_rate_disparity > 0.05")
            viols = block.get("violations") or []
            if viols:
                flags.add("any_metric_violation")

        scored: list[tuple[int, dict[str, Any]]] = []
        for phase, items in self.STRATEGIES.items():
            for strat in items:
                cond = strat["use_when"]
                match = False
                if cond == "any_metric_violation" and "any_metric_violation" in flags:
                    match = True
                elif cond in flags:
                    match = True
                elif cond == "equalized_odds or equal_opportunity violation":
                    if "equalized_odds_difference > 0.1" in flags:
                        match = True
                priority = 0
                if match:
                    priority = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}[strat["impact"]]
                entry = {
                    "phase": phase,
                    "priority_score": priority,
                    "match": match,
                    **strat,
                    "rationale": (
                        f"Recommended because audit flags include: {', '.join(sorted(flags))}."
                        if match
                        else "Optional hardening; no strong trigger fired for this strategy."
                    ),
                }
                scored.append((priority, entry))

        scored.sort(key=lambda x: (-x[0], x[1]["name"]))
        return [e for _, e in scored]


__all__ = ["RemediationEngine"]
