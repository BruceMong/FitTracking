-- Tests SQL de la base « carnet » (lancés par lancer.sh, chaque bloc échoue par une exception).

insert into private.cle values (encode(pg_catalog.sha256(convert_to('cle-carnet-essai', 'UTF8')), 'hex'));

-- carnet_lire_refuse_une_fausse_cle : le banc rejoue bien le schéma de production
do $$ begin
  perform public.carnet_lire('essai');
  raise exception 'carnet_lire aurait dû refuser la clé';
exception when sqlstate '28000' then null;
end $$;
-- carnet_lire_accepte_la_cle : contexte nul et aucune séance sur une base vide
do $$ begin
  assert public.carnet_lire('cle-carnet-essai') -> 'seances' = '[]'::jsonb, 'séances attendues vides';
end $$;

-- Graine : clé de la montre (table créée par la migration)
insert into private.cle_montre values (encode(pg_catalog.sha256(convert_to('cle-montre-essai', 'UTF8')), 'hex'));

-- verifier_montre_accepte_sa_cle / refuse_les_autres
do $$ begin perform private.verifier_montre('cle-montre-essai'); end $$;
do $$ begin
  perform private.verifier_montre('cle-carnet-essai');
  raise exception 'la clé du carnet ne doit pas ouvrir la montre';
exception when sqlstate '28000' then null;
end $$;
do $$ begin
  perform private.verifier('cle-montre-essai');
  raise exception 'la clé de la montre ne doit pas ouvrir le carnet';
exception when sqlstate '28000' then null;
end $$;

-- tables_fermees_pour_anon : des lignes existent, anon n'en voit aucune et ne touche pas à private
insert into public.montre_plan (plan) values ('{"jour": "2026-11-09", "etapes": []}');
insert into public.montre_appuis (serie, appui) values ('2026-11-09|X|0', '{"id": "2026-11-09|X|0"}');
set role anon;
do $$ begin
  assert (select count(*) from public.montre_plan) = 0, 'anon voit le plan';
  assert (select count(*) from public.montre_appuis) = 0, 'anon voit les appuis';
end $$;
do $$ begin
  perform 1 from private.cle_montre;
  raise exception 'anon lit private.cle_montre';
exception when insufficient_privilege then null;
end $$;
reset role;
delete from public.montre_appuis; delete from public.montre_plan;
