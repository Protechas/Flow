-- Batch submissions: analysts on long-running packages submit file batches
-- for QA review while the task stays workable. Additive and safe to apply
-- while the current build is live (existing rows default to 'final').

alter table task_submission_records
  add column if not exists submission_type text not null default 'final',
  add column if not exists file_ids jsonb;

comment on column task_submission_records.submission_type is
  'final = whole-task handoff that locks the task for QA; batch = in-progress file batch, task stays workable';
comment on column task_submission_records.file_ids is
  'task_file_uploads ids included in this submission (null for legacy rows)';

create index if not exists idx_task_submissions_open_batches
  on task_submission_records (task_id, submitted_at desc)
  where submission_type = 'batch' and status = 'submitted';
