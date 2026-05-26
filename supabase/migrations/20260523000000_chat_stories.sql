-- Add progress tracking for tap-to-reveal chat stories
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS unlocked_till_index INTEGER NOT NULL DEFAULT 5;
