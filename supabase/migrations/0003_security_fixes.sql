-- supabase/migrations/0003_security_fixes.sql
-- BoutikOS — Correctifs de sécurité
-- Corrige :
--   FAILLE 1 : escalade de privilèges via auto-UPDATE de public.profils (role / boutique_id)
--   FAILLE 2 : injection de rôle à l'inscription via raw_user_meta_data
--   DURCISSEMENT : search_path figé sur les fonctions SECURITY DEFINER
--   NETTOYAGE : suppression des helpers RLS devenus inutiles après 0002
-- Idempotent : peut être ré-exécuté sans danger.

begin;

-- =====================================================================
-- 1. NETTOYAGE — helpers RLS morts depuis le passage aux claims JWT (0002)
-- =====================================================================
drop function if exists public.get_my_role();
drop function if exists public.get_my_boutique_id();


-- =====================================================================
-- 2. DURCISSEMENT — search_path figé sur les fonctions SECURITY DEFINER
--    (corrige l'avertissement "Function Search Path Mutable" du Security Advisor)
-- =====================================================================

-- 2.a Trigger updated_at
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- 2.b Hook JWT (claims personnalisés) — recréé avec search_path figé
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  user_role text;
  user_boutique_id uuid;
begin
  select role, boutique_id into user_role, user_boutique_id
  from public.profils
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if user_role is not null then
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  else
    claims := jsonb_set(claims, '{role}', 'null'::jsonb);
  end if;

  if user_boutique_id is not null then
    claims := jsonb_set(claims, '{boutique_id}', to_jsonb(user_boutique_id));
  else
    claims := jsonb_set(claims, '{boutique_id}', 'null'::jsonb);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Re-grant (CREATE OR REPLACE conserve les droits, mais on s'en assure)
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;


-- =====================================================================
-- 3. FAILLE 2 — Injection de rôle à l'inscription
--    Le rôle/boutique fournis par le client (raw_user_meta_data) ne sont
--    PLUS jamais pris en compte. Tout nouvel inscrit est 'caissier' sans
--    boutique. Exception : le TOUT PREMIER compte créé devient super_admin
--    (bootstrap de l'administrateur initial).
--    L'attribution réelle du rôle/boutique se fait ensuite via la fonction
--    public.assign_staff() (section 5), réservée aux admins/gérants.
-- =====================================================================
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

  if existing_count = 0 then
    -- Bootstrap : le premier utilisateur est l'administrateur racine
    assigned_role := 'super_admin';
  else
    -- Tous les autres : rôle minimal, sans boutique. JAMAIS de confiance au client.
    assigned_role := 'caissier';
  end if;

  insert into public.profils (id, role, boutique_id)
  values (new.id, assigned_role, null);

  return new;
end;
$$;

-- (Le trigger on_auth_user_created créé en 0001 reste valide et pointe
--  désormais sur cette nouvelle version de la fonction.)


-- =====================================================================
-- 4. FAILLE 1 — Escalade de privilèges via auto-UPDATE de profils
--    Un trigger BEFORE UPDATE interdit toute modification de role /
--    boutique_id, SAUF :
--      - opérations backend sans contexte JWT (service_role / postgres)
--      - un super_admin (peut tout)
--      - un gérant modifiant un AUTRE profil de SA boutique, sans pouvoir
--        créer de super_admin ni déplacer hors de sa boutique
--    => personne ne peut s'auto-promouvoir, et un gérant ne peut pas
--       fabriquer un super_admin.
-- =====================================================================
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := auth.uid();
  actor_role text := auth.jwt() ->> 'role';
  actor_boutique uuid := nullif(auth.jwt() ->> 'boutique_id', 'null')::uuid;
begin
  -- Rien de sensible n'a changé : on laisse passer.
  if new.role is not distinct from old.role
     and new.boutique_id is not distinct from old.boutique_id then
    return new;
  end if;

  -- Contexte backend (service_role, postgres, seed, hook) : pas de auth.uid().
  if actor_uid is null then
    return new;
  end if;

  -- Super_admin : autorisé à tout.
  if actor_role = 'super_admin' then
    return new;
  end if;

  -- Gérant : peut gérer le personnel d'un AUTRE profil de SA boutique,
  -- sans créer de super_admin ni l'envoyer dans une autre boutique.
  if actor_role = 'gerant'
     and old.id <> actor_uid
     and new.role in ('caissier', 'gerant')
     and new.boutique_id is not distinct from actor_boutique then
    return new;
  end if;

  raise exception
    'Modification de role/boutique_id non autorisee (utilisateur=%, role=%)',
    actor_uid, coalesce(actor_role, 'aucun')
    using errcode = '42501'; -- insufficient_privilege
end;
$$;

drop trigger if exists trg_prevent_privilege_escalation on public.profils;
create trigger trg_prevent_privilege_escalation
  before update on public.profils
  for each row execute procedure public.prevent_privilege_escalation();


-- =====================================================================
-- 5. ATTRIBUTION SÉCURISÉE DU PERSONNEL (rôle + boutique)
--    RPC à appeler depuis l'app (ex: supabase.rpc('assign_staff', {...})).
--    Contourne proprement la visibilité RLS (un profil fraîchement créé a
--    boutique_id NULL et serait invisible au gérant), tout en restant
--    soumise au garde-fou de la section 4.
-- =====================================================================
create or replace function public.assign_staff(
  target_user   uuid,
  new_role      text,
  new_boutique  uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role     text := auth.jwt() ->> 'role';
  caller_boutique uuid := nullif(auth.jwt() ->> 'boutique_id', 'null')::uuid;
begin
  if new_role not in ('caissier', 'gerant', 'super_admin') then
    raise exception 'Role invalide: %', new_role using errcode = '22023';
  end if;

  if caller_role = 'super_admin' then
    null; -- autorisé sur n'importe quel utilisateur / rôle / boutique

  elsif caller_role = 'gerant' then
    if new_role = 'super_admin' then
      raise exception 'Un gerant ne peut pas creer de super_admin'
        using errcode = '42501';
    end if;
    if new_boutique is distinct from caller_boutique then
      raise exception 'Un gerant ne peut affecter que sa propre boutique'
        using errcode = '42501';
    end if;

  else
    raise exception 'Acces refuse' using errcode = '42501';
  end if;

  update public.profils
  set role = new_role,
      boutique_id = new_boutique
  where id = target_user;

  if not found then
    raise exception 'Utilisateur introuvable: %', target_user
      using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.assign_staff(uuid, text, uuid) to authenticated;

commit;

-- =====================================================================
-- ÉTAPE MANUELLE OBLIGATOIRE (non scriptable en SQL)
-- =====================================================================
-- Activer le hook JWT, sinon les claims role/boutique_id sont absents et
-- TOUTES les policies refusent tout :
--   Dashboard -> Authentication -> Hooks (Beta)
--   -> Custom Access Token -> public.custom_access_token_hook
-- ou en local dans supabase/config.toml :
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
