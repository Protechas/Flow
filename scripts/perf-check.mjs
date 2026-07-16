// Perf probe: time real authed page loads on production. Read-only except temp user.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const email = `perf-probe-${Date.now()}@flowtest.local`;
const password = "Perf-Probe-2026!x";

const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (cErr) throw cErr;
const uid = created.user.id;

const { error: uErr } = await admin.from("users").upsert({
  id: uid,
  email,
  full_name: "Perf Probe",
  role: "manager",
  organizational_position: "manager",
  system_access_level: "admin",
  is_active: true,
});
if (uErr) {
  await admin.auth.admin.deleteUser(uid);
  throw uErr;
}

try {
  const { data: signIn, error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;

  const session = signIn.session;
  const raw =
    "base64-" +
    Buffer.from(JSON.stringify(session)).toString("base64url");
  const chunks = [];
  for (let i = 0; i < raw.length; i += 3180) chunks.push(raw.slice(i, i + 3180));
  const cookie = chunks
    .map((c, i) => `sb-${ref}-auth-token.${i}=${c}`)
    .join("; ");

  const pages = ["/", "/operations", "/projects", "/people", "/requests", "/performance"];
  const base = process.env.PERF_BASE ?? "https://flowproduction.space";

  for (const round of ["cold", "warm", "warm2"]) {
    console.log(`\n=== round: ${round} ===`);
    for (const p of pages) {
      const t0 = Date.now();
      const res = await fetch(base + p, {
        headers: { cookie },
        redirect: "manual",
      });
      const body = await res.text();
      const ms = Date.now() - t0;
      const loc = res.headers.get("location");
      console.log(
        `${p.padEnd(14)} ${res.status}${loc ? " → " + loc : ""}  ${String(ms).padStart(6)}ms  ${(body.length / 1024).toFixed(0).padStart(5)}KB`
      );
    }
  }
} finally {
  await admin.from("users").delete().eq("id", uid);
  await admin.auth.admin.deleteUser(uid);
  console.log("\ntemp user deleted");
}
