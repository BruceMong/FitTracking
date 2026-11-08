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
