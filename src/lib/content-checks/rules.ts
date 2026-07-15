/**
 * Content-check rules distilled from the owner's SOPs:
 * - SI Library Component SOP 06-2026 (format: naming, size, orientation, highlights)
 * - SI Content SOP 07-2022 (required content per doc)
 * - SME Safety System Acronym Definitions 1-30-25
 * - Combined ID³ Map workbook (pre-qual canon, cal types, feature→component map)
 *
 * These are the DEFAULTS. They will become a DB-backed rules table with an
 * editor in QA Center settings; check results always record the rules they
 * ran against so history is never silently re-graded.
 */

export interface ContentCheckRules {
  /** Component SOP: "All SI Documents must be under 1400KB file size." */
  maxFileKb: number;
  /** Component SOP: "All SI Documents are to be saved in landscape orientation." */
  requireLandscape: boolean;
  /** Component-era acronyms (06-2026 conversion). */
  components: string[];
  /** Feature-era acronyms still present in the library pre-conversion. */
  legacyFeatures: string[];
  /** Safety-system / special-function acronyms (SME definitions 1-30-25). */
  specialFunctions: string[];
  /** EV nomenclature allowed in brackets. */
  evNomenclature: string[];
  /** Makes must be spelled out — these shorthands flag. */
  makeShorthands: Record<string, string>;
  /** Canonical pre-qualification phrases (highlighted YELLOW per SOP). */
  prequalKeywords: string[];
  /** Conditions-of-calibration keywords (highlighted LIGHT BLUE per SOP). */
  conditionKeywords: string[];
  /** Earliest valid model year (SI Library covers 2012–current). */
  minYear: number;
  /** Component SOP: every model needs a variant of each of these (SI or
   * placeholder). Honda adds LW. */
  requiredComponentSet: string[];
  /** Extra required components by make (lowercased make word). */
  requiredExtrasByMake: Record<string, string[]>;
  /** 06-2026 Feature→Component conversion: a legacy feature doc satisfies its
   * parent component's slot. */
  featureToComponent: Record<string, string>;
}

export const DEFAULT_CONTENT_RULES: ContentCheckRules = {
  maxFileKb: 1400,
  requireLandscape: true,
  components: ["FRS", "WSC", "PDS", "BUC", "SVC", "RRS", "NV", "LW"],
  legacyFeatures: [
    "ACC", "ACC 1", "ACC 2", "ACC 3",
    "AEB", "AEB 1", "AEB 2", "AEB 3",
    "BSW/RCTW", "BSW-RCTW", "BSW/RCTW 1", "BSW/RCTW 2", "BSW/RCTW 3",
    "LKA", "LKA 1", "LKA 2",
    "APA", "AHL", "HUD", "NV", "SVC", "BUC",
  ],
  specialFunctions: [
    "SAS", "YAW", "G-FORCE", "OCS", "SWS", "ESC", "SRS D&E", "SCI", "SRR",
    "HLI", "TPMS", "SBI", "EBDE", "HDE", "LGR", "PSI", "WRL",
    "PCM", "TRANS", "AIR", "ABS", "BCM", "KEY", "FOB", "HVAC", "COOL", "HEAD",
  ],
  evNomenclature: ["EV", "BEV", "HEV", "PHEV", "FCEV"],
  makeShorthands: {
    chevy: "Chevrolet",
    vw: "Volkswagen",
    benz: "Mercedes-Benz",
    mb: "Mercedes-Benz",
    lr: "Land Rover",
    rr: "Rolls-Royce",
  },
  prequalKeywords: [
    "fuel tank",
    "full fuel",
    "cargo",
    "passenger area",
    "ride height",
    "wheel alignment",
    "bumper",
    "washer fluid",
    "coolant",
  ],
  conditionKeywords: [
    "calibration is required",
    "calibration must be performed",
    "when to calibrate",
    "after replacement",
    "after removal",
    "alignment",
    "windshield",
    "collision",
    "dtc",
  ],
  minYear: 2012,
  requiredComponentSet: ["FRS", "WSC", "PDS", "BUC", "SVC", "RRS", "NV"],
  requiredExtrasByMake: { honda: ["LW"] },
  featureToComponent: {
    // Component SOP 06-2026: "ACC (1) & AEB (1) are now both covered by (FRS)";
    // dominant-component rule for multi-hardware features.
    ACC: "FRS",
    "ACC 1": "FRS",
    "ACC 2": "FRS",
    "ACC 3": "WSC",
    AEB: "FRS",
    "AEB 1": "FRS",
    "AEB 2": "FRS",
    "AEB 3": "WSC",
    LKA: "WSC",
    "LKA 1": "WSC",
    "LKA 2": "BUC",
    "BSW/RCTW": "RRS",
    "BSW/RCTW 1": "RRS",
    "BSW/RCTW 2": "RRS",
    "BSW/RCTW 3": "BUC",
    "BSW 1": "RRS",
    "BSW 2": "RRS",
    "BSW 3": "BUC",
    APA: "PDS",
    "APA 1": "PDS",
    BUC: "BUC",
    SVC: "SVC",
    "SVC 1": "SVC",
    NV: "NV",
    WSC: "WSC",
  },
};
