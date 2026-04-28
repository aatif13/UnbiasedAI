"""
Maps fairness violations and use-cases to compliance frameworks (informational, not legal advice).
"""

from __future__ import annotations

from typing import Any

COMPLIANCE_FRAMEWORKS: dict[str, dict[str, Any]] = {
    "EEOC_80_RULE": {
        "name": "EEOC 80% / Four-Fifths Rule",
        "jurisdiction": "United States",
        "applies_to": ["hiring", "promotion", "termination"],
        "threshold": {"disparate_impact_ratio": 0.8},
        "legal_risk": "CRITICAL",
        "description": (
            "Under US employment selection guidelines, if a protected group's selection rate "
            "is less than 80% of the highest-performing group, that disparity can trigger "
            "adverse impact review."
        ),
        "source": "29 CFR Part 1607",
    },
    "EU_GDPR_ART22": {
        "name": "GDPR Article 22 — Automated Decision Making",
        "jurisdiction": "European Union",
        "applies_to": ["any_automated_decision"],
        "requirements": ["explainability", "human_review_right", "opt_out"],
        "legal_risk": "HIGH",
        "description": (
            "Individuals have the right not to be subject to solely automated decisions "
            "with legal or similarly significant effects, subject to exceptions."
        ),
        "source": "GDPR Art. 22",
    },
    "EU_AI_ACT": {
        "name": "EU AI Act — High-Risk AI Systems",
        "jurisdiction": "European Union",
        "applies_to": ["employment", "credit", "education", "healthcare"],
        "requirements": ["bias_testing", "documentation", "human_oversight"],
        "legal_risk": "HIGH",
        "description": (
            "High-risk AI systems must meet conformity requirements including data governance, "
            "risk management, transparency, and human oversight."
        ),
        "source": "Regulation (EU) 2024/1689",
    },
    "FCRA": {
        "name": "Fair Credit Reporting Act",
        "jurisdiction": "United States",
        "applies_to": ["credit_scoring", "lending"],
        "legal_risk": "HIGH",
        "description": (
            "Covers consumer reports and adverse actions; model transparency and permissible "
            "purposes matter for credit decisions."
        ),
        "source": "15 U.S.C. §1681",
    },
}


def frameworks_for_violations(violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Select compliance frameworks relevant to a list of violation dicts.

    Args:
        violations: Violation objects produced by ``BiasDetector._detect_violations``.

    Returns:
        Framework metadata entries to render as compliance cards.
    """
    keys: set[str] = set()
    for v in violations:
        rule = str(v.get("rule", ""))
        if "EEOC" in rule or v.get("type") == "LEGAL":
            keys.add("EEOC_80_RULE")
        if "GDPR" in rule:
            keys.add("EU_GDPR_ART22")
    if not keys:
        keys.add("EU_AI_ACT")
    return [COMPLIANCE_FRAMEWORKS[k] for k in keys if k in COMPLIANCE_FRAMEWORKS]


def frameworks_for_domain(domain: str | None) -> list[dict[str, Any]]:
    """
    Return frameworks commonly associated with a business domain string.

    Args:
        domain: Short domain label such as ``hiring`` or ``lending``.

    Returns:
        Matching framework dicts.
    """
    if not domain:
        return [COMPLIANCE_FRAMEWORKS["EU_AI_ACT"]]
    d = domain.lower()
    out: list[dict[str, Any]] = []
    if d in ("hiring", "employment", "hr"):
        out.append(COMPLIANCE_FRAMEWORKS["EEOC_80_RULE"])
        out.append(COMPLIANCE_FRAMEWORKS["EU_AI_ACT"])
    if d in ("lending", "credit", "loan"):
        out.append(COMPLIANCE_FRAMEWORKS["FCRA"])
        out.append(COMPLIANCE_FRAMEWORKS["EU_AI_ACT"])
    if d in ("healthcare", "medical"):
        out.append(COMPLIANCE_FRAMEWORKS["EU_AI_ACT"])
    if not out:
        out.append(COMPLIANCE_FRAMEWORKS["EU_AI_ACT"])
    # De-duplicate by name
    seen: set[str] = set()
    uniq: list[dict[str, Any]] = []
    for item in out:
        name = str(item.get("name"))
        if name not in seen:
            seen.add(name)
            uniq.append(item)
    return uniq


__all__ = ["COMPLIANCE_FRAMEWORKS", "frameworks_for_domain", "frameworks_for_violations"]
