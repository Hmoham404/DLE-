-- MYC-USINE-IA : premiere installation dans une base Supabase partagee.
-- SQL Editor > New query > coller TOUT ce fichier > Run.
-- Ne contient aucune cle API et ne transfere pas les fichiers Storage.
-- Cree uniquement les tables, fonctions et triggers prefixes MYC-USINE-IA.
-- Peut etre rejoue : les lignes existantes sont conservees.
-- Le raccordement des API du site a ces tables est une etape distincte.

begin;

-- Chaque document JSONB conserve tous les champs metier du site.
-- id est du texte pour accepter les UUID ainsi que le parametre "main".
do $myc_installation$
declare
  nom_table text;
begin
  foreach nom_table in array array[
    'MYC-USINE-IA_machines',
    'MYC-USINE-IA_production',
    'MYC-USINE-IA_etiquettes_5s',
    'MYC-USINE-IA_audits_5s',
    'MYC-USINE-IA_actions',
    'MYC-USINE-IA_parametres'
  ]
  loop
    execute format($table$
      create table if not exists public.%I (
        id text primary key check (length(id) between 1 and 200),
        donnees jsonb not null check (jsonb_typeof(donnees) = 'object'),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        deleted_by text
      )
    $table$, nom_table);
    execute format('alter table public.%I enable row level security', nom_table);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', nom_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', nom_table);
  end loop;
end;
$myc_installation$;

-- Historique automatique des insertions, modifications et suppressions.
create table if not exists public."MYC-USINE-IA_historique" (
  id uuid primary key default gen_random_uuid(),
  table_source text not null,
  enregistrement_id text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  avant jsonb,
  apres jsonb,
  acteur_base text not null default current_user,
  created_at timestamptz not null default now()
);

create index if not exists "MYC-USINE-IA_historique_recherche_idx"
  on public."MYC-USINE-IA_historique" (table_source, enregistrement_id, created_at desc);

-- Copies completes a alimenter explicitement par un export ou le serveur.
-- Cette table seule ne lance aucune sauvegarde periodique.
create table if not exists public."MYC-USINE-IA_sauvegardes" (
  id uuid primary key default gen_random_uuid(),
  description text not null default '',
  format text not null default 'myc-factory-json-v1',
  donnees jsonb not null check (jsonb_typeof(donnees) = 'object'),
  created_at timestamptz not null default now()
);

alter table public."MYC-USINE-IA_historique" enable row level security;
alter table public."MYC-USINE-IA_sauvegardes" enable row level security;
revoke all privileges on table public."MYC-USINE-IA_historique", public."MYC-USINE-IA_sauvegardes"
  from public, anon, authenticated;
grant select, insert on table public."MYC-USINE-IA_historique", public."MYC-USINE-IA_sauvegardes"
  to service_role;

-- SECURITY INVOKER : le serveur doit posseder les droits indiques ci-dessus.
create or replace function public."MYC-USINE-IA_actualiser"()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $myc_timestamp$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$myc_timestamp$;

create or replace function public."MYC-USINE-IA_historiser"()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $myc_history$
begin
  if tg_op = 'INSERT' then
    insert into public."MYC-USINE-IA_historique"
      (table_source, enregistrement_id, operation, apres)
    values (tg_table_name, new.id, tg_op, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public."MYC-USINE-IA_historique"
      (table_source, enregistrement_id, operation, avant, apres)
    values (tg_table_name, new.id, tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public."MYC-USINE-IA_historique"
      (table_source, enregistrement_id, operation, avant)
    values (tg_table_name, old.id, tg_op, to_jsonb(old));
    return old;
  end if;
end;
$myc_history$;

revoke all privileges on function public."MYC-USINE-IA_actualiser"(), public."MYC-USINE-IA_historiser"()
  from public, anon, authenticated;
grant execute on function public."MYC-USINE-IA_actualiser"(), public."MYC-USINE-IA_historiser"()
  to service_role;

do $myc_triggers$
declare
  nom_table text;
begin
  foreach nom_table in array array[
    'MYC-USINE-IA_machines',
    'MYC-USINE-IA_production',
    'MYC-USINE-IA_etiquettes_5s',
    'MYC-USINE-IA_audits_5s',
    'MYC-USINE-IA_actions',
    'MYC-USINE-IA_parametres'
  ]
  loop
    execute format('drop trigger if exists "MYC-USINE-IA_actualiser" on public.%I', nom_table);
    execute format('create trigger "MYC-USINE-IA_actualiser" before update on public.%I for each row execute function public."MYC-USINE-IA_actualiser"()', nom_table);
    execute format('drop trigger if exists "MYC-USINE-IA_historiser" on public.%I', nom_table);
    execute format('create trigger "MYC-USINE-IA_historiser" after insert or update or delete on public.%I for each row execute function public."MYC-USINE-IA_historiser"()', nom_table);
  end loop;
end;
$myc_triggers$;

commit;

-- Verification : exactement les huit tables MYC et RLS active.
select tablename as table_myc, rowsecurity as protection_rls
from pg_catalog.pg_tables
where schemaname = 'public'
  and tablename in (
    'MYC-USINE-IA_machines', 'MYC-USINE-IA_production',
    'MYC-USINE-IA_etiquettes_5s', 'MYC-USINE-IA_audits_5s',
    'MYC-USINE-IA_actions', 'MYC-USINE-IA_parametres',
    'MYC-USINE-IA_historique', 'MYC-USINE-IA_sauvegardes'
  )
order by tablename;
