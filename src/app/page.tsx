import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefaultRoute } from "@/lib/auth/permissions";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? getDefaultRoute(user.role) : "/login");
}
