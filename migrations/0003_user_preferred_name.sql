-- Add preferred_name to users table (e.g. "Dad", "Mom", "Grandpa")
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_name varchar(50);
