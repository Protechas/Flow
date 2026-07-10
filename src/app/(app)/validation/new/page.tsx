import { redirect } from "next/navigation";

/** Legacy Validation Center path — the canonical tree lives under /qa-center. */
export default function ValidationLegacyRedirect() {
  redirect("/qa-center/validation/new");
}
