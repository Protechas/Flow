-- Cosmetic unlocks earned through badges: avatar frame, wearable title,
-- and workspace accent color. All personal, all optional.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS flair_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color TEXT;
