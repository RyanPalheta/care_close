-- =============================================================
-- FIX: missing DELETE policies on medications + medication_schedules
-- Care Close — without these the app silently fails to delete meds
-- and edits that involve removing schedules.
-- =============================================================

BEGIN;

-- ============================================================
-- medications: DELETE policy
-- ============================================================
DROP POLICY IF EXISTS "medications_delete" ON public.medications;
CREATE POLICY "medications_delete" ON public.medications
  FOR DELETE
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM public.licenses l
          WHERE l.owner_id = auth.uid() OR l.assigned_to = auth.uid()
        )
        OR license_id IN (
          SELECT l.id FROM public.licenses l
          JOIN public.institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
        OR license_id IN (
          SELECT license_id FROM public.team_members WHERE user_id = auth.uid()
        )
    )
  );

-- ============================================================
-- medication_schedules: DELETE policy
-- ============================================================
DROP POLICY IF EXISTS "schedules_delete" ON public.medication_schedules;
CREATE POLICY "schedules_delete" ON public.medication_schedules
  FOR DELETE
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE
        user_id = auth.uid()
        OR license_id IN (
          SELECT l.id FROM public.licenses l
          WHERE l.owner_id = auth.uid() OR l.assigned_to = auth.uid()
        )
        OR license_id IN (
          SELECT l.id FROM public.licenses l
          JOIN public.institutions i ON i.id = l.institution_id
          WHERE i.owner_user_id = auth.uid()
        )
        OR license_id IN (
          SELECT license_id FROM public.team_members WHERE user_id = auth.uid()
        )
    )
  );

COMMIT;
