-- Extend notification types for centralized Notification Center
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'missing_wrap_up';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'forecast_risk';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'qa_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_changed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'department_alert';
