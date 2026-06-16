-- Must run after 006_teamlead_role.sql (enum value commit)
UPDATE users SET role = 'teamlead' WHERE role = 'qa';
