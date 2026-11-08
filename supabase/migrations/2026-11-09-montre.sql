-- Migration « montre » : tables montre_plan et montre_appuis, clé de la montre et sa vérification,
-- puis (partie suivante) les quatre fonctions RPC carnet_montre_*.
-- Écrite le 2026-11-09. Appliquée en production le : (à remplir à l'application).
-- Rejouable : create ... if not exists, create or replace.

create schema if not exists private;

-- Clé de la montre, à part de celle du carnet : seule l'empreinte SHA-256 est en base.
create table if not exists private.cle_montre (
  empreinte text primary key
);

-- Le plan du jour publié par le carnet : une seule ligne.
create table if not exists public.montre_plan (
  id integer primary key default 1 check (id = 1),
  plan jsonb,
  maj timestamptz default now()
);

-- Un appui de la montre = une série validée ; `serie` (l'id de l'appui) rend le renvoi sans effet.
create table if not exists public.montre_appuis (
  id bigint generated always as identity primary key,
  serie text not null unique,
  appui jsonb not null check (length(appui::text) <= 2000),
  recu timestamptz not null default now()
);

-- Tables fermées : RLS sans aucune politique, on n'y passe que par les fonctions.
alter table public.montre_plan enable row level security;
alter table public.montre_appuis enable row level security;

CREATE OR REPLACE FUNCTION private.verifier_montre(p_cle text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from private.cle_montre k
                 where k.empreinte = encode(pg_catalog.sha256(convert_to(p_cle, 'UTF8')), 'hex')) then
    raise exception 'clé refusée' using errcode = '28000';
  end if;
end $function$;
