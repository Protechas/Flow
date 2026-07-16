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
  /** Spelled-out makes — used to detect wrong-vehicle content (a doc claiming
   * Acura whose text talks about Toyota). */
  knownMakes: string[];
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
  components: ["FRS", "WSC", "PDS", "BUC", "SVC", "RRS", "NV", "WSR", "LW", "WAMC"],
  legacyFeatures: [
    // From the "Acronyms Comp. & Feat." sheet of the Combined ID³ workbook —
    // base acronyms cover any numbered variant via the base-token fallback.
    "ACC", "ACC 1", "ACC 2", "ACC 3", "ACC 4",
    "AEB", "AEB 1", "AEB 2", "AEB 3", "AEB 4",
    "BSW", "BSW 1", "BSW 2", "BSW 3", "BSW 4",
    "BSW/RCTW", "BSW-RCTW", "BSW/RCTW 1", "BSW/RCTW 2", "BSW/RCTW 3",
    "LKA", "LKA 1", "LKA 2",
    "APA", "APA 1", "APA 2",
    "NV 1", "NV 2",
    "SVC 1", "SVC 2", "SVC 3", "SVC 4",
    "WAMC", "AHL", "HUD", "NV", "SVC", "BUC",
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
  // Component SOP: "8 rows per Year, Make, Model (9 for Honda & 2023+
  // Subaru)" — the 8th is WSR (windshield radar/lidar) per the ID³ workbook.
  requiredComponentSet: ["FRS", "WSC", "PDS", "BUC", "SVC", "RRS", "NV", "WSR"],
  requiredExtrasByMake: { honda: ["LW"], subaru: ["WAMC"] },
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
    "ACC 4": "WSR",
    "AEB 4": "WSR",
    "BSW 4": "SVC",
    APA: "PDS",
    "APA 1": "PDS",
    "APA 2": "PDS",
    BUC: "BUC",
    SVC: "SVC",
    "SVC 1": "SVC",
    "SVC 2": "SVC",
    "SVC 3": "SVC",
    "SVC 4": "SVC",
    NV: "NV",
    "NV 1": "NV",
    "NV 2": "NV",
    WSC: "WSC",
    WAMC: "WAMC",
    LW: "LW",
  },
  knownMakes: [
    "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet",
    "Chrysler", "Dodge", "Fiat", "Ford", "Genesis", "GMC", "Honda", "Hyundai",
    "Infiniti", "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln",
    "Mazda", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Porsche",
    "Ram", "Rivian", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo",
  ],
};
