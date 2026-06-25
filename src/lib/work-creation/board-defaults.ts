import { getBoardTemplate } from "@/lib/work-creation/templates";
import type { Project } from "@/types/flow";

const BOARD_MARKER = "\n—\nboard:";

export interface BoardTaskDefaults {
  templateId: string;
  qaRequired: boolean;
  filesRequired: boolean;
  defaultWorkstream: string;
}

export function formatBoardDescription(
  purpose: string | null | undefined,
  settings: BoardTaskDefaults
): string {
  const human = [
    purpose?.trim() || null,
    settings.qaRequired ? "QA required" : null,
    settings.filesRequired ? "Files required" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const machine = `${settings.templateId};qa=${settings.qaRequired ? 1 : 0};files=${settings.filesRequired ? 1 : 0};ws=${encodeURIComponent(settings.defaultWorkstream)}`;
  return human ? `${human}${BOARD_MARKER}${machine}` : `${BOARD_MARKER.trimStart()}${machine}`;
}

function parseMachinePayload(payload: string): BoardTaskDefaults | null {
  const segments = payload.split(";");
  const templateId = segments[0]?.trim();
  if (!templateId) return null;

  const kv = Object.fromEntries(
    segments.slice(1).map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return [pair, ""];
      return [pair.slice(0, eq), pair.slice(eq + 1)];
    })
  );

  const tpl = getBoardTemplate(templateId);
  return {
    templateId: tpl.id,
    qaRequired: kv.qa === "1" || kv.qa === "true",
    filesRequired: kv.files === "1" || kv.files === "true",
    defaultWorkstream: kv.ws ? decodeURIComponent(kv.ws) : tpl.defaultWorkstream ?? "General",
  };
}

export function parseBoardTaskDefaults(project: Project): BoardTaskDefaults | null {
  if (project.project_type !== "board" && project.project_type !== "research") return null;

  const desc = project.description ?? "";
  const markerIdx = desc.indexOf(BOARD_MARKER);
  if (markerIdx >= 0) {
    const parsed = parseMachinePayload(desc.slice(markerIdx + BOARD_MARKER.length));
    if (parsed) return parsed;
  }

  const qaRequired = desc.includes("QA required") || !desc.includes("QA optional");
  const filesRequired = desc.includes("Files required");
  const tpl = getBoardTemplate("custom_board");
  return {
    templateId: tpl.id,
    qaRequired,
    filesRequired,
    defaultWorkstream: tpl.defaultWorkstream ?? "General",
  };
}

export function boardDescriptionPurpose(description: string | null | undefined): string {
  if (!description) return "";
  const markerIdx = description.indexOf(BOARD_MARKER);
  const visible = markerIdx >= 0 ? description.slice(0, markerIdx) : description;
  return visible.replace(/\s*·\s*QA required/g, "").replace(/\s*·\s*Files required/g, "").trim();
}
