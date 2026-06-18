-- supabase/migrations/0004_bootstrap_3_superadmins.sql
-- BoutikOS — Bootstrap : les 3 premiers comptes créés sont super_admin
-- Contexte : en phase de démarrage, les 3 fondateurs créent leur compte
--            successivement et obtiennent automatiquement le rôle super_admin.
--            A partir du 4e compte, le rôle par défaut est 'caissier'.
-- Idempotent : peut être ré-exécuté sans danger.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_count integer;
  assigned_role text;
begin
  select count(*) into existing_count from public.profils;

  if existing_count < 3 then
    -- Bootstrap : les 3 premiers comptes (fondateurs) sont super_admin
    assigned_role := 'super_admin';
  else
    -- A partir du 4e : rôle minimal par défaut, sans boutique.
    -- JAMAIS de confiance au client (raw_user_meta_data ignoré).
    assigned_role := 'caissier';
  end if;

  insert into public.profils (id, role, boutique_id)
  values (new.id, assigned_role, null);

  return new;
end;
$$;

commit;
