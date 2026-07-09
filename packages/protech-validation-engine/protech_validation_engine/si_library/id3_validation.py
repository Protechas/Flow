"""ID3 Validation: compare a manufacturer chart against a rules workbook.

Generic, format-tolerant comparison: both workbooks are loaded whole, shared
columns are detected, preferred key columns (year/make/model/system…) form the
match identity, and every remaining shared column is value-checked. Findings:

- rule rows with no matching chart row      → chart is missing required entries
- chart rows not covered by any rule        → unreviewed/unexpected entries
- matched rows whose shared values differ   → rule mismatches
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import pandas as pd

PREFERRED_KEYS = [
    "year",
    "make",
    "manufacturer",
    "model",
    "system",
    "systems",
    "acronym",
    "module",
    "component",
]


def _read_workbook(data: bytes, filename: str = "") -> pd.DataFrame:
    if filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data))
        frames = [df]
    else:
        xl = pd.ExcelFile(io.BytesIO(data))
        frames = []
        for name in xl.sheet_names:
            sheet = xl.parse(name)
            if sheet.empty:
                continue
            frames.append(sheet)
    if not frames:
        return pd.DataFrame()
    cleaned = []
    for frame in frames:
        frame = frame.copy()
        frame.columns = [str(c).strip() for c in frame.columns]
        frame = frame.dropna(how="all")
        cleaned.append(frame)
    return pd.concat(cleaned, ignore_index=True) if cleaned else pd.DataFrame()


def _norm(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip().lower()
    text = re.sub(r"\.0$", "", text)  # 2021.0 → 2021 from numeric coercion
    return re.sub(r"\s+", " ", text)


@dataclass
class Id3Result:
    key_columns: list[str]
    value_columns: list[str]
    chart_rows: int
    rule_rows: int
    matched: int
    mismatched: int
    missing_from_chart: int
    not_covered_by_rules: int
    findings: list[dict] = field(default_factory=list)
    mismatch_records: list[dict] = field(default_factory=list)
    missing_records: list[dict] = field(default_factory=list)
    uncovered_records: list[dict] = field(default_factory=list)


def compare_chart_to_rules(
    chart_bytes: bytes,
    rules_bytes: bytes,
    chart_filename: str = "",
    rules_filename: str = "",
) -> Id3Result:
    chart = _read_workbook(chart_bytes, chart_filename)
    rules = _read_workbook(rules_bytes, rules_filename)
    if chart.empty:
        raise ValueError("The manufacturer chart has no data rows")
    if rules.empty:
        raise ValueError("The rules workbook has no data rows")

    chart_lookup = {c.lower(): c for c in chart.columns}
    rules_lookup = {c.lower(): c for c in rules.columns}
    shared = [c for c in chart_lookup if c in rules_lookup]
    if not shared:
        raise ValueError(
            "The two workbooks share no columns — nothing to compare. "
            f"Chart columns: {list(chart.columns)[:8]}; rules columns: {list(rules.columns)[:8]}"
        )

    key_cols = [k for k in PREFERRED_KEYS if k in shared]
    if not key_cols:
        key_cols = shared[: min(2, len(shared))]
    value_cols = [c for c in shared if c not in key_cols]

    def row_key(row, lookup) -> tuple:
        return tuple(_norm(row.get(lookup[k])) for k in key_cols)

    def row_display(row, lookup) -> str:
        return " ".join(str(row.get(lookup[k]) or "").strip() for k in key_cols).strip()

    rules_by_key: dict[tuple, pd.Series] = {}
    for _, row in rules.iterrows():
        key = row_key(row, rules_lookup)
        if any(part for part in key):
            rules_by_key.setdefault(key, row)

    chart_keys: set[tuple] = set()
    matched = 0
    mismatched = 0
    result = Id3Result(
        key_columns=[chart_lookup[k] for k in key_cols],
        value_columns=[chart_lookup[c] for c in value_cols],
        chart_rows=len(chart),
        rule_rows=len(rules_by_key),
        matched=0,
        mismatched=0,
        missing_from_chart=0,
        not_covered_by_rules=0,
    )

    for idx, row in chart.iterrows():
        key = row_key(row, chart_lookup)
        if not any(part for part in key):
            continue
        chart_keys.add(key)
        display = row_display(row, chart_lookup)
        rule = rules_by_key.get(key)
        if rule is None:
            result.not_covered_by_rules += 1
            result.uncovered_records.append({"Row": int(idx) + 2, "Entry": display})
            result.findings.append(
                {
                    "title": f"Not covered by rules: {display}",
                    "severity": "medium",
                    "root_cause": "Chart entry has no matching rule",
                    "confidence_score": 90,
                    "suggested_correction": "Confirm this entry belongs, or add a rule for it.",
                    "manufacturer": _first_make(row, chart_lookup),
                    "match_status": "Not Covered By Rules",
                    "affected_record_ref": {"chart_row": int(idx) + 2, "entry": display},
                    "evidence": {"key": " | ".join(part or "—" for part in key)},
                }
            )
            continue

        diffs = []
        for col in value_cols:
            expected = _norm(rule.get(rules_lookup[col]))
            actual = _norm(row.get(chart_lookup[col]))
            if expected and expected != actual:
                diffs.append(
                    {
                        "column": chart_lookup[col],
                        "rule_value": str(rule.get(rules_lookup[col]) or ""),
                        "chart_value": str(row.get(chart_lookup[col]) or ""),
                    }
                )
        if diffs:
            mismatched += 1
            result.mismatch_records.append(
                {
                    "Row": int(idx) + 2,
                    "Entry": display,
                    "Differences": "; ".join(
                        f"{d['column']}: rule '{d['rule_value']}' vs chart '{d['chart_value']}'"
                        for d in diffs
                    ),
                }
            )
            result.findings.append(
                {
                    "title": f"Rule mismatch: {display}",
                    "severity": "high",
                    "root_cause": f"{len(diffs)} column(s) differ from the rules",
                    "confidence_score": 95,
                    "suggested_correction": "; ".join(
                        f"set {d['column']} to '{d['rule_value']}'" for d in diffs
                    ),
                    "manufacturer": _first_make(row, chart_lookup),
                    "match_status": "Rule Mismatch",
                    "affected_record_ref": {"chart_row": int(idx) + 2, "entry": display},
                    "evidence": {"differences": diffs},
                }
            )
        else:
            matched += 1

    for key, rule in rules_by_key.items():
        if key in chart_keys:
            continue
        display = row_display(rule, rules_lookup)
        result.missing_from_chart += 1
        result.missing_records.append({"Entry": display})
        result.findings.append(
            {
                "title": f"Missing from chart: {display}",
                "severity": "high",
                "root_cause": "Rule entry has no matching chart row",
                "confidence_score": 90,
                "suggested_correction": "Add this entry to the manufacturer chart.",
                "manufacturer": _first_make(rule, rules_lookup),
                "match_status": "Missing From Chart",
                "affected_record_ref": {"entry": display},
                "evidence": {"key": " | ".join(part or "—" for part in key)},
            }
        )

    result.matched = matched
    result.mismatched = mismatched
    return result


def _first_make(row, lookup) -> str | None:
    for candidate in ("make", "manufacturer"):
        if candidate in lookup:
            value = str(row.get(lookup[candidate]) or "").strip()
            if value:
                return value
    return None


def write_id3_workbook(result: Id3Result) -> io.BytesIO:
    buffer = io.BytesIO()
    summary = pd.DataFrame(
        [
            {"Metric": "Chart rows", "Value": result.chart_rows},
            {"Metric": "Rule entries", "Value": result.rule_rows},
            {"Metric": "Matched (rule-compliant)", "Value": result.matched},
            {"Metric": "Rule mismatches", "Value": result.mismatched},
            {"Metric": "Missing from chart", "Value": result.missing_from_chart},
            {"Metric": "Not covered by rules", "Value": result.not_covered_by_rules},
            {"Metric": "Key columns", "Value": ", ".join(result.key_columns)},
            {"Metric": "Compared columns", "Value": ", ".join(result.value_columns) or "—"},
        ]
    )
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Summary", index=False)
        pd.DataFrame(result.mismatch_records or [{"Entry": "None"}]).to_excel(
            writer, sheet_name="Rule Mismatches", index=False
        )
        pd.DataFrame(result.missing_records or [{"Entry": "None"}]).to_excel(
            writer, sheet_name="Missing From Chart", index=False
        )
        pd.DataFrame(result.uncovered_records or [{"Entry": "None"}]).to_excel(
            writer, sheet_name="Not Covered By Rules", index=False
        )
    buffer.seek(0)
    return buffer
