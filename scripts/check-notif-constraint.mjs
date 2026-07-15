// READ-ONLY: inspect the notifications.type constraint.
import pg from "pg";

const url = process.env.SUPABASE_DB_URL?.trim();
const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD;
const poolerHost = process.env.SUPABASE_DB_POOLER_HOST?.trim();
const client = new pg.Client({
  connectionString:
    url || `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const { rows } = await client.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'notifications'::regclass`
);
for (const r of rows) console.log(r.conname, "::", r.def.slice(0, 800));
const col = await client.query(
  `SELECT data_type, udt_name FROM information_schema.columns WHERE table_name='notifications' AND column_name='type'`
);
console.log("column:", JSON.stringify(col.rows));
const vals = await client.query(
  `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'notification_type'::regtype ORDER BY enumsortorder`
);
console.log("enum values:", vals.rows.map((r) => r.enumlabel).join(", "));
await client.end();
