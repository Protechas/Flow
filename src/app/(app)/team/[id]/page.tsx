import { redirect } from "next/navigation";
import { requireHierarchyUserAccess } from "@/lib/auth/guard";

export default async function TeamMemberRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireHierarchyUserAccess(id);
  redirect(`/people/${id}`);
}
