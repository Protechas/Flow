"""Persistent application settings for the SI Library Audit Tool."""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .audit_engine import SPLIT_PATTERNS

APP_NAME = "ProTech SI Library Audit Tool"
APP_FOLDER_NAME = "ProTech_SI_Audit_Tool"
SETTINGS_VERSION = 3

DEFAULT_MODEL_ALIASES: dict[str, dict[str, str]] = {
    "Chevrolet": {
        "1500 Silverado": "Silverado 1500",
        "2500 Silverado": "Silverado 2500",
        "3500 Silverado": "Silverado 3500",
        "1500 Silverado LTD": "Silverado 1500 LTD",
        "2500 Silverado HD": "Silverado 2500 HD",
        "3500 Silverado HD": "Silverado 3500 HD",
        "Corvette E-RAY [HEV]": "Corvette E-Ray [EV]",
        "BrightDrop Zevo 400": "BrightDrop 400",
        "BrightDrop Zevo 600": "BrightDrop 600",
    },
}

DEFAULT_PLACEHOLDER_FILENAMES: dict[str, str] = {
    "NV": "No Night Vision [NV] - (NV) For This Vehicle.pdf",
    "BUC": "No Backup Camera [BUC] - (BUC) For This Vehicle.pdf",
    "ACC": "No Front Radar Sensor [FRS] - (ACC) For This Vehicle.pdf",
    "AEB": "No Front Radar Sensor [FRS] - (AEB) For This Vehicle.pdf",
    "BSW": "No Rear Radar Sensor [RRS] - (BSW) For This Vehicle.pdf",
    "LKA": "No Windshield Camera [WSC] - (LKA) For This Vehicle.pdf",
    "SVC": "No Surround View Camera [SVC] - (SVC) For This Vehicle.pdf",
    "APA": "No Park Distance Sensor [PDS] - (APA) For This Vehicle.pdf",
}

ACURA_BENCHMARK = {
    "expected_deliverables": 744,
    "passing_compliance": 626,
    "needs_review": 118,
    "tolerance": 20,
}


@dataclass
class AuditSettings:
    """Configurable audit behavior loaded from disk and editable in Settings."""

    filename_translation_rules: list[dict[str, str]] = field(default_factory=list)
    split_file_patterns: list[str] = field(default_factory=lambda: list(SPLIT_PATTERNS))
    placeholder_mappings: list[dict[str, str]] = field(default_factory=list)
    placeholder_filenames: dict[str, str] = field(default_factory=lambda: deepcopy(DEFAULT_PLACEHOLDER_FILENAMES))
    model_aliases: dict[str, dict[str, str]] = field(default_factory=lambda: deepcopy(DEFAULT_MODEL_ALIASES))
    compliance_threshold_excellent: float = 90.0
    compliance_threshold_acceptable: float = 70.0
    similarity_threshold: float = 0.55

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> AuditSettings:
        defaults = cls()
        return cls(
            filename_translation_rules=list(data.get("filename_translation_rules", defaults.filename_translation_rules)),
            split_file_patterns=list(data.get("split_file_patterns", defaults.split_file_patterns)),
            placeholder_mappings=list(data.get("placeholder_mappings", defaults.placeholder_mappings)),
            placeholder_filenames=_parse_placeholder_filenames(
                data.get("placeholder_filenames"),
                defaults.placeholder_filenames,
            ),
            model_aliases=_parse_model_aliases(data.get("model_aliases"), defaults.model_aliases),
            compliance_threshold_excellent=float(
                data.get("compliance_threshold_excellent", defaults.compliance_threshold_excellent)
            ),
            compliance_threshold_acceptable=float(
                data.get("compliance_threshold_acceptable", defaults.compliance_threshold_acceptable)
            ),
            similarity_threshold=float(data.get("similarity_threshold", defaults.similarity_threshold)),
        )


def _parse_placeholder_filenames(
    raw: object,
    fallback: dict[str, str],
) -> dict[str, str]:
    if not isinstance(raw, dict):
        return dict(fallback)

    parsed = {str(key).upper(): str(value) for key, value in raw.items() if str(key).strip()}
    return parsed or dict(fallback)


def _parse_model_aliases(
    raw: object,
    fallback: dict[str, dict[str, str]],
) -> dict[str, dict[str, str]]:
    if not isinstance(raw, dict):
        return dict(fallback)

    parsed: dict[str, dict[str, str]] = {}
    for make, mappings in raw.items():
        if not isinstance(mappings, dict):
            continue
        parsed[str(make)] = {str(key): str(value) for key, value in mappings.items()}
    return parsed or dict(fallback)


def get_app_data_dir() -> Path:
    base = Path.home() / "AppData" / "Local" / APP_FOLDER_NAME
    base.mkdir(parents=True, exist_ok=True)
    return base


def get_settings_path() -> Path:
    return get_app_data_dir() / "settings.json"


def default_settings() -> AuditSettings:
    return AuditSettings()


def load_settings() -> AuditSettings:
    path = get_settings_path()
    if not path.exists():
        settings = default_settings()
        save_settings(settings)
        return settings

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return AuditSettings.from_dict(data)
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        settings = default_settings()
        save_settings(settings)
        return settings


def save_settings(settings: AuditSettings) -> None:
    payload = {
        "version": SETTINGS_VERSION,
        **settings.to_dict(),
    }
    get_settings_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")


def reset_settings() -> AuditSettings:
    settings = default_settings()
    save_settings(settings)
    return settings


def clone_settings(settings: AuditSettings) -> AuditSettings:
    return AuditSettings.from_dict(deepcopy(settings.to_dict()))
