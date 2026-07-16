-- Content checks, QA-side door: automatic free-layer checks run on task
-- submission (Next after(), so submit stays instant) and store one row per
-- uploaded file. Tara's Review Queue reads these for badges and
-- flagged-first ordering. Eddy AI reviews (manual, paid) can attach later.
create table if not exists document_content_reviews (
  id uuid primary key default gen_random_uuid(),
  file_id text not null unique,
  task_id text not null,
  project_id text,
  uploader_id text,
  file_name text not null,
  verdict text not null check (verdict in ('pass', 'flagged', 'unreadable')),
  flags jsonb not null default '[]'::jsonb,
  is_placeholder boolean not null default false,
  source text not null default 'auto',
  eddy jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_dcr_task on document_content_reviews (task_id);
create index if not exists idx_dcr_verdict on document_content_reviews (verdict);
