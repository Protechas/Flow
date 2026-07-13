import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROD = "https://flowproduction.space";
const email = "zz.tmp.karl3@protech.test";
const password = `Tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const admin = createClient(url, service);

function visible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, "|");
}

let userId = null;
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) throw new Error(cErr.message);
  userId = created.user.id;
  await admin.from("users").upsert({
    id: userId, email, first_name: "ZZ", last_name: "Karl3", full_name: "ZZ Karl3",
    role: "admin", system_access_level: "admin", organizational_position: "manager",
    pay_type: "salary", is_active: true,
  });
  const client = createClient(url, anon);
  const { data: signin, error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(sErr.message);
  const ref = new URL(url).hostname.split(".")[0];
  const value = "base64-" + Buffer.from(JSON.stringify(signin.session)).toString("base64url");
  const cookies = [];
  if (value.length <= 3180) cookies.push(`sb-${ref}-auth-token=${value}`);
  else for (let i = 0; i * 3180 < value.length; i++)
    cookies.push(`sb-${ref}-auth-token.${i}=${value.slice(i * 3180, (i + 1) * 3180)}`);
  const cookieHeader = cookies.join("; ");

  for (const path of ["/people", "/planning", "/wrap-ups"]) {
    const res = await fetch(`${PROD}${path}`, { headers: { Cookie: cookieHeader } });
    const text = visible(await res.text());
    console.log(`${path}: status=${res.status} · Michael Karl visible: ${text.includes("Michael Karl")}`);
  }
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  if (userId) {
    await admin.from("users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log("temp user cleaned up");
}
