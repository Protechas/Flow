"use server";

import { requireUser } from "@/lib/auth/session";
import { AI_MODELS, AI_DISABLED_MESSAGE, getAiClient, isAiEnabled } from "@/lib/ai/client";
import { capText } from "@/lib/ai/allowlist";
import { logAiUsage } from "@/lib/ai/usage";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { isActiveProject } from "@/lib/data/entity-filters";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import { getAnalysts } from "@/lib/data/projects";
import { getActiveDepartments } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { listEnterpriseTemplates } from "@/lib/templates/template-registry";
import { appTodayDate } from "@/lib/datetime/timezone";
import {
  createQuickTaskAction,
  updateWorkPackageAction,
} from "@/app/actions/crud";
import { createBulkMatrixProjectAction } from "@/app/actions/bulk-matrix-creation";
import { createProjectFromTemplateAction } from "@/app/actions/templates";
import {
  catalogPromptBlock,
  describeTaskBuilderDraft,
  parseTaskBuilderTurn,
  validateTaskBuilderDraft,
  TASK_BUILDER_MAX_TURNS,
  type TaskBuilderCatalog,
  type TaskBuilderDraft,
  type TaskBuilderMessage,
  type TaskBuilderTurn,
} from "@/lib/eddy/task-builder";

export interface TaskBuilderTurnResult {
  ok: boolean;
  turn: TaskBuilderTurn | null;
  previewLines?: string[];
  message?: string;
}

export interface TaskBuilderApproveResult {
  ok: boolean;
  createdTasks: number;
  projectId: string | null;
  message?: string;
}

const SYSTEM_PROMPT =
  "You are Eddy, Flow's assistant, helping a manager create work items by interview. " +
  "Flow organizes work as Project → Workstream (manufacturer) → Year → Task. " +
  "Your job: figure out what they need, then produce a DRAFT for human approval. You never create anything yourself.\n\n" +
  "Choose the SIMPLEST creation shape that fits:\n" +
  '- "quick_task": one task, into an existing project or a new one.\n' +
  '- "task_set": 2-30 related tasks in one project (different titles, assignees, or counts).\n' +
  '- "bulk_matrix": a NEW project generated from Makes × Years × Models (large repetitive grids).\n' +
  '- "from_template": a NEW project from an enterprise template listed below.\n\n' +
  "Bulk-matrix limits — check these BEFORE you promise a build, and tell the user up front if a request exceeds them (never collect every detail and fail at the end): a matrix generates makes × years × models tasks, up to 1000 total, with at most 75 makes and 20 years. If a request is too big, say so and offer to split it (e.g. by year range or make group). Note: forecast units per task (lines, files) do NOT add rows — 'one task per make, 500 lines each' is one row per make.\n\n" +
  "Interview rules:\n" +
  "- Ask ONE short question per turn, only about what you genuinely can't infer. 2-4 questions is typical; never more than 6.\n" +
  "- Offer concrete options from the catalog when asking (project names, analyst first names, templates).\n" +
  "- Tracking matters: for production work ask what a unit is (files, lines, VINs, ROs…), how many, and minutes per unit if they know it. " +
  "Ask whether finished work needs a file uploaded (filesRequired) and QA review (qaRequired) only when not obvious; sensible defaults are qaRequired=true, filesRequired=false.\n" +
  "- Use ONLY ids from the catalog. Refer to people by name in questions, but put their id in the draft. Never invent ids, names, or templates.\n" +
  "- Dates are YYYY-MM-DD. Relative dates resolve against today's date given below.\n\n" +
  "When you have enough to draft, reply with ONLY a JSON code block:\n" +
  '```json\n{"summary": "<one sentence of what will be created>", "draft": { "mode": "...", ... }}\n```\n' +
  "Draft field reference:\n" +
  '- quick_task: {mode, projectId | newProjectName, title, workstream?, year?, assigneeId?, estimatedUnits?, forecastUnit?, minutesPerUnit?, complexity? (simple|standard|complex|very_complex), priority? (low|medium|high|urgent), dueDate?, notes?, qaRequired?, filesRequired?}\n' +
  '- task_set: {mode, projectId | newProjectName, forecastUnit?, minutesPerUnit?, complexity?, priority?, qaRequired?, filesRequired?, tasks: [{title, workstream?, year?, assigneeId?, estimatedUnits?, dueDate?, notes?}]}\n' +
  '- bulk_matrix: {mode, name, departmentId, teamId, projectType?, matrixOrder? (make_year_model|year_make_model|make_year_task|custom), makes: [..], years: [..], models?: [..] | modelCountPerGroup?, docsPerTask?, qaRequired?, filesRequired?, priority?, complexity?, dueDate?, description?}\n' +
  '- from_template: {mode, templateId, name, departmentId, teamId, description?}';

