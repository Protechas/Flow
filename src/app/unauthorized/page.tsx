import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefaultRoute } from "@/lib/auth/permissions";

export default async function UnauthorizedPage() {
  const user = await getCurrentUser();
  const home = user ? getDefaultRoute(user.role) : "/login";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground text-sm">
          You do not have access to this item. Contact an administrator if you
          believe this is an error.
        </p>
        <Button render={<Link href={home} />}>Go to your home</Button>
      </div>
    </div>
  );
}
