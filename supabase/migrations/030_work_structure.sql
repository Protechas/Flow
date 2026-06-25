-- Year/phase rows and work-item linkage for production task persistence

CREATE TABLE IF NOT EXISTS year_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status work_status NOT NULL DEFAULT 'not_started',
  priority work_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  estimated_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  actual_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manufacturer_id, year)
);

CREATE INDEX IF NOT EXISTS idx_year_work_items_project ON year_work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_year_work_items_manufacturer ON year_work_items(manufacturer_id);

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS year_work_item_id UUID REFERENCES year_work_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_year_work_item ON work_items(year_work_item_id);

ALTER TABLE year_work_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read year work items" ON year_work_items;
CREATE POLICY "Authenticated read year work items"
  ON year_work_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write year work items" ON year_work_items;
CREATE POLICY "Authenticated write year work items"
  ON year_work_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
