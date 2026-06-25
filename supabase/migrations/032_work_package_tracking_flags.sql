-- Typed QA / file tracking flags on tasks (replaces notes-only prose)
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS qa_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS files_required BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_work_items_qa_required ON work_items(qa_required) WHERE qa_required = true;
CREATE INDEX IF NOT EXISTS idx_work_items_files_required ON work_items(files_required) WHERE files_required = true;

-- Backfill from legacy notes where present
UPDATE work_items
SET qa_required = false
WHERE notes IS NOT NULL AND notes ILIKE '%no qa%' AND qa_required = true;

UPDATE work_items
SET files_required = true
WHERE notes IS NOT NULL
  AND (notes ILIKE '%files required%' OR notes ILIKE '%file uploads required%')
  AND files_required = false;