async function buildCatalog(
  user: Awaited<ReturnType<typeof requireUser>>
): Promise<TaskBuilderCatalog> {
  await ensureAppDataLoaded();
  const store = getFlowStore();
  const branchIds = getScopeMemberIds(user, store.users, store.teams);

  let projects = store.projects.filter(isActiveProject);
  if (branchIds?.length) {
    const branchProjectIds = new Set(
      store.workPackages
        .filter((p) => p.assigned_to && branchIds.includes(p.assigned_to))
        .map((p) => p.project_id)
    );
    projects = projects.filter(
      (p) =>
        branchProjectIds.has(p.id) ||
        (user.team_id && p.team_id === user.team_id) ||
        p.project_owner_id === user.id ||
        p.created_by === user.id
    );
  }

  const workstreamsByProject = new Map<string, string[]>();
  for (const m of store.manufacturers) {
    if (m.is_archived) continue;
    const list = workstreamsByProject.get(m.project_id) ?? [];
    if (list.length < 8) list.push(m.name);
    workstreamsByProject.set(m.project_id, list);
  }

  const analystPool = await getAnalysts();
  const analysts = (branchIds?.length
    ? analystPool.filter((a) => branchIds.includes(a.id))
    : analystPool
  ).slice(0, 60);

  const forecastUnits = Array.from(
    new Set(
      store.workPackages
        .map((p) => p.forecast_unit)
        .filter((u): u is string => Boolean(u))
    )
  ).slice(0, 12);

  return {
    today: appTodayDate(),
    allowedModes: (() => {
      const modes = getAllowedCreationModes(user.role);
      const out: TaskBuilderCatalog["allowedModes"] = [];
      if (modes.includes("task")) out.push("quick_task", "task_set");
      if (modes.includes("project")) out.push("bulk_matrix", "from_template");
      return out;
    })(),
    projects: projects.slice(0, 40).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.project_type,
      workstreams: workstreamsByProject.get(p.id) ?? [],
    })),
    analysts: analysts.map((a) => ({ id: a.id, name: a.full_name })),
    departments: getActiveDepartments(
      filterDepartmentsForViewer(listDepartments(), user)
    ).map((d) => ({ id: d.id, name: d.name })),
    teams: listTeamsStore().map((t) => ({ id: t.id, name: t.name })),
    templates: listEnterpriseTemplates().slice(0, 20).map((t) => ({
      id: t.id,
      label: t.label,
      description: capText(t.description, 140),
      taskCount: t.tasks.length,
    })),
    forecastUnits: forecastUnits.length ? forecastUnits : ["files"],
  };
}

