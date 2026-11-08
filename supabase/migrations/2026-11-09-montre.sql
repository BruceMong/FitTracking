-- Migration « montre » : tables montre_plan et montre_appuis, clé de la montre et sa vérification,
-- et les quatre fonctions RPC carnet_montre_*.
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

-- Le carnet publie le plan du jour (clé du carnet) : l'unique ligne est remplacée.
CREATE OR REPLACE FUNCTION public.carnet_montre_publier(p_cle text, p_plan jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier(p_cle);
  insert into public.montre_plan (id, plan, maj) values (1, p_plan, now())
  on conflict (id) do update set plan = excluded.plan, maj = now();
end $function$;

-- La montre lit le plan (clé de la montre) : null s'il n'a jamais été publié.
CREATE OR REPLACE FUNCTION public.carnet_montre_plan(p_cle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier_montre(p_cle);
  return (select p.plan from public.montre_plan p where p.id = 1);
end $function$;

-- La montre envoie un appui (clé de la montre) ; un renvoi du même id rend le même id sans rien insérer.
CREATE OR REPLACE FUNCTION public.carnet_montre_appui(p_cle text, p_appui jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text; i bigint;
begin
  perform private.verifier_montre(p_cle);
  if jsonb_typeof(p_appui -> 'id') is distinct from 'string' then
    raise exception 'appui sans id' using errcode = '22023';
  end if;
  s := p_appui ->> 'id';
  if btrim(s) = '' then
    raise exception 'appui sans id' using errcode = '22023';
  end if;
  if length(p_appui::text) > 2000 then
    raise exception 'appui trop long' using errcode = '22023';
  end if;
  insert into public.montre_appuis (serie, appui) values (s, p_appui)
  on conflict (serie) do nothing
  returning id into i;
  if i is null then
    select a.id into i from public.montre_appuis a where a.serie = s;
  end if;
  return jsonb_build_object('ok', true, 'id', i);
end $function$;

-- Le carnet relève les appuis (clé du carnet) : id > p_depuis, reçus depuis moins de 7 jours, dans l'ordre.
CREATE OR REPLACE FUNCTION public.carnet_montre_appuis(p_cle text, p_depuis bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier(p_cle);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'appui', a.appui, 'recu', a.recu) order by a.id)
                   from public.montre_appuis a
                   where a.id > coalesce(p_depuis, 0) and a.recu > now() - interval '7 days'), '[]'::jsonb);
end $function$;
