const url = "https://juzjxgmwoybhzclguhjd.supabase.co";
const anon = "sb_publishable_8xOk1EbHQ_UEqP5aYTpG3A_SbSZ960h";

async function timed(label, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`${label}: ${Date.now() - start}ms`, result);
  } catch (e) {
    console.log(`${label}: ${Date.now() - start}ms ERROR`, e.message);
  }
}

await timed("health", async () => {
  const r = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: anon },
    signal: AbortSignal.timeout(8000),
  });
  return `${r.status} ${await r.text()}`;
});

await timed("settings", async () => {
  const r = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anon },
    signal: AbortSignal.timeout(8000),
  });
  return `${r.status} ${(await r.text()).slice(0, 120)}`;
});

await timed("password grant", async () => {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "wrongpassword123" }),
    signal: AbortSignal.timeout(8000),
  });
  return `${r.status} ${(await r.text()).slice(0, 120)}`;
});
