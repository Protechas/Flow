"""Benchmark validation for known-good manufacturer audit outputs."""

from __future__ import annotations

from typing import Any

from .config import ACURA_BENCHMARK


def validate_acura_benchmark(dashboard: dict[str, Any], manufacturer: str) -> dict[str, Any] | None:
    """Compare Acura audit metrics against the known-good benchmark."""
    if "acura" not in manufacturer.lower():
        return None

    expected = int(dashboard.get("Expected MC Deliverables", 0))
    passing = int(dashboard.get("Passing Compliance", 0))
    needs_review = int(dashboard.get("Needs SI/PCS Review", 0))
    tolerance = ACURA_BENCHMARK["tolerance"]

    issues: list[str] = []
    if expected != ACURA_BENCHMARK["expected_deliverables"]:
        issues.append(
            f"Expected deliverables {expected} vs benchmark {ACURA_BENCHMARK['expected_deliverables']}"
        )
    if abs(passing - ACURA_BENCHMARK["passing_compliance"]) > tolerance:
        issues.append(
            f"Passing compliance {passing} vs benchmark {ACURA_BENCHMARK['passing_compliance']}"
        )
    if abs(needs_review - ACURA_BENCHMARK["needs_review"]) > tolerance:
        issues.append(
            f"Needs review {needs_review} vs benchmark {ACURA_BENCHMARK['needs_review']}"
        )

    if not issues:
        return {
            "status": "pass",
            "message": "Acura benchmark within tolerance.",
            "details": [],
        }

    return {
        "status": "warning",
        "message": "Benchmark mismatch: matching logic may be broken.",
        "details": issues,
        "benchmark": ACURA_BENCHMARK,
        "actual": {
            "expected_deliverables": expected,
            "passing_compliance": passing,
            "needs_review": needs_review,
        },
    }
