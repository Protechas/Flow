import { getBoardTemplate } from "@/lib/work-creation/templates";

export interface CreationPreview {
  title: string;
  lines: { label: string; value: string }[];
  enabled: string[];
}

export function buildBoardPreview(input: {
  name: string;
  departmentName: string;
  templateId: string;
  description: string;
  qaRequired?: boolean;
  filesRequired?: boolean;
  firstTaskTitle?: string;
}): CreationPreview {
  const tpl = getBoardTemplate(input.templateId);
  const enabled = [
    "Operations board entry",
    "Department scoping",
    "Project & task container",
    "Reporting tracking",
  ];
  if (input.qaRequired ?? tpl.defaultQaRequired) enabled.push("QA pipeline");
  if (input.filesRequired ?? tpl.defaultFilesRequired) enabled.push("File upload requirements");
  if (input.firstTaskTitle?.trim()) enabled.push(`Starter task: ${input.firstTaskTitle.trim()}`);

  return {
    title: input.name || "New board",
    lines: [
      { label: "Type", value: "Operations board" },
      { label: "Template", value: tpl.label },
      { label: "Department", value: input.departmentName },
      { label: "Purpose", value: input.description || tpl.purpose },
      {
        label: "Tracking",
        value: [
          (input.qaRequired ?? tpl.defaultQaRequired) ? "QA on" : "QA optional",
          (input.filesRequired ?? tpl.defaultFilesRequired) ? "Files on" : "Files optional",
        ].join(" · "),
      },
    ],
    enabled,
  };
}
