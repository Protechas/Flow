import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import type { QaDocumentValidation } from "@/lib/qa-center/types";
import { listDocumentValidations } from "@/lib/qa-center/validations/db";
import { listValidationFindings } from "@/lib/validation-center/findings";

export interface QaAnalystPerformanceRow {
  analystId: string;
  analystName: string;
  documentsValidated: number;
  avgQaScore: number | null;
  passRate: number | null;
  openIssues: number;
  validationFindings: number;
}

export async function computeAnalystPerformance(): Promise<QaAnalystPerformanceRow[]> {
  initFlowStore();
  const users = getFlowStore().users;
  const [validations, findings] = await Promise.all([
    listDocumentValidations(500),
    listValidationFindings(),
  ]);

  const byAnalyst = new Map<
    string,
    { docs: QaDocumentValidation[]; findingCount: number; openIssues: number }
  >();

  for (const v of validations) {
    const id = v.created_by ?? v.analyst_id;
    if (!id) continue;
    const entry = byAnalyst.get(id) ?? { docs: [], findingCount: 0, openIssues: 0 };
    entry.docs.push(v);
    entry.openIssues += v.issues.filter((i) => i.status === "open").length;
    byAnalyst.set(id, entry);
  }

  for (const f of findings) {
    const pkg = f.work_item_id
      ? getFlowStore().workPackages.find((p) => p.id === f.work_item_id)
      : null;
    const id = pkg?.assigned_to;
    if (!id) continue;
    const entry = byAnalyst.get(id) ?? { docs: [], findingCount: 0, openIssues: 0 };
    entry.findingCount += 1;
    byAnalyst.set(id, entry);
  }

  return [...byAnalyst.entries()]
    .map(([analystId, data]) => {
      const completed = data.docs.filter((d) => d.status === "completed");
      const scores = completed.map((d) => d.qa_score).filter((s): s is number => s != null);
      const passed = completed.filter((d) => d.verdict === "pass").length;
      return {
        analystId,
        analystName: users.find((u) => u.id === analystId)?.full_name ?? analystId.slice(0, 8),
        documentsValidated: completed.length,
        avgQaScore:
          scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : null,
        passRate:
          completed.length > 0 ? Math.round((passed / completed.length) * 1000) / 10 : null,
        openIssues: data.openIssues,
        validationFindings: data.findingCount,
      };
    })
    .filter((r) => r.documentsValidated > 0 || r.validationFindings > 0)
    .sort((a, b) => (b.avgQaScore ?? 0) - (a.avgQaScore ?? 0));
}
