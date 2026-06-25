import { describe, expect, it } from "vitest";
import {
  boardDescriptionPurpose,
  formatBoardDescription,
  parseBoardTaskDefaults,
} from "@/lib/work-creation/board-defaults";
import type { Project } from "@/types/flow";

function boardProject(description: string | null): Project {
  return {
    id: "proj-1",
    name: "QA Queue",
    description,
    project_type: "board",
    status: "active",
    priority: "medium",
    created_at: "",
    updated_at: "",
  };
}

describe("board-defaults", () => {
  it("round-trips tracking settings in description", () => {
    const formatted = formatBoardDescription("Team QA queue", {
      templateId: "qa_review_board",
      qaRequired: true,
      filesRequired: false,
      defaultWorkstream: "QA Queue",
    });

    const parsed = parseBoardTaskDefaults(boardProject(formatted));
    expect(parsed).toMatchObject({
      templateId: "qa_review_board",
      qaRequired: true,
      filesRequired: false,
      defaultWorkstream: "QA Queue",
    });
    expect(boardDescriptionPurpose(formatted)).toBe("Team QA queue");
  });

  it("parses legacy human-only board descriptions", () => {
    const parsed = parseBoardTaskDefaults(
      boardProject("ADAS backlog · QA required · Files required")
    );
    expect(parsed?.qaRequired).toBe(true);
    expect(parsed?.filesRequired).toBe(true);
  });

  it("returns null for non-board projects", () => {
    expect(
      parseBoardTaskDefaults({
        ...boardProject("x"),
        project_type: "custom",
      })
    ).toBeNull();
  });
});
