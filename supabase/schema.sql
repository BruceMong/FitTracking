-- Schéma de la base Supabase « carnet » (projet vesdcipjplvgdwfsvefq, eu-west-3), relevé le 2026-11-05.
-- Sert à recréer le projet à l'identique s'il était perdu, puis à y remettre les séances avec
-- `carnet-sauvegarde --restaurer` (dépôt arch-config). Aucun secret ici : la base ne garde que
-- l'empreinte SHA-256 de la clé, et elle est dans une table, pas dans ce fichier.
--
-- Recréer : coller ce fichier dans l'éditeur SQL d'un nouveau projet, puis enregistrer l'empreinte
-- de la clé du PC (~/.config/carnet/cle) :
--   insert into private.cle values (encode(sha256(convert_to('<la clé>', 'UTF8')), 'hex'));
-- et mettre l'URL du nouveau projet et sa clé publiable dans carnet-sync et app.js.

create schema if not exists private;

create table private.cle (
  empreinte text primary key
);

create table public.seances (
  jour date primary key,
  doc jsonb,
  maj timestamptz default now()
);

create table public.contexte (
  id integer primary key default 1 check (id = 1),
  doc jsonb,
  maj timestamptz default now()
);

create table public.photos (
  id bigint generated always as identity primary key,
  jour date,
  genre text,
  donnees text check (length(donnees) < 4000000),
  depose timestamptz default now()
);

-- Tables fermées : RLS sans aucune politique, on n'y passe que par les fonctions ci-dessous.
alter table public.seances enable row level security;
alter table public.contexte enable row level security;
alter table public.photos enable row level security;

CREATE OR REPLACE FUNCTION private.verifier(p_cle text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from private.cle k
                 where k.empreinte = encode(pg_catalog.sha256(convert_to(p_cle, 'UTF8')), 'hex')) then
    raise exception 'clé refusée' using errcode = '28000';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_contexte(p_cle text, p_doc jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier(p_cle);
  insert into public.contexte (id, doc, maj) values (1, p_doc, now())
  on conflict (id) do update set doc = excluded.doc, maj = now();
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_depuis(p_cle text, p_depuis timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier(p_cle);
  return coalesce((select jsonb_agg(jsonb_build_object('jour', s.jour, 'doc', s.doc, 'maj', s.maj) order by s.maj)
                   from public.seances s where s.maj > p_depuis), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_ecrire(p_cle text, p_jour date, p_doc jsonb)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t timestamptz;
begin
  perform private.verifier(p_cle);
  insert into public.seances as s (jour, doc, maj) values (p_jour, p_doc, now())
  on conflict (jour) do update set doc = excluded.doc, maj = now()
  returning s.maj into t;
  return t;
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_lire(p_cle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier(p_cle);
  return jsonb_build_object(
    'contexte', (select c.doc from public.contexte c where c.id = 1),
    'contexte_maj', (select c.maj from public.contexte c where c.id = 1),
    'seances', coalesce((select jsonb_agg(s.doc order by s.jour) from public.seances s
                         where s.jour >= current_date - 90), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_photo_deposer(p_cle text, p_jour date, p_genre text, p_donnees text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i bigint;
begin
  perform private.verifier(p_cle);
  insert into public.photos (jour, genre, donnees) values (p_jour, left(p_genre, 40), p_donnees) returning id into i;
  return i;
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_photos_effacer(p_cle text, p_ids bigint[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  perform private.verifier(p_cle);
  delete from public.photos where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.carnet_photos_prendre(p_cle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.verifier(p_cle);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'jour', x.jour, 'genre', x.genre, 'donnees', x.donnees))
                   from (select * from public.photos order by id limit 3) x), '[]'::jsonb);
end $function$;
