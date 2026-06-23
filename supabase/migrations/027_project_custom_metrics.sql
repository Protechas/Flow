-- Custom project metrics (definitions + value history)
CREATE TABLE IF NOT EXISTS public.project_metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_description TEXT,
  metric_type TEXT NOT NULL CHECK (
    metric_type IN ('number', 'percentage', 'currency', 'hours', 'boolean', 'status', 'calculated')
  ),
  target_value NUMERIC,
  current_value TEXT,
  display_style TEXT NOT NULL DEFAULT 'metric_card' CHECK (
    display_style IN (
      'metric_card',
      'progress_bar',
      'percentage_ring',
      'status_badge',
      'target_vs_actual',
      'trend_line',
      'kpi_tile'
    )
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_formula BOOLEAN NOT NULL DEFAULT false,
  formula_definition JSONB,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_metric_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id UUID NOT NULL REFERENCES public.project_metric_definitions(id) ON DELETE CASCADE,
  current_value TEXT NOT NULL,
  previous_value TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_metric_definitions_project
  ON public.project_metric_definitions(project_id, sort_order)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_project_metric_values_definition
  ON public.project_metric_values(metric_definition_id, updated_at DESC);

ALTER TABLE public.project_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_metric_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_metric_definitions_read ON public.project_metric_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY project_metric_definitions_write ON public.project_metric_definitions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY project_metric_values_read ON public.project_metric_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY project_metric_values_write ON public.project_metric_values
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
