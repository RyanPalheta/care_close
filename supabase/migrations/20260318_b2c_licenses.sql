-- =============================================================
-- MIGRATION: B2C License System
-- Care Close — Modelo direto ao consumidor
-- =============================================================
-- IMPORTANTE: Rode este script INTEIRO no SQL Editor do Supabase
-- =============================================================

BEGIN;

-- ============================================================
-- STEP 1: Adicionar colunas B2C na tabela licenses
-- ============================================================

-- owner_id: quem comprou a licenca
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- license_type: cuidador ou paciente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = 'license_type'
  ) THEN
    ALTER TABLE public.licenses ADD COLUMN license_type text DEFAULT 'paciente';
    ALTER TABLE public.licenses ADD CONSTRAINT licenses_type_check
      CHECK (license_type IN ('cuidador', 'paciente'));
  END IF;
END $$;

-- max_patients: limite de pacientes
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS max_patients int NOT NULL DEFAULT 1;

-- max_members: limite de convidados (so para paciente)
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS max_members int NOT NULL DEFAULT 5;

-- hotmart_transaction_id: ID da transacao na Hotmart
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS hotmart_transaction_id text;

-- purchased_at: quando foi comprada
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz;

-- ============================================================
-- STEP 2: Migrar dados existentes
-- ============================================================

-- Setar owner_id = assigned_to para licencas existentes
UPDATE public.licenses
SET owner_id = assigned_to
WHERE assigned_to IS NOT NULL AND owner_id IS NULL;

-- Determinar license_type baseado no role do usuario
UPDATE public.licenses l
SET license_type = CASE
  WHEN u.role = 'caregiver' THEN 'cuidador'
  ELSE 'paciente'
END,
max_patients = CASE
  WHEN u.role = 'caregiver' THEN 10
  ELSE 1
END,
max_members = CASE
  WHEN u.role = 'caregiver' THEN 0
  ELSE 5
END
FROM public.users u
WHERE u.id = l.owner_id;

-- ============================================================
-- STEP 3: Criar tabela INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    invite_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    invited_by uuid NOT NULL REFERENCES auth.users(id),
    accepted_by uuid REFERENCES auth.users(id),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at timestamptz DEFAULT now(),
    accepted_at timestamptz
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Criar tabela CONTACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    added_by uuid NOT NULL REFERENCES auth.users(id),
    name text NOT NULL,
    email text,
    phone text,
    relationship text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: Reescrever RLS Policies
-- ============================================================

-- ----- LICENSES -----
-- Drop existing policies
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'licenses' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.licenses', pol.policyname);
  END LOOP;
END $$;

-- Owner pode ver sua propria licenca
CREATE POLICY "license_owner_select" ON public.licenses
  FOR SELECT USING (owner_id = auth.uid() OR assigned_to = auth.uid());

-- Owner pode atualizar
CREATE POLICY "license_owner_update" ON public.licenses
  FOR UPDATE USING (owner_id = auth.uid());

-- Insert: apenas via webhook/admin (service role), mas permitir para o proprio usuario
CREATE POLICY "license_insert" ON public.licenses
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ----- INVITES -----
-- Criador pode fazer tudo com seus convites
CREATE POLICY "invites_owner_all" ON public.invites
  FOR ALL USING (
    invited_by = auth.uid()
    OR license_id IN (SELECT id FROM public.licenses WHERE owner_id = auth.uid())
  );

-- Convidado pode ver convites destinados a ele
CREATE POLICY "invites_recipient_select" ON public.invites
  FOR SELECT USING (accepted_by = auth.uid());

-- Qualquer usuario autenticado pode aceitar um convite (via token)
CREATE POLICY "invites_accept" ON public.invites
  FOR UPDATE USING (status = 'pending')
  WITH CHECK (accepted_by = auth.uid());

-- ----- CONTACTS -----
CREATE POLICY "contacts_owner" ON public.contacts
  FOR ALL USING (
    added_by = auth.uid()
    OR patient_id IN (
      SELECT p.id FROM public.patients p
      JOIN public.licenses l ON l.id = p.license_id
      WHERE l.owner_id = auth.uid()
    )
  );

-- ----- PATIENTS -----
-- Drop existing and recreate with invite support
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patients' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.patients', pol.policyname);
  END LOOP;
END $$;

-- Paciente pode ver seus proprios dados, owner da licenca, ou membro convidado
CREATE POLICY "patients_select" ON public.patients
  FOR SELECT USING (
    user_id = auth.uid()
    OR license_id IN (SELECT id FROM public.licenses WHERE owner_id = auth.uid())
    OR license_id IN (
      SELECT license_id FROM public.invites
      WHERE accepted_by = auth.uid() AND status = 'accepted'
    )
  );

-- Inserir paciente: owner da licenca ou o proprio usuario
CREATE POLICY "patients_insert" ON public.patients
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR license_id IN (SELECT id FROM public.licenses WHERE owner_id = auth.uid())
  );

-- Atualizar paciente: owner da licenca, o proprio, ou convidado aceito
CREATE POLICY "patients_update" ON public.patients
  FOR UPDATE USING (
    user_id = auth.uid()
    OR license_id IN (SELECT id FROM public.licenses WHERE owner_id = auth.uid())
    OR license_id IN (
      SELECT license_id FROM public.invites
      WHERE accepted_by = auth.uid() AND status = 'accepted'
    )
  );

-- ----- USERS -----
-- Manter policies existentes (select/insert/update own)
-- Nao precisa mudar

-- ============================================================
-- STEP 6: Funcao auxiliar para buscar convite por token
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_license RECORD;
  v_current_members int;
BEGIN
  -- Buscar o convite
  SELECT * INTO v_invite FROM public.invites
  WHERE invite_token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Convite não encontrado ou já utilizado.');
  END IF;

  -- Buscar a licenca
  SELECT * INTO v_license FROM public.licenses WHERE id = v_invite.license_id;

  -- Checar limite de membros
  SELECT count(*) INTO v_current_members FROM public.invites
  WHERE license_id = v_license.id AND status = 'accepted';

  IF v_current_members >= v_license.max_members THEN
    RETURN json_build_object('error', 'Limite de convidados atingido.');
  END IF;

  -- Aceitar o convite
  UPDATE public.invites
  SET accepted_by = auth.uid(),
      status = 'accepted',
      accepted_at = now()
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'success', true,
    'license_id', v_license.id,
    'license_type', v_license.license_type
  );
END;
$$;

COMMIT;
