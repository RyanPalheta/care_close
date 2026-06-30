-- =============================================================
-- FIX: patients.user_id missing UNIQUE constraint
-- Care Close
-- =============================================================
-- Root cause of "Nenhum paciente cadastrado" for Hotmart buyers:
-- the webhook used upsert(onConflict:'user_id'), but patients had only a
-- primary key on `id` — no unique constraint on user_id. Postgres rejected
-- the upsert ("no unique or exclusion constraint matching the ON CONFLICT
-- specification"), the webhook didn't check the error, and the buyer ended
-- up with an active license but no patient record.
--
-- The webhook now does an exists-check + insert (doesn't need this constraint),
-- but we add it anyway to guarantee one patient row per user account.
-- Caregiver-created patients have user_id = NULL; Postgres UNIQUE allows
-- multiple NULLs, so those are unaffected.
-- =============================================================

BEGIN;

-- Safety: confirm there are no duplicate non-null user_ids before adding the
-- constraint. If this returns rows, resolve them manually before re-running.
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT user_id FROM public.patients
    WHERE user_id IS NOT NULL
    GROUP BY user_id HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot add unique constraint: % duplicate user_id(s) in patients. Resolve duplicates first.', dup_count;
  END IF;
END $$;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_user_id_key UNIQUE (user_id);

COMMIT;
