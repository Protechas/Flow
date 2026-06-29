import type { SiLibraryAuditSettings } from "@/lib/validation-center/types";

/** Default SI Library audit settings — mirrors Python AuditSettings defaults. */
export const DEFAULT_SI_LIBRARY_AUDIT_SETTINGS: SiLibraryAuditSettings = {
  filename_translation_rules: [],
  split_file_patterns: [
    "Night Vision [NV]",
    "Backup Camera [BUC]",
    "Front Radar Sensor [FRS]",
    "Rear Radar Sensor [RRS]",
    "Windshield Camera [WSC]",
    "Surround View Camera [SVC]",
    "Park Distance Sensor [PDS]",
  ],
  placeholder_mappings: [],
  placeholder_filenames: {
    NV: "No Night Vision [NV] - (NV) For This Vehicle.pdf",
    BUC: "No Backup Camera [BUC] - (BUC) For This Vehicle.pdf",
    ACC: "No Front Radar Sensor [FRS] - (ACC) For This Vehicle.pdf",
    AEB: "No Front Radar Sensor [FRS] - (AEB) For This Vehicle.pdf",
    BSW: "No Rear Radar Sensor [RRS] - (BSW) For This Vehicle.pdf",
    LKA: "No Windshield Camera [WSC] - (LKA) For This Vehicle.pdf",
    SVC: "No Surround View Camera [SVC] - (SVC) For This Vehicle.pdf",
    APA: "No Park Distance Sensor [PDS] - (APA) For This Vehicle.pdf",
  },
  model_aliases: {
    Chevrolet: {
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
  },
  compliance_threshold_excellent: 90,
  compliance_threshold_acceptable: 70,
  similarity_threshold: 0.55,
};
