-- MYC / OOE : installation JSONB dans une base Supabase partagee.
-- SQL Editor > New query > coller tout ce fichier > Run.
-- Une table, une ligne, un document JSON pour tous les modules.
-- Aucun secret a renseigner dans ce script.
-- Peut etre rejoue : le JSON existant n'est jamais reinitialise.
-- Ne modifie ni les autres projets ni les fichiers Supabase Storage.
-- Le site utilise encore Storage : ce script seul ne migre pas ses donnees.

begin;

create table if not exists public.ooe_myc_workspace (
  id text primary key default 'myc-smart-factory'
    check (id = 'myc-smart-factory'),
  revision bigint not null default 0 check (revision >= 0),
  donnees jsonb not null default '{"records": {}}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ooe_myc_workspace_document_valide check (
    jsonb_typeof(donnees) = 'object'
    and donnees ? 'records'
    and jsonb_typeof(donnees -> 'records') = 'object'
  )
);

comment on table public.ooe_myc_workspace is
  'MYC / OOE : document JSON unique, historique inclus dans records.';
comment on column public.ooe_myc_workspace.donnees is
  'records contient machine:, product:, report:, action:, settings:, five_s_tag: et five_s_audit:. Chaque enregistrement conserve value, updated_at et history.';

-- Serveur uniquement : les roles navigateur n'ont aucun acces.
alter table public.ooe_myc_workspace enable row level security;
revoke all privileges on table public.ooe_myc_workspace
  from public, anon, authenticated;
grant select, update on table public.ooe_myc_workspace to service_role;

-- Initialisation sans ecraser un document ou un historique existant.
insert into public.ooe_myc_workspace (id)
values ('myc-smart-factory')
on conflict (id) do nothing;

-- Remplacement atomique : deux serveurs ne peuvent pas sauvegarder
-- deux JSON differents a partir de la meme revision.
create or replace function public.ooe_myc_sauvegarder(
  p_revision bigint,
  p_donnees jsonb
)
returns public.ooe_myc_workspace
language plpgsql
security invoker
set search_path = ''
as $ooe_json$
declare
  resultat public.ooe_myc_workspace;
begin
  if p_revision is null or p_revision < 0 then
    raise exception 'Revision OOE invalide.' using errcode = '22023';
  end if;
  if p_donnees is null
     or jsonb_typeof(p_donnees) <> 'object'
     or not (p_donnees ? 'records')
     or jsonb_typeof(p_donnees -> 'records') <> 'object' then
    raise exception 'Le JSON OOE doit contenir un objet records.'
      using errcode = '22023';
  end if;

  update public.ooe_myc_workspace as espace
  set donnees = p_donnees,
      revision = espace.revision + 1,
      updated_at = clock_timestamp()
  where espace.id = 'myc-smart-factory'
    and espace.revision = p_revision
  returning espace.* into resultat;

  if not found then
    raise exception 'La version OOE a change. Relire avant de sauvegarder.'
      using errcode = '40001';
  end if;
  return resultat;
end;
$ooe_json$;

revoke all privileges on function public.ooe_myc_sauvegarder(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.ooe_myc_sauvegarder(bigint, jsonb)
  to service_role;

commit;

-- Resultat attendu : une ligne. Pas de copie de sauvegarde dans une autre table.
select id, revision, updated_at, pg_column_size(donnees) as taille_json_octets
from public.ooe_myc_workspace;
