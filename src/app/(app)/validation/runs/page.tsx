import { redirect } from "next/navigation";

export default function ValidationRunsLegacyRedirect() {
  redirect("/qa-center/validation/runs");
}
