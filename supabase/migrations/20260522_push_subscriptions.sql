-- =============================================================
-- MIGRATION: Web Push Notifications
-- Care Close — Persistent push subscription storage for medication reminders
-- =============================================================
-- IMPORTANTE: Rode este script INTEIRO no SQL Editor do Supabase
-- =============================================================

BEGIN;

-- ============================================================
-- STEP 1: Criar tabela de push subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  lead_minutes INT NOT NULL DEFAULT 5,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- ============================================================
-- STEP 2: Coluna para evitar notificações duplicadas
-- ============================================================
ALTER TABLE public.medication_schedules
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_med_sched_pending_notif
  ON public.medication_schedules(scheduled_time)
  WHERE status = 'pending' AND notification_sent_at IS NULL;

-- ============================================================
-- STEP 3: RLS — cada usuário só vê/edita suas subscriptions
-- ============================================================
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_subs" ON public.push_subscriptions;
CREATE POLICY "users_manage_own_subs"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypassa RLS (cron worker precisa ler tudo)
DROP POLICY IF EXISTS "service_role_full_access" ON public.push_subscriptions;
CREATE POLICY "service_role_full_access"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- STEP 4: Trigger pra atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_push_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_push_subs ON public.push_subscriptions;
CREATE TRIGGER trg_touch_push_subs
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_push_subscriptions();

COMMIT;
