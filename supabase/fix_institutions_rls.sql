-- =============================================================
-- FIX: Allow institution registration (INSERT policy missing)
-- Run this in Supabase SQL Editor
-- =============================================================

-- Allow authenticated users to INSERT their own institution
CREATE POLICY "institutions_insert_own" ON public.institutions
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Verify
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'institutions';
