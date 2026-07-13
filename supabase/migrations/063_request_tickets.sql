-- Request tickets: "I need a doc for X" without the Teams shoulder-tap.
-- Anyone submits; the receiving team sees it live; first claim wins; the
-- whole lifecycle is tracked (who asked, who took it, how long it took).
CREATE TABLE IF NOT EXISTS request_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  details TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'done', 'canceled')),
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Set when a lead escalates the ticket into a real Flow task.
  linked_task_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  -- Task timer the claim paused, so finishing the ticket can resume it.
  paused_task_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_tickets_status
  ON request_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_tickets_requester
  ON request_tickets(requested_by, created_at DESC);

ALTER TABLE request_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY request_tickets_select ON request_tickets
  FOR SELECT TO authenticated
  USING (true);

-- Submit for yourself only.
CREATE POLICY request_tickets_insert ON request_tickets
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Claim/complete/cancel run through the app (service role); authenticated
-- updates are limited to rows the user is part of.
CREATE POLICY request_tickets_update ON request_tickets
  FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() OR claimed_by = auth.uid() OR status = 'open');
