import type { WrapUpReviewRow } from "@/types/flow";

export function exportWrapUpRowsCsv(rows: WrapUpReviewRow[]): string {
  const header = [
    "Employee",
    "Department",
    "Team",
    "Date",
    "Submitted",
    "Clock Out",
    "Status",
    "Blockers",
    "Reviewed",
    "Reviewed By",
    "Follow-up",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.employeeName,
      r.departmentName,
      r.teamName ?? "",
      r.wrapDate,
      r.submittedAt ?? "",
      r.clockOutStatus,
      r.wrapUpStatus,
      (r.blockersPreview ?? "").replace(/,/g, ";"),
      r.reviewed ? "Yes" : "No",
      r.reviewedByName ?? "",
      r.followUpNeeded ? "Yes" : "No",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
