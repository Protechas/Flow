import { redirect } from "next/navigation";

export default async function ValidationRunLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/qa-center/validation/runs/${id}`);
}
