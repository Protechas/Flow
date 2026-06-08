-- Flow: Workforce productivity platform schema
-- Work tracking and reporting share the same tables

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'qa', 'analyst', 'viewer');
CREATE TYPE work_status AS ENUM (
  'not_started', 'assigned', 'working_on_it', 'waiting',
  'ready_for_qa', 'in_qa', 'correction_needed', 'stuck', 'done'
);
CREATE TYPE work_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE qa_status AS ENUM ('pending', 'passed', 'minor_correction', 'major_correction', 'rejected');
CREATE TYPE qa_result AS ENUM ('pass', 'minor_correction', 'major_correction', 'rejected');
CREATE TYPE notification_type AS ENUM (
  'assignment', 'status_change', 'qa_result', 'correction', 'overdue', 'mention'
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'analyst',
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teams ADD CONSTRAINT teams_manager_fk
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manufacturers (within projects)
CREATE TABLE manufacturers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work packages (leaf: Project → Manufacturer → Year → Work Package)
-- Table name work_items retained for migration compatibility
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status work_status NOT NULL DEFAULT 'not_started',
  priority work_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  start_date DATE,
  completed_date DATE,
  estimated_hours NUMERIC(8,2) DEFAULT 0,
  actual_hours NUMERIC(8,2) DEFAULT 0,
  qa_status qa_status NOT NULL DEFAULT 'pending',
  correction_count INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_assigned ON work_items(assigned_to);
CREATE INDEX idx_work_items_project ON work_items(project_id);
CREATE INDEX idx_work_items_due ON work_items(due_date);

-- Time logs
CREATE TABLE time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours NUMERIC(6,2) NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QA reviews
CREATE TABLE qa_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analyst_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result qa_result NOT NULL,
  error_category TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Corrections
CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  qa_review_id UUID REFERENCES qa_reviews(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Files
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance snapshots (auto-generated for reporting)
CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  hours_logged NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_completion_hours NUMERIC(8,2),
  qa_pass_rate NUMERIC(5,2),
  correction_count INTEGER NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2),
  stuck_count INTEGER NOT NULL DEFAULT 0,
  productivity_score NUMERIC(5,2),
  quality_score NUMERIC(5,2),
  flow_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER manufacturers_updated_at BEFORE UPDATE ON manufacturers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER work_items_updated_at BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sync actual_hours from time_logs
CREATE OR REPLACE FUNCTION sync_work_item_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_items SET actual_hours = (
    SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE work_item_id = COALESCE(NEW.work_item_id, OLD.work_item_id)
  ) WHERE id = COALESCE(NEW.work_item_id, OLD.work_item_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_logs_sync_hours AFTER INSERT OR UPDATE OR DELETE ON time_logs
  FOR EACH ROW EXECUTE FUNCTION sync_work_item_hours();

-- Auto-update performance snapshot on work item changes
CREATE OR REPLACE FUNCTION refresh_performance_snapshot(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_assigned INT;
  v_completed INT;
  v_hours NUMERIC;
  v_qa_pass NUMERIC;
  v_corrections INT;
  v_on_time NUMERIC;
  v_stuck INT;
  v_prod NUMERIC;
  v_qual NUMERIC;
  v_flow NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_assigned FROM work_items
    WHERE assigned_to = p_user_id AND status NOT IN ('done');

  SELECT COUNT(*) INTO v_completed FROM work_items
    WHERE assigned_to = p_user_id AND status = 'done'
    AND completed_date = CURRENT_DATE;

  SELECT COALESCE(SUM(hours), 0) INTO v_hours FROM time_logs
    WHERE user_id = p_user_id AND log_date = CURRENT_DATE;

  SELECT COALESCE(
    ROUND(100.0 * COUNT(*) FILTER (WHERE result = 'pass') / NULLIF(COUNT(*), 0), 2), 0
  ) INTO v_qa_pass FROM qa_reviews WHERE analyst_id = p_user_id
    AND reviewed_at::date = CURRENT_DATE;

  SELECT COALESCE(SUM(correction_count), 0) INTO v_corrections FROM work_items
    WHERE assigned_to = p_user_id;

  SELECT COALESCE(
    ROUND(100.0 * COUNT(*) FILTER (WHERE completed_date <= due_date) / NULLIF(COUNT(*), 0), 2), 0
  ) INTO v_on_time FROM work_items
    WHERE assigned_to = p_user_id AND status = 'done' AND due_date IS NOT NULL;

  SELECT COUNT(*) INTO v_stuck FROM work_items
    WHERE assigned_to = p_user_id AND status = 'stuck';

  v_prod := LEAST(100, (v_completed * 10) + (v_hours * 2));
  v_qual := COALESCE(v_qa_pass, 100) - (v_corrections * 2);
  v_flow := ROUND((v_prod * 0.5 + GREATEST(v_qual, 0) * 0.5), 2);

  INSERT INTO performance_snapshots (
    user_id, snapshot_date, assigned_count, completed_count, hours_logged,
    qa_pass_rate, correction_count, on_time_rate, stuck_count,
    productivity_score, quality_score, flow_score
  ) VALUES (
    p_user_id, CURRENT_DATE, v_assigned, v_completed, v_hours,
    v_qa_pass, v_corrections, v_on_time, v_stuck,
    v_prod, GREATEST(v_qual, 0), v_flow
  )
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    assigned_count = EXCLUDED.assigned_count,
    completed_count = EXCLUDED.completed_count,
    hours_logged = EXCLUDED.hours_logged,
    qa_pass_rate = EXCLUDED.qa_pass_rate,
    correction_count = EXCLUDED.correction_count,
    on_time_rate = EXCLUDED.on_time_rate,
    stuck_count = EXCLUDED.stuck_count,
    productivity_score = EXCLUDED.productivity_score,
    quality_score = EXCLUDED.quality_score,
    flow_score = EXCLUDED.flow_score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_refresh_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    PERFORM refresh_performance_snapshot(NEW.assigned_to);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND OLD.assigned_to IS NOT NULL THEN
    PERFORM refresh_performance_snapshot(OLD.assigned_to);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_items_snapshot AFTER INSERT OR UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_snapshot();

-- RLS (enable when using Supabase Auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Authenticated read work items" ON work_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update work items" ON work_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Managers insert work items" ON work_items FOR INSERT TO authenticated WITH CHECK (true);
