-- Rôles et droits par défaut de Supabase : c'est la RLS seule qui ferme les tables.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
