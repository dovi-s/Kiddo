-- Add event_category to events table to distinguish gifting occasions from savings goals
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_category text DEFAULT 'gifting_occasion';
UPDATE events SET event_category = 'gifting_occasion' WHERE event_category IS NULL;
