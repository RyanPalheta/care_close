-- =============================================================
-- FIX: patients.license_id NOT NULL bloqueava o auto-cadastro de paciente
-- =============================================================
-- Pacientes B2C se cadastram (e ganham seu registro de paciente) ANTES de ter
-- uma licença/compra. O NOT NULL em license_id fazia esse INSERT falhar em
-- silêncio (erro 23502), deixando contas "fantasma": role=patient com ZERO
-- pacientes — toda tela respondia "nenhum paciente vinculado".
--
-- IMPORTANTE: Rode este script no SQL Editor do Supabase.
-- =============================================================

ALTER TABLE public.patients ALTER COLUMN license_id DROP NOT NULL;
