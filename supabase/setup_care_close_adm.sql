-- =============================================================
-- SETUP: Vincular todos os usuarios ao "Care Close ADM"
-- Rode no Supabase SQL Editor
-- =============================================================

-- =============================================
-- ETAPA 1: DIAGNOSTICO (rode primeiro para ver os dados)
-- =============================================

-- 1a) Ver a instituicao "Care Close ADM" e pegar o ID
SELECT id, name, owner_user_id, total_licenses, status
FROM public.institutions
WHERE name ILIKE '%Care Close%';

-- 1b) Ver todos os usuarios (exceto a propria instituicao)
SELECT u.id, a.email, u.name, u.role, u.institution_id
FROM public.users u
JOIN auth.users a ON a.id = u.id
ORDER BY u.role, u.name;

-- 1c) Ver licencas existentes
SELECT * FROM public.licenses;

-- 1d) Ver pacientes
SELECT * FROM public.patients;


-- =============================================
-- ETAPA 2: VINCULAR TUDO (rode depois de confirmar os dados acima)
-- =============================================

-- Pega o ID da instituicao "Care Close ADM" automaticamente
DO $$
DECLARE
    v_inst_id uuid;
    v_inst_owner uuid;
    v_user RECORD;
    v_counter int := 1;
    v_code text;
BEGIN
    -- Encontrar a instituicao
    SELECT id, owner_user_id INTO v_inst_id, v_inst_owner
    FROM public.institutions
    WHERE name ILIKE '%Care Close%'
    LIMIT 1;

    IF v_inst_id IS NULL THEN
        RAISE EXCEPTION 'Instituicao "Care Close ADM" nao encontrada!';
    END IF;

    RAISE NOTICE 'Instituicao encontrada: %', v_inst_id;

    -- Para cada usuario que NAO e a propria instituicao
    FOR v_user IN
        SELECT u.id, u.role, u.name
        FROM public.users u
        WHERE u.id != v_inst_owner
          AND u.role IN ('patient', 'caregiver')
    LOOP
        -- Gerar codigo unico da licenca
        v_code := 'CC-ADM-' || LPAD(v_counter::text, 4, '0');

        -- Criar licenca para este usuario (se nao existe)
        INSERT INTO public.licenses (institution_id, code, assigned_to, status, activated_at)
        VALUES (v_inst_id, v_code, v_user.id, 'active', now())
        ON CONFLICT (code) DO NOTHING;

        -- Vincular usuario a instituicao
        UPDATE public.users
        SET institution_id = v_inst_id
        WHERE id = v_user.id;

        -- Se for paciente, vincular o registro de patients a licenca
        IF v_user.role = 'patient' THEN
            UPDATE public.patients
            SET license_id = (
                SELECT id FROM public.licenses
                WHERE assigned_to = v_user.id
                  AND institution_id = v_inst_id
                LIMIT 1
            )
            WHERE user_id = v_user.id;
        END IF;

        RAISE NOTICE 'Usuario % (%) vinculado com licenca %', v_user.name, v_user.role, v_code;
        v_counter := v_counter + 1;
    END LOOP;

    -- Atualizar total de licencas na instituicao
    UPDATE public.institutions
    SET total_licenses = GREATEST(total_licenses, v_counter + 5)
    WHERE id = v_inst_id;

    RAISE NOTICE 'Concluido! % usuarios vinculados ao Care Close ADM.', v_counter - 1;
END $$;


-- =============================================
-- ETAPA 3: VERIFICACAO (rode para confirmar)
-- =============================================

-- Ver todos os usuarios agora vinculados
SELECT u.name, a.email, u.role, u.institution_id, i.name AS instituicao
FROM public.users u
JOIN auth.users a ON a.id = u.id
LEFT JOIN public.institutions i ON i.id = u.institution_id
ORDER BY u.role, u.name;

-- Ver todas as licencas criadas
SELECT l.code, l.status, l.activated_at, u.name, u.role
FROM public.licenses l
LEFT JOIN public.users u ON u.id = l.assigned_to
ORDER BY l.code;

-- Ver pacientes com suas licencas
SELECT p.user_id, u.name, p.license_id, l.code AS license_code
FROM public.patients p
JOIN public.users u ON u.id = p.user_id
LEFT JOIN public.licenses l ON l.id = p.license_id;
