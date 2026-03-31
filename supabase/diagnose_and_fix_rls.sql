-- =============================================================
-- DIAGNOSE & FIX: Login / Profile issues (v2 - corrected)
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================================

-- ============ STEP 1: DIAGNOSE ============

-- 1a) Check if RLS is enabled on the users table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'users';

-- 1b) List ALL current RLS policies on the users table
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users';

-- 1c) Check if the user ryanteste@gmail.com exists in auth.users
SELECT id, email, created_at
FROM auth.users
WHERE email = 'ryanteste@gmail.com';

-- 1d) Check if a profile row exists in public.users for that user
SELECT u.id, u.name, u.role
FROM public.users u
JOIN auth.users a ON a.id = u.id
WHERE a.email = 'ryanteste@gmail.com';


-- ============ STEP 2: FIX RLS POLICIES ON USERS ============

-- Drop ALL existing policies on users to start clean
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Recreate clean policies
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ============ STEP 3: FIX PATIENTS INSERT POLICY ============
-- The old policy only allowed insert via license_id (which is NULL on self-signup)
-- Fix: also allow insert when user_id = auth.uid()

DROP POLICY IF EXISTS "patients_insert" ON patients;

CREATE POLICY "patients_insert" ON patients
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR license_id IN (
      SELECT l.id FROM licenses l
      JOIN institutions i ON i.id = l.institution_id
      WHERE i.owner_user_id = auth.uid()
    )
  );


-- ============ STEP 4: ALSO FIX OTHER POLICIES THAT REFERENCE owner_id ============
-- (These used 'owner_id' which doesn't exist on licenses — should go through institutions)

-- Fix patients_select
DROP POLICY IF EXISTS "patients_select" ON patients;
CREATE POLICY "patients_select" ON patients
  FOR SELECT USING (
    user_id = auth.uid()
    OR license_id IN (
      SELECT l.id FROM licenses l
      JOIN institutions i ON i.id = l.institution_id
      WHERE i.owner_user_id = auth.uid()
    )
    OR license_id IN (SELECT license_id FROM team_members WHERE user_id = auth.uid())
  );

-- Fix patients_update
DROP POLICY IF EXISTS "patients_update" ON patients;
CREATE POLICY "patients_update" ON patients
  FOR UPDATE USING (
    user_id = auth.uid()
    OR license_id IN (
      SELECT l.id FROM licenses l
      JOIN institutions i ON i.id = l.institution_id
      WHERE i.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid()
    OR license_id IN (
      SELECT l.id FROM licenses l
      JOIN institutions i ON i.id = l.institution_id
      WHERE i.owner_user_id = auth.uid()
    )
  );

-- Fix medications policies
DROP POLICY IF EXISTS "medications_select" ON medications;
CREATE POLICY "medications_select" ON medications
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
        OR license_id IN (SELECT license_id FROM team_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "medications_insert" ON medications;
CREATE POLICY "medications_insert" ON medications
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "medications_update" ON medications;
CREATE POLICY "medications_update" ON medications
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

-- Fix medication_schedules policies
DROP POLICY IF EXISTS "schedules_select" ON medication_schedules;
CREATE POLICY "schedules_select" ON medication_schedules
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
        OR license_id IN (SELECT license_id FROM team_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "schedules_insert" ON medication_schedules;
CREATE POLICY "schedules_insert" ON medication_schedules
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "schedules_update" ON medication_schedules;
CREATE POLICY "schedules_update" ON medication_schedules
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

-- Fix daily_routines policies
DROP POLICY IF EXISTS "routines_select" ON daily_routines;
CREATE POLICY "routines_select" ON daily_routines
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "routines_insert" ON daily_routines;
CREATE POLICY "routines_insert" ON daily_routines
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "routines_update" ON daily_routines;
CREATE POLICY "routines_update" ON daily_routines
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM licenses l
          JOIN institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
    )
  );

-- Fix team_members policies
DROP POLICY IF EXISTS "team_members_select" ON team_members;
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR license_id IN (
      SELECT l.id FROM licenses l
      JOIN institutions i ON i.id = l.institution_id
      WHERE i.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team_members_insert" ON team_members;
CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (
    license_id IN (
      SELECT l.id FROM licenses l
      JOIN institutions i ON i.id = l.institution_id
      WHERE i.owner_user_id = auth.uid()
    )
  );


-- ============ STEP 5: VERIFY ============
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public';

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'patients' AND schemaname = 'public';