/** One interview turn. Explicit user action — the only spend point. */
export async function taskBuilderTurnAction(input: {
  messages: TaskBuilderMessage[];
}): Promise<TaskBuilderTurnResult> {
  const user = await requireUser();
  try {
    const catalog = await buildCatalog(user);
    if (!catalog.allowedModes.length) {
      return { ok: false, turn: null, message: "You don't have work-creation access." };
    }
    if (!isAiEnabled()) {
      return { ok: false, turn: null, message: AI_DISABLED_MESSAGE };
    }
    const history = input.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-TASK_BUILDER_MAX_TURNS)
      .map((m) => ({ role: m.role, content: capText(m.content, 3000) }));
    if (!history.length || history[history.length - 1].role !== "user") {
      return { ok: false, turn: null, message: "Say what you need first." };
    }

    const system = `${SYSTEM_PROMPT}\n\nThe user's name is ${
      user.full_name.split(" ")[0]
    }.\n\n=== CATALOG ===\n${catalogPromptBlock(catalog)}`;

    const client = await getAiClient();
    // Standard tier: multi-turn slot-filling into four strict schemas is
    // drafting work, not lookup — Haiku misfills would land in real projects.
    const response = await client!.messages.create({
      model: AI_MODELS.standard,
      max_tokens: 1500,
      system,
      messages: history,
    });

    await logAiUsage({
      feature: "eddy_task_builder",
      model: AI_MODELS.standard,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      userId: user.id,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const parsed = parseTaskBuilderTurn(text);

    if (parsed.kind === "question") {
      return {
        ok: true,
        turn: { type: "question", question: parsed.question || "Tell me more about the work." },
      };
    }

    const validation = validateTaskBuilderDraft(parsed.rawDraft, catalog);
    if (!validation.ok || !validation.draft) {
      // Deterministic bounce — no second AI call. The user's next answer
      // re-enters the loop with the problems visible to the model.
      return {
        ok: true,
        turn: {
          type: "question",
          question:
            "I almost have it, but I need to fix a few things:\n" +
            validation.errors.map((e) => `• ${e}`).join("\n") +
            "\nCan you clarify?",
        },
      };
    }

    return {
      ok: true,
      turn: {
        type: "draft",
        draft: validation.draft,
        summary: parsed.summary ?? undefined,
      },
      previewLines: describeTaskBuilderDraft(validation.draft, catalog),
    };
  } catch (e) {
    console.error("[eddy-task-builder] turn failed", e instanceof Error ? e.message : e);
    return { ok: false, turn: null, message: "Eddy hit a snag — try again." };
  }
}

/**
 * Execute an approved draft through the SAME actions the wizards use — each
 * carries its own permission checks, persistence, and audit trail.
 */
export async function approveTaskBuilderDraftAction(
  draft: TaskBuilderDraft
): Promise<TaskBuilderApproveResult> {
  const user = await requireUser();
  const catalog = await buildCatalog(user);
  const validation = validateTaskBuilderDraft(draft, catalog);
  if (!validation.ok || !validation.draft) {
    return {
      ok: false,
      createdTasks: 0,
      projectId: null,
      message: `Draft failed validation: ${validation.errors.join(" ")}`,
    };
  }
  const d = validation.draft;

  try {
    if (d.mode === "quick_task" || d.mode === "task_set") {
      const items = d.mode === "quick_task" ? [d] : d.tasks;
      let projectId = d.projectId ?? null;
      let created = 0;
      for (const item of items) {
        const task = await createQuickTaskAction({
          projectId,
          newProjectName: projectId ? null : d.newProjectName,
          manufacturerName: item.workstream ?? undefined,
          year: item.year ?? undefined,
          taskTitle: item.title,
          assignedTo: item.assigneeId ?? null,
          estimatedDocumentCount: item.estimatedUnits ?? null,
          complexityLevel: d.complexity ?? undefined,
          priority: d.priority ?? undefined,
          manualDueDate: item.dueDate ?? null,
          notes: item.notes ?? null,
          qaRequired: d.qaRequired ?? undefined,
          filesRequired: d.filesRequired ?? undefined,
        });
        projectId = task.project_id;
        created += 1;
        const unit = d.forecastUnit && d.forecastUnit !== "files" ? d.forecastUnit : null;
        if (unit || d.minutesPerUnit) {
          await updateWorkPackageAction(task.id, {
            ...(unit ? { forecast_unit: unit } : {}),
            ...(d.minutesPerUnit ? { estimated_minutes_per_document: d.minutesPerUnit } : {}),
          });
        }
      }
      await writeAuditLog({
        action: "project_changed",
        entityType: "project",
        entityId: projectId ?? "unknown",
        summary: `Eddy Task Builder: created ${created} task${created === 1 ? "" : "s"} (approved by ${user.full_name})`,
        metadata: { feature: "eddy_task_builder", mode: d.mode, tasks: created },
      });
      return { ok: true, createdTasks: created, projectId };
    }

    if (d.mode === "bulk_matrix") {
      const result = await createBulkMatrixProjectAction({
        name: d.name,
        departmentId: d.departmentId,
        teamId: d.teamId,
        projectType: d.projectType ?? "special_functions",
        description: d.description ?? null,
        priority: d.priority ?? undefined,
        complexity: d.complexity ?? undefined,
        manualDueDate: d.dueDate ?? null,
        matrixOrder: d.matrixOrder ?? "make_year_model",
        selectedMakes: d.makes,
        selectedYears: d.years,
        models: d.models ?? [],
        useModelCount: !d.models?.length,
        modelCountPerGroup: d.modelCountPerGroup ?? 1,
        docsPerTask: d.docsPerTask ?? 0,
        qaRequired: d.qaRequired ?? true,
        filesRequired: d.filesRequired ?? false,
      });
      await writeAuditLog({
        action: "project_changed",
        entityType: "project",
        entityId: result.project.id,
        summary: `Eddy Task Builder: bulk matrix project "${d.name}" with ${result.taskCount} tasks (approved by ${user.full_name})`,
        metadata: { feature: "eddy_task_builder", mode: d.mode, tasks: result.taskCount },
      });
      return { ok: true, createdTasks: result.taskCount, projectId: result.project.id };
    }

    const result = await createProjectFromTemplateAction({
      templateId: d.templateId,
      name: d.name,
      departmentId: d.departmentId,
      teamId: d.teamId,
      description: d.description ?? null,
    });
    if (!result.ok) {
      return { ok: false, createdTasks: 0, projectId: null, message: result.error };
    }
    await writeAuditLog({
      action: "project_changed",
      entityType: "project",
      entityId: result.projectId,
      summary: `Eddy Task Builder: project "${d.name}" from template (approved by ${user.full_name})`,
      metadata: { feature: "eddy_task_builder", mode: d.mode, templateId: d.templateId },
    });
    return { ok: true, createdTasks: 0, projectId: result.projectId };
  } catch (e) {
    console.error("[eddy-task-builder] approve failed", e instanceof Error ? e.message : e);
    return {
      ok: false,
      createdTasks: 0,
      projectId: null,
      message: e instanceof Error ? e.message : "Could not create the work.",
    };
  }
}
