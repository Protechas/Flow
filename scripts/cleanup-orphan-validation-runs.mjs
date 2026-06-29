import pg from "pg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_DB_PASSWORD;
const poolerHost = process.env.SUPABASE_DB_POOLER_HOST;
const ref = url?.match(/https:\/\/([^.]+)/)?.[1];
if (!ref || !password || !poolerHost) {
  console.error("Missing Supabase DB env vars");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const res = await client.query(`
  DELETE FROM validation_runs r
  WHERE r.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM validation_jobs j WHERE j.run_id = r.id)
  RETURNING r.id, r.title
`);
console.log(`Removed ${res.rowCount} orphaned pending run(s)`);
for (const row of res.rows) {
  console.log(` - ${row.title ?? row.id}`);
}
await client.end();
