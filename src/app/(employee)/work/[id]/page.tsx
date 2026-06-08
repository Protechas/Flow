import { EmployeeTaskWorkspace } from "@/components/employee/employee-task-workspace";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getEmployeeTaskForUser } from "@/lib/employee/tasks";
import { requirePageAccess } from "@/lib/auth/guard";
import { redirect } from "next/navigation";

export default async function EmployeeTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autostart?: string }>;
}) {
  const user = await requirePageAccess("/work");
  const { id } = await params;
  const { autostart } = await searchParams;

  const task = await getEmployeeTaskForUser(user.id, id);
  if (!task) {
    redirect("/work");
  }

  initFlowStore();
  const store = getFlowStore();

  return (
    <EmployeeTaskWorkspace
      task={task}
      comments={store.comments}
      files={store.files}
      timeLogs={store.timeLogs}
      userId={user.id}
      autostart={autostart === "1"}
    />
  );
}
