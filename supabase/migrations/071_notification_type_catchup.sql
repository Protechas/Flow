-- The notification_type enum fell behind the TypeScript union — every type
-- added since early July failed to INSERT (deliverNotification logs and
-- swallows), so SOP publishes, request tickets, coaching, help flags, and
-- auto-clock-out alerts never reached anyone's bell. Catch the enum up.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workload_low';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workload_empty';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workload_needs_estimate';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workload_clocked_idle';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'help_flag_raised';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'help_flag_escalated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'help_flag_acknowledged';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'help_flag_resolved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'work_eligibility_alert';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'activity_gap';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'sop_updated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'side_session_heavy';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'request_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'request_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coaching_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'time_auto_clock_out';
