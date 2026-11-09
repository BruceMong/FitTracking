-- Rôles et droits par défaut de Supabase : c'est la RLS seule qui ferme les tables.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
-- Supabase accorde aussi EXECUTE directement à anon et authenticated sur chaque fonction créée (pas seulement via
-- public) : sans cette ligne, le revoke « from authenticated, public » couperait anon ici et pas en production.
alter default privileges in schema public grant execute on functions to anon, authenticated;
