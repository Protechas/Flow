"""Auto-detect and pair Manufacturer Charts with OneDrive exports — additive only."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


MC_HINTS = (
    "component manufacturer chart",
    "manufacturer chart",
    "manufacturer component",
    " mc ",
)
EXPORT_HINTS = ("onedrive", "export", "file list")


@dataclass
class UploadedFileRef:
    name: str
    data: bytes
    file_type: str
    manufacturer: str


@dataclass
class ManufacturerPair:
    manufacturer: str
    mc_file: str | None
    export_file: str | None
    status: str
    status_icon: str
    mc_ref: UploadedFileRef | None = None
    export_ref: UploadedFileRef | None = None


def _normalize_name(filename: str) -> str:
    return re.sub(r"\.xlsx$", "", filename, flags=re.IGNORECASE).strip()


def extract_manufacturer(filename: str) -> str:
    stem = _normalize_name(filename)
    lower = stem.lower()

    for hint in MC_HINTS:
        if hint in lower:
            name = stem[: lower.index(hint)].strip(" -_")
            if name:
                return _title_manufacturer(name)

    match = re.match(r"^([A-Za-z][A-Za-z0-9 &.'-]+?)\s+\d+$", stem)
    if match:
        return _title_manufacturer(match.group(1).strip())

    match = re.match(r"^([A-Za-z][A-Za-z0-9 &.'-]+?)\s+onedrive", lower)
    if match:
        return _title_manufacturer(stem[: match.end(1)].strip())

    parts = re.split(r"[\s_-]+", stem)
    if parts:
        return _title_manufacturer(parts[0])
    return "Unknown"


def _title_manufacturer(name: str) -> str:
    cleaned = name.strip(" -_")
    if not cleaned:
        return "Unknown"
    return cleaned.title()


def classify_file(filename: str) -> str:
    lower = filename.lower()
    if any(hint in lower for hint in MC_HINTS):
        return "mc"
    if any(hint in lower for hint in EXPORT_HINTS):
        return "export"
    if re.search(r"\d+\.xlsx$", lower) and "chart" not in lower:
        return "export"
    if "chart" in lower:
        return "mc"
    return "unknown"


def build_file_refs(uploads: list[tuple[str, bytes]]) -> list[UploadedFileRef]:
    refs: list[UploadedFileRef] = []
    for name, data in uploads:
        refs.append(
            UploadedFileRef(
                name=name,
                data=data,
                file_type=classify_file(name),
                manufacturer=extract_manufacturer(name),
            )
        )
    return refs


def pair_manufacturer_files(uploads: list[tuple[str, bytes]]) -> list[ManufacturerPair]:
    refs = build_file_refs(uploads)
    manufacturers = sorted({ref.manufacturer for ref in refs if ref.manufacturer != "Unknown"})
    pairs: list[ManufacturerPair] = []

    for manufacturer in manufacturers:
        mc_candidates = [r for r in refs if r.manufacturer == manufacturer and r.file_type == "mc"]
        export_candidates = [r for r in refs if r.manufacturer == manufacturer and r.file_type == "export"]
        mc_ref = mc_candidates[0] if mc_candidates else None
        export_ref = export_candidates[0] if export_candidates else None

        if mc_ref and export_ref:
            status = "Ready"
            icon = "✓"
        elif mc_ref and not export_ref:
            status = "Missing Export"
            icon = "⚠"
        elif export_ref and not mc_ref:
            status = "Missing Chart"
            icon = "⚠"
        else:
            continue

        pairs.append(
            ManufacturerPair(
                manufacturer=manufacturer,
                mc_file=mc_ref.name if mc_ref else None,
                export_file=export_ref.name if export_ref else None,
                status=status,
                status_icon=icon,
                mc_ref=mc_ref,
                export_ref=export_ref,
            )
        )

    unmatched = [r for r in refs if r.manufacturer == "Unknown" or r.file_type == "unknown"]
    for ref in unmatched:
        pairs.append(
            ManufacturerPair(
                manufacturer=ref.manufacturer,
                mc_file=ref.name if ref.file_type == "mc" else None,
                export_file=ref.name if ref.file_type == "export" else None,
                status="Unclassified",
                status_icon="?",
                mc_ref=ref if ref.file_type == "mc" else None,
                export_ref=ref if ref.file_type == "export" else None,
            )
        )
    return pairs


def pairs_to_dataframe(pairs: list[ManufacturerPair]):
    import pandas as pd

    return pd.DataFrame(
        [
            {
                "Manufacturer": pair.manufacturer,
                "MC File": pair.mc_file or "",
                "Export File": pair.export_file or "",
                "Status": f"{pair.status_icon} {pair.status}",
            }
            for pair in pairs
        ]
    )


def ready_pairs(pairs: list[ManufacturerPair]) -> list[ManufacturerPair]:
    return [pair for pair in pairs if pair.status == "Ready"]
