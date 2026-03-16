-- ============================================================
-- Care Close: Institution & Licenses Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. INSTITUTIONS TABLE
create table if not exists public.institutions (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    cnpj        text,
    plan        text default 'B2B Premium · Mensal',
    status      text default 'active' check (status in ('active', 'inactive', 'suspended')),
    total_licenses int default 10,
    next_billing   date,
    owner_user_id  uuid references auth.users(id) on delete set null,
    created_at  timestamptz default now()
);

-- 2. LICENSES TABLE
-- Each license belongs to an institution and is assigned to one caregiver user
create table if not exists public.licenses (
    id              uuid primary key default gen_random_uuid(),
    institution_id  uuid not null references public.institutions(id) on delete cascade,
    code            text unique not null,           -- e.g. INST-7842
    assigned_to     uuid references auth.users(id) on delete set null,  -- caregiver user
    status          text default 'pending' check (status in ('active', 'pending', 'revoked')),
    created_at      timestamptz default now(),
    activated_at    timestamptz
);

-- 3. Add institution_id to the caregivers/users table so we can link them
alter table public.users
    add column if not exists institution_id uuid references public.institutions(id) on delete set null;

-- 4. Row Level Security
alter table public.institutions enable row level security;
alter table public.licenses enable row level security;

-- Institution: only the owner can see and manage their institution
create policy "Institution owner can view" on public.institutions
    for select using (owner_user_id = auth.uid());

create policy "Institution owner can update" on public.institutions
    for update using (owner_user_id = auth.uid());

-- Licenses: institution owner can do everything
create policy "Institution owner manages licenses" on public.licenses
    for all using (
        institution_id in (
            select id from public.institutions where owner_user_id = auth.uid()
        )
    );

-- Caregivers: can only view their own assigned license
create policy "Caregiver can view own license" on public.licenses
    for select using (assigned_to = auth.uid());

-- 5. Create Test Institution User in auth.users
-- NOTE: This creates the user via Supabase auth admin. Replace password as needed.
-- You can alternatively create the user via the Supabase Dashboard -> Authentication -> Users
-- and then run only the INSERT below.

-- Insert the institution profile into the users table
-- (do this AFTER creating the auth user via Dashboard or via supabase.auth.admin.createUser)

-- 5a. Insert institution record (will reference the user created below)
-- We use a placeholder user_id — update the UUID after creating the auth user.
-- See the walkthrough for how to get the actual UUID.

-- ============================================================
-- AFTER creating the institution auth user (email: instituicao@carecloseteste.com),
-- get their UUID from the Supabase Auth dashboard and run:
-- ============================================================

-- Example (replace INSTITUTION_USER_UUID with the real UUID):
/*
insert into public.users (id, email, name, role)
values (
    'INSTITUTION_USER_UUID',
    'instituicao@carecloseteste.com',
    'Instituição Teste - Care Close',
    'institution'
) on conflict (id) do update set role = 'institution', name = 'Instituição Teste - Care Close';

insert into public.institutions (name, cnpj, plan, status, total_licenses, next_billing, owner_user_id)
values (
    'Casa de Repouso Santa Clara',
    '12.345.678/0001-90',
    'B2B Premium · Mensal',
    'active',
    50,
    '2025-11-15',
    'INSTITUTION_USER_UUID'
);
*/

-- 6. Create licenses for existing caregivers and link to institution
-- Run this AFTER you have the institution row created and know its ID (INSTITUTION_ID)
-- and after you know the caregiver user IDs (CAREGIVER_USER_ID, PATIENT_USER_ID)

/*
-- Get caregiver user IDs by running first:
select id, email, role from public.users where role in ('caregiver', 'patient');

-- Then for each caregiver, create a license:
insert into public.licenses (institution_id, code, assigned_to, status, activated_at)
values
    ('INSTITUTION_ID', 'INST-0001', 'CAREGIVER_USER_ID', 'active', now()),
    ('INSTITUTION_ID', 'INST-0002', 'PATIENT_USER_ID',   'active', now());

-- Also link the caregiver users to the institution:
update public.users
set institution_id = 'INSTITUTION_ID'
where role in ('caregiver', 'patient');
*/

-- ============================================================
-- HELPER QUERIES (run these to verify everything is working)
-- ============================================================

-- View all institutions:
-- select * from public.institutions;

-- View all licenses with caregiver info:
-- select l.code, l.status, l.activated_at, u.name, u.email
-- from public.licenses l
-- left join public.users u on u.id = l.assigned_to;
