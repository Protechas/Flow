import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * Read-only summary for Athena (Dusty's personal AI chief of staff).
 *
 * Auth: shared secret header `x-athena-key` matched against
 * ATHENA_INTEGRATION_KEY (unset = endpoint disabled). Scoped per person via
 * `email` — Athena only ever asks for the user its own account is granted.
 *
 * READ-ONLY BY CONSTRUCTION: this route runs SELECTs only. Athena has no
 * write path into Flow, by design and by Dusty's standing rule.
 */
export async function GET(request: Request) {
  const configuredKey = process.env.ATHENA_INTEGRATION_KEY;
  if (!configuredKey || !isAdminConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  const key = request.headers.get("x-athena-key");
  if (key !== configuredKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const email = new URL(request.url).searchParams.get("email")?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, full_name, role, is_active")
    .ilike("email", email)
    .maybeSingle();
  if (!user?.is_active) {
    return NextResponse.json({ error: "No active Flow user" }, { status: 404 });
  }

  const [todos, myTickets, activeTickets] = await Promise.all([
    supabase
      .from("user_todos")
      .select("title, status")
      .eq("user_id", user.id)
      .neq("status", "done")
      .limit(20),
    supabase
      .from("request_tickets")
      .select("title, status, created_at")
      .eq("requester_id", user.id)
      .not("status", "in", '("done","closed","cancelled")')
      .limit(20),
    // open queue visible to leadership roles only
    ["admin", "manager", "senior_manager"].includes(user.role)
      ? supabase
          .from("request_tickets")
          .select("title, status, created_at")
          .not("status", "in", '("done","closed","cancelled")')
          .order("created_at", { ascending: true })
          .limit(25)
      : Promise.resolve({ data: null }),
  ]);

  const now = Date.now();
  const aged = (activeTickets.data ?? []).filter(
    (t) => now - new Date(t.created_at).getTime() > 3 * 86400_000
  );

  return NextResponse.json({
    user: { name: user.full_name, role: user.role },
    todos_open: todos.data?.length ?? 0,
    todo_titles: (todos.data ?? []).slice(0, 5).map((t) => t.title),
    my_open_tickets: myTickets.data?.length ?? 0,
    team_queue:
      activeTickets.data === null
        ? null
        : {
            open: activeTickets.data.length,
            aged_3d: aged.length,
            oldest: activeTickets.data[0]?.title ?? null,
          },
  });
}
