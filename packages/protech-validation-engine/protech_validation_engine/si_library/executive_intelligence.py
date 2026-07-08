"""Post-audit executive intelligence — additive analytics only."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import pandas as pd

from .audit_engine import (
    MATCH_EXACT,
    MATCH_MISSING,
    MATCH_POTENTIAL_MISMATCH,
    MATCH_SPLIT_NAMING,
    MATCH_SPLIT_PRESENT,
    PASSING_STATUSES,
    AuditResult,
    extract_system_root_from_row,
)

PASSING_STATUSES_SET = PASSING_STATUSES

CONFIDENCE_EXACT = 100
CONFIDENCE_PLACEHOLDER = 95
CONFIDENCE_SPLIT_PRESENT = 95
CONFIDENCE_MODEL_ALIAS = 90
CONFIDENCE_NORMALIZED = 90
CONFIDENCE_POTENTIAL = 60
CONFIDENCE_MISSING = 0


@dataclass
class ExecutivePackage:
    """Enriched audit output for dashboards, Excel, and PDF export."""

    result: AuditResult
    enriched_audit_df: pd.DataFrame
    pcs_defense: dict[str, Any]
    rule_impact: pd.DataFrame
    system_analysis: pd.DataFrame
    vehicle_analysis: pd.DataFrame
    executive_summary: str
    dashboard_extensions: dict[str, Any] = field(default_factory=dict)


def _notes_lower(row: pd.Series) -> str:
    return str(row.get("Match Notes", "")).lower()


def _detect_rule_corrections(row: pd.Series) -> list[str]:
    rules: list[str] = []
    notes = _notes_lower(row)
    status = row.get("Match Status", "")

    if "matched after model normalization" in notes:
        rules.append("Model Alias Matches")
    if "placeholder generated" in notes or row.get("Is Placeholder") == "Yes":
        rules.append("Placeholder Matches")
    if status in {MATCH_SPLIT_PRESENT, MATCH_SPLIT_NAMING}:
        rules.append("Split File Matches")
    if "expected filename normalized before comparison" in notes:
        rules.append("Normalized Filename Matches")
    if "matching year/model folder" in notes or "placeholder exact filename match" in notes:
        rules.append("Folder-Aware Matches")
    return rules


def compute_match_confidence(row: pd.Series) -> int:
    status = row.get("Match Status", "")
    notes = _notes_lower(row)

    if status == MATCH_EXACT:
        if "placeholder" in notes:
            return CONFIDENCE_PLACEHOLDER
        if "model normalization" in notes:
            return CONFIDENCE_MODEL_ALIAS
        if "normalized before comparison" in notes:
            return CONFIDENCE_NORMALIZED
        return CONFIDENCE_EXACT
    if status == MATCH_SPLIT_PRESENT:
        return CONFIDENCE_SPLIT_PRESENT
    if status == MATCH_POTENTIAL_MISMATCH:
        return CONFIDENCE_POTENTIAL
    if status == MATCH_MISSING:
        return CONFIDENCE_MISSING
    if status == MATCH_SPLIT_NAMING:
        return CONFIDENCE_MODEL_ALIAS
    return CONFIDENCE_POTENTIAL


def predict_root_cause(row: pd.Series) -> str:
    status = row.get("Match Status", "")
    notes = _notes_lower(row)
    is_placeholder = row.get("Is Placeholder") == "Yes"

    if status == MATCH_MISSING:
        if "not in matching folder" in notes or "folder path" in notes:
            return "Folder Path Issue"
        if is_placeholder or "placeholder" in notes:
            return "Placeholder Missing"
        return "Missing File"
    if status == MATCH_SPLIT_NAMING:
        return "Split File Naming Issue"
    if status == MATCH_POTENTIAL_MISMATCH:
        return "Classification Mismatch"
    if "model normalization" in notes:
        return "Model Alias Issue"
    if status == MATCH_SPLIT_PRESENT:
        return "PCS Mapping Candidate"
    if is_placeholder:
        return "Placeholder Missing"
    return "Unknown"


def enrich_audit_dataframe(audit_df: pd.DataFrame) -> pd.DataFrame:
    enriched = audit_df.copy()
    enriched["Match Confidence"] = enriched.apply(compute_match_confidence, axis=1)
    enriched["Predicted Root Cause"] = enriched.apply(predict_root_cause, axis=1)
    enriched["Rule Corrections"] = enriched.apply(
        lambda row: "; ".join(_detect_rule_corrections(row)) or "None",
        axis=1,
    )
    return enriched


def build_pcs_defense(audit_df: pd.DataFrame, dashboard: dict[str, Any]) -> dict[str, Any]:
    status_counts = audit_df["Match Status"].value_counts().to_dict()
    missing = int(status_counts.get(MATCH_MISSING, 0))
    potential = int(status_counts.get(MATCH_POTENTIAL_MISMATCH, 0))
    split_naming = int(status_counts.get(MATCH_SPLIT_NAMING, 0))

    return {
        "Total Expected MC Deliverables": dashboard.get("Expected MC Deliverables", len(audit_df)),
        "Exact Matches": int(status_counts.get(MATCH_EXACT, 0)),
        "Split Files Present": int(status_counts.get(MATCH_SPLIT_PRESENT, 0)),
        "Missing From OneDrive Export": missing,
        "Potential Classification/Naming Mismatch": potential,
        "Split File Naming Difference": split_naming,
        "Estimated True Missing Files": missing,
        "Estimated PCS / Mapping Review Items": potential + split_naming,
    }


def build_rule_impact(audit_df: pd.DataFrame) -> pd.DataFrame:
    rule_labels = {
        "Model Alias Matches": "Model Alias Matches",
        "Placeholder Matches": "Placeholder Detection",
        "Split File Matches": "Split File Detection",
        "Normalized Filename Matches": "Normalized Filename Repair",
        "Folder-Aware Matches": "Folder-Aware Matching",
    }
    total = len(audit_df) or 1
    counts: dict[str, int] = {key: 0 for key in rule_labels}

    for _, row in audit_df.iterrows():
        for rule in _detect_rule_corrections(row):
            counts[rule] = counts.get(rule, 0) + 1

    records = []
    for rule_key, label in rule_labels.items():
        rows_corrected = counts.get(rule_key, 0)
        records.append(
            {
                "Rule Name": label,
                "Rows Corrected": rows_corrected,
                "Percentage of Total Matches": round((rows_corrected / total) * 100, 1),
            }
        )

    return pd.DataFrame(records).sort_values("Rows Corrected", ascending=False)


def build_system_analysis(audit_df: pd.DataFrame) -> pd.DataFrame:
    records = []
    for _, row in audit_df.iterrows():
        root = extract_system_root_from_row(row.to_dict()) or "UNKNOWN"
        records.append(
            {
                "System Root": root,
                "Match Status": row.get("Match Status", ""),
                "Passing": row.get("Match Status", "") in PASSING_STATUSES_SET,
            }
        )

    if not records:
        return pd.DataFrame(
            columns=[
                "System Root",
                "Expected Count",
                "Exact Matches",
                "Review Count",
                "Missing Count",
                "Compliance %",
            ]
        )

    frame = pd.DataFrame(records)
    grouped = []
    for system, group in frame.groupby("System Root"):
        expected = len(group)
        exact = int((group["Match Status"] == MATCH_EXACT).sum())
        missing = int((group["Match Status"] == MATCH_MISSING).sum())
        passing = int(group["Passing"].sum())
        review = int(
            group["Match Status"]
            .isin([MATCH_SPLIT_NAMING, MATCH_POTENTIAL_MISMATCH, MATCH_SPLIT_PRESENT])
            .sum()
        )
        compliance = round((passing / expected) * 100, 1) if expected else 0.0
        grouped.append(
            {
                "System Root": system,
                "Expected Count": expected,
                "Exact Matches": exact,
                "Review Count": review,
                "Missing Count": missing,
                "Compliance %": compliance,
            }
        )

    return pd.DataFrame(grouped).sort_values("Review Count", ascending=False)


def build_vehicle_analysis(audit_df: pd.DataFrame) -> pd.DataFrame:
    if audit_df.empty:
        return pd.DataFrame(
            columns=[
                "Year",
                "Model",
                "Expected Deliverables",
                "Passing Compliance",
                "Review Count",
                "Missing Count",
                "Compliance %",
            ]
        )

    work = audit_df.copy()
    work["Vehicle Model"] = work.get("Normalized Model", work.get("Raw Model", ""))
    grouped = []
    for (year, model), group in work.groupby(["Year", "Vehicle Model"], dropna=False):
        expected = len(group)
        passing = int(group["Match Status"].isin(PASSING_STATUSES_SET).sum())
        missing = int((group["Match Status"] == MATCH_MISSING).sum())
        review = int(
            group["Match Status"]
            .isin([MATCH_SPLIT_NAMING, MATCH_POTENTIAL_MISMATCH, MATCH_SPLIT_PRESENT])
            .sum()
        )
        compliance = round((passing / expected) * 100, 1) if expected else 0.0
        grouped.append(
            {
                "Year": year,
                "Model": model,
                "Expected Deliverables": expected,
                "Passing Compliance": passing,
                "Review Count": review,
                "Missing Count": missing,
                "Compliance %": compliance,
            }
        )

    return pd.DataFrame(grouped).sort_values("Review Count", ascending=False)


def build_executive_summary(
    manufacturer: str,
    dashboard: dict[str, Any],
    pcs_defense: dict[str, Any],
    audit_df: pd.DataFrame,
) -> str:
    rate = dashboard.get("Compliance Rate (%)", 0)
    avg_confidence = round(audit_df["Match Confidence"].mean(), 1) if not audit_df.empty else 0
    true_missing = pcs_defense.get("Estimated True Missing Files", 0)
    pcs_review = pcs_defense.get("Estimated PCS / Mapping Review Items", 0)

    return (
        f"The {manufacturer} SI Library audit completed on {datetime.now():%B %d, %Y} "
        f"reviewed {dashboard.get('Expected MC Deliverables', 0)} expected deliverables "
        f"with a {rate}% compliance rate and {avg_confidence}% average match confidence. "
        f"Leadership should prioritize {true_missing} estimated true missing files while "
        f"routing {pcs_review} items to PCS or mapping review rather than treating them as export gaps."
    )


def build_executive_package(result: AuditResult) -> ExecutivePackage:
    enriched_df = enrich_audit_dataframe(result.audit_df)
    pcs_defense = build_pcs_defense(enriched_df, result.dashboard)
    rule_impact = build_rule_impact(enriched_df)
    system_analysis = build_system_analysis(enriched_df)
    vehicle_analysis = build_vehicle_analysis(enriched_df)
    executive_summary = build_executive_summary(
        result.manufacturer,
        result.dashboard,
        pcs_defense,
        enriched_df,
    )

    avg_confidence = round(enriched_df["Match Confidence"].mean(), 1) if not enriched_df.empty else 0
    root_cause_breakdown = (
        enriched_df["Predicted Root Cause"].value_counts().rename_axis("Root Cause").reset_index(name="Count")
        if not enriched_df.empty
        else pd.DataFrame(columns=["Root Cause", "Count"])
    )

    dashboard_extensions = {
        "PCS Defense": pcs_defense,
        "Rule Impact": rule_impact,
        "Average Match Confidence": avg_confidence,
        "System Analysis": system_analysis,
        "Vehicle Analysis": vehicle_analysis,
        "Root Cause Breakdown": root_cause_breakdown,
        "Executive Summary": executive_summary,
        "Top Review Systems": system_analysis.sort_values("Review Count", ascending=False).head(10),
        "Top Missing Systems": system_analysis.sort_values("Missing Count", ascending=False).head(10),
    }

    return ExecutivePackage(
        result=result,
        enriched_audit_df=enriched_df,
        pcs_defense=pcs_defense,
        rule_impact=rule_impact,
        system_analysis=system_analysis,
        vehicle_analysis=vehicle_analysis,
        executive_summary=executive_summary,
        dashboard_extensions=dashboard_extensions,
    )
