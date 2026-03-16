-- =============================================================
-- FIX: Add INSERT/UPDATE policies for all tables
-- Run this in Supabase SQL Editor
-- =============================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "users_own" ON users;
DROP POLICY IF EXISTS "patients_own" ON patients;
DROP POLICY IF EXISTS "medications_access" ON medications;
DROP POLICY IF EXISTS "schedules_access" ON medication_schedules;

-- ==================
-- USERS
-- ==================
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==================
-- LICENSES
-- ==================
CREATE POLICY "licenses_select" ON licenses
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "licenses_insert" ON licenses
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "licenses_update" ON licenses
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ==================
-- PATIENTS
-- ==================
CREATE POLICY "patients_select" ON patients
  FOR SELECT USING (
    user_id = auth.uid()
    OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    OR license_id IN (SELECT license_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "patients_insert" ON patients
  FOR INSERT WITH CHECK (
    license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
  );

CREATE POLICY "patients_update" ON patients
  FOR UPDATE USING (
    user_id = auth.uid()
    OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
  ) WITH CHECK (
    license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
  );

-- ==================
-- TEAM MEMBERS
-- ==================
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
  );

CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (
    license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
  );

-- ==================
-- MEDICATIONS
-- ==================
CREATE POLICY "medications_select" ON medications
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
        OR license_id IN (SELECT license_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "medications_insert" ON medications
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "medications_update" ON medications
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );

-- ==================
-- MEDICATION SCHEDULES
-- ==================
CREATE POLICY "schedules_select" ON medication_schedules
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
        OR license_id IN (SELECT license_id FROM team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "schedules_insert" ON medication_schedules
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "schedules_update" ON medication_schedules
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );

-- ==================
-- DAILY ROUTINES
-- ==================
CREATE POLICY "routines_select" ON daily_routines
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "routines_insert" ON daily_routines
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "routines_update" ON daily_routines
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM patients WHERE
        user_id = auth.uid()
        OR license_id IN (SELECT id FROM licenses WHERE owner_id = auth.uid())
    )
  );
