-- Add timezone column to push_subscriptions so cron worker can format
-- notification times in the user's local timezone.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
