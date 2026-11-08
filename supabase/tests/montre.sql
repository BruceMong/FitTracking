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

-- plan_absent_vaut_null
do $$ begin assert public.carnet_montre_plan('cle-montre-essai') is null, 'plan attendu nul'; end $$;

-- plan_publie_puis_relu (une seule ligne, remplacée)
do $$
declare p1 jsonb := '{"jour": "2026-11-09", "v": "a", "etapes": [{"id": "2026-11-09|Développé couché guidé|0", "repos": 150}]}';
        p2 jsonb := '{"jour": "2026-11-09", "v": "b", "etapes": []}';
begin
  perform public.carnet_montre_publier('cle-carnet-essai', p1);
  assert public.carnet_montre_plan('cle-montre-essai') = p1, 'plan relu différent';
  perform public.carnet_montre_publier('cle-carnet-essai', p2);
  assert public.carnet_montre_plan('cle-montre-essai') = p2, 'plan non remplacé';
  assert (select count(*) from public.montre_plan) = 1, 'une seule ligne de plan';
end $$;

-- appui_insere_et_renvoye_sans_effet
do $$
declare a jsonb := '{"id": "2026-11-09|Développé couché guidé|0", "nom": "Développé couché guidé", "jour": "2026-11-09",
                     "quand": "série 1/4", "ech": false, "k": 0, "c": 42.5, "r": 6, "t": "17:05:42", "ts": 1794330342, "repos": 150}';
        r1 jsonb; r2 jsonb;
begin
  r1 := public.carnet_montre_appui('cle-montre-essai', a);
  assert r1 ->> 'ok' = 'true' and (r1 ->> 'id')::bigint > 0, 'réponse attendue {"ok": true, "id": n}';
  r2 := public.carnet_montre_appui('cle-montre-essai', a || '{"r": 5}');
  assert r2 = r1, 'un renvoi doit rendre le même id';
  assert (select count(*) from public.montre_appuis) = 1, 'renvoi inséré deux fois';
  assert (select appui ->> 'r' from public.montre_appuis) = '6', 'le premier appui fait foi';
end $$;

-- appui_sans_id_refuse (trois formes), appui_trop_long_refuse
do $$ declare x jsonb; begin
  foreach x in array array['{}'::jsonb, '{"id": ""}'::jsonb, null::jsonb] loop
    begin
      perform public.carnet_montre_appui('cle-montre-essai', x);
      raise exception 'appui sans id accepté : %', x;
    exception when sqlstate '22023' then null;
    end;
  end loop;
  begin
    perform public.carnet_montre_appui('cle-montre-essai', jsonb_build_object('id', 'x', 'nom', repeat('a', 2100)));
    raise exception 'appui trop long accepté';
  exception when sqlstate '22023' then null;
  end;
  assert (select count(*) from public.montre_appuis) = 1, 'un appui refusé a été inséré';
end $$;

-- appuis_dans_l_ordre_depuis, depuis_nul_vaut_zero, fenetre_de_7_jours
do $$ declare l jsonb; premier bigint; begin
  perform public.carnet_montre_appui('cle-montre-essai', '{"id": "2026-11-09|Triceps poulie basse|0"}');
  perform public.carnet_montre_appui('cle-montre-essai', '{"id": "2026-11-09|Élévations latérales|0"}');
  l := public.carnet_montre_appuis('cle-carnet-essai', 0);
  assert jsonb_array_length(l) = 3, '3 appuis attendus';
  assert l -> 0 -> 'appui' ->> 'id' = '2026-11-09|Développé couché guidé|0', 'ordre des id';
  assert l -> 2 -> 'appui' ->> 'id' = '2026-11-09|Élévations latérales|0', 'ordre des id (fin)';
  assert l -> 0 ? 'recu' and (l -> 1 ->> 'id')::bigint > (l -> 0 ->> 'id')::bigint, 'champs id / recu';
  premier := (l -> 0 ->> 'id')::bigint;
  assert jsonb_array_length(public.carnet_montre_appuis('cle-carnet-essai', premier)) = 2, 'depuis exclusif';
  assert public.carnet_montre_appuis('cle-carnet-essai', null) = l, 'p_depuis nul = 0';
  assert public.carnet_montre_appuis('cle-carnet-essai', (l -> 2 ->> 'id')::bigint) = '[]'::jsonb, 'rien après le dernier';
  update public.montre_appuis set recu = now() - interval '8 days' where serie = '2026-11-09|Triceps poulie basse|0';
  assert jsonb_array_length(public.carnet_montre_appuis('cle-carnet-essai', 0)) = 2, 'appui de plus de 7 jours renvoyé';
end $$;

-- cles_croisees_refusees : chaque fonction n'ouvre que sa clé
do $$ declare appel text; begin
  foreach appel in array array[
    $q$select public.carnet_montre_publier('cle-montre-essai', '{}')$q$,
    $q$select public.carnet_montre_appuis('cle-montre-essai', 0)$q$,
    $q$select public.carnet_montre_plan('cle-carnet-essai')$q$,
    $q$select public.carnet_montre_appui('cle-carnet-essai', '{"id": "z"}')$q$,
    $q$select public.carnet_montre_plan('essai')$q$] loop
    begin
      execute appel;
      raise exception 'clé acceptée à tort : %', appel;
    exception when sqlstate '28000' then null;
    end;
  end loop;
end $$;

-- fonctions_securisees : security definer et search_path figé, comme l'existant
do $$ begin
  assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where p.proname in ('carnet_montre_publier', 'carnet_montre_plan', 'carnet_montre_appui',
                              'carnet_montre_appuis', 'verifier_montre')
            and p.prosecdef and p.proconfig @> array['search_path=""']) = 5, 'fonction sans security definer ou search_path';
end $$;
