-- supabase/tests/rls_test.sql
-- Script de validation de la sécurité RLS et étanchéité multi-boutiques

begin;

-- 1. DESACTIVATION TEMPORAIRE DE LA RLS POUR CREER LE JEU DE TEST (Mode Admin / postgres)
alter table public.boutiques disable row level security;
alter table public.profils disable row level security;
alter table public.produits disable row level security;
alter table public.ventes disable row level security;
alter table public.ardoises disable row level security;

-- Création des utilisateurs d'authentification mockés dans auth.users
insert into auth.users (id, email, aud, role) values
  ('ca111111-1111-1111-1111-111111111111', 'caissierA@test.com', 'authenticated', 'authenticated'),
  ('ca222222-2222-2222-2222-222222222222', 'caissierB@test.com', 'authenticated', 'authenticated'),
  ('ee111111-1111-1111-1111-111111111111', 'gerantA@test.com', 'authenticated', 'authenticated');

-- Création des boutiques de test
insert into public.boutiques (id, nom, adresse) values
  ('11111111-1111-1111-1111-111111111111', 'Boutique A (Dakar)', 'Dakar Plateau'),
  ('22222222-2222-2222-2222-222222222222', 'Boutique B (Rufisque)', 'Rufisque Centre');

-- Création/Mise à jour des profils de test (gère le trigger d'auth automatique)
insert into public.profils (id, role, boutique_id) values
  ('ca111111-1111-1111-1111-111111111111', 'caissier', '11111111-1111-1111-1111-111111111111'),
  ('ca222222-2222-2222-2222-222222222222', 'caissier', '22222222-2222-2222-2222-222222222222'),
  ('ee111111-1111-1111-1111-111111111111', 'gerant', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update set
  role = excluded.role,
  boutique_id = excluded.boutique_id;

-- Création des produits de test
insert into public.produits (id, boutique_id, nom, prix, quantite) values
  ('aa111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Riz 50kg', 18500, 20),
  ('bb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Huile 5L', 6500, 10);

-- Création des ventes de test
insert into public.ventes (id, boutique_id, caissier_id, total) values
  ('fa111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111', 18500),
  ('fb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'ca222222-2222-2222-2222-222222222222', 6500);

-- Création d'une ardoise de test
insert into public.ardoises (id, boutique_id, client_nom, montant_total, statut) values
  ('da111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Moussa Diop', 5000, 'en_cours');

-- RE-ACTIVATION DE LA RLS SUR TOUTES LES TABLES POUR LANCER LES TESTS
alter table public.boutiques enable row level security;
alter table public.profils enable row level security;
alter table public.produits enable row level security;
alter table public.ventes enable row level security;
alter table public.ardoises enable row level security;

-- FORCE LA RLS SUR LES TABLES POUR LE COMPTE POSTGRES/OWNER DURANT LE TEST
alter table public.boutiques force row level security;
alter table public.profils force row level security;
alter table public.produits force row level security;
alter table public.ventes force row level security;
alter table public.ardoises force row level security;


-- 2. PASSAGE AU ROLE DE TEST 'authenticated' POUR FORCER L'EVALUATION RLS (postgres contourne RLS)
set role authenticated;


-- TEST A : SIMULATION D'UN CAISSIER DE LA BOUTIQUE A
set local request.jwt.claim = '{"role": "caissier", "boutique_id": "11111111-1111-1111-1111-111111111111", "sub": "ca111111-1111-1111-1111-111111111111"}';
set local request.jwt.claims = '{"role": "caissier", "boutique_id": "11111111-1111-1111-1111-111111111111", "sub": "ca111111-1111-1111-1111-111111111111"}';

-- A.1 : Le caissier A ne doit voir que les ventes de la Boutique A (1 seule vente)
do $$
declare
  v_count integer;
  jwt_val jsonb;
begin
  select auth.jwt() into jwt_val;
  raise notice 'DEBUG auth.jwt() = %', jwt_val;
  raise notice 'DEBUG role = %', jwt_val ->> 'role';
  raise notice 'DEBUG boutique_id = %', jwt_val ->> 'boutique_id';
  
  select count(*) into v_count from public.ventes;
  if v_count <> 1 then
    raise exception 'ECHEC TEST A.1 : Caissier A voit % ventes au lieu de 1', v_count;
  end if;
  raise notice 'PASSED : Test A.1 (Caissier A ne voit que ses propres ventes)';
end;
$$;

-- A.2 : Le caissier A ne doit voir aucun produit de la Boutique B
do $$
declare
  p_count integer;
begin
  select count(*) into p_count from public.produits;
  if p_count <> 1 then
    raise exception 'ECHEC TEST A.2 : Caissier A voit % produits au lieu de 1', p_count;
  end if;
  raise notice 'PASSED : Test A.2 (Caissier A ne voit que ses propres produits)';
end;
$$;

-- A.3 : Le caissier A ne doit avoir aucun accès aux ardoises (Doit retourner 0 ligne)
do $$
declare
  a_count integer;
begin
  select count(*) into a_count from public.ardoises;
  if a_count <> 0 then
    raise exception 'ECHEC TEST A.3 : Caissier A a pu lire % ardoises (Attendu : 0)', a_count;
  end if;
  raise notice 'PASSED : Test A.3 (Caissier A bloqué en lecture sur les ardoises)';
end;
$$;

-- A.4 : Le caissier A ne doit pas pouvoir insérer de vente pour la Boutique B (Doit lever une exception RLS)
do $$
begin
  insert into public.ventes (id, boutique_id, caissier_id, total) values
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'ca111111-1111-1111-1111-111111111111', 12000);
  raise exception 'ECHEC TEST A.4 : Caissier A a réussi à insérer une vente pour la Boutique B !';
exception 
  when insufficient_privilege then
    raise notice 'PASSED : Test A.4 (Caissier A bloqué en écriture sur la Boutique B)';
end;
$$;


-- TEST B : SIMULATION D'UN GERANT DE LA BOUTIQUE A
set local request.jwt.claim = '{"role": "gerant", "boutique_id": "11111111-1111-1111-1111-111111111111", "sub": "ee111111-1111-1111-1111-111111111111"}';
set local request.jwt.claims = '{"role": "gerant", "boutique_id": "11111111-1111-1111-1111-111111111111", "sub": "ee111111-1111-1111-1111-111111111111"}';

-- B.1 : Le gérant A doit pouvoir lire les ardoises de sa boutique (1 ardoise)
do $$
declare
  a_count integer;
begin
  select count(*) into a_count from public.ardoises;
  if a_count <> 1 then
    raise exception 'ECHEC TEST B.1 : Gérant A voit % ardoises au lieu de 1', a_count;
  end if;
  raise notice 'PASSED : Test B.1 (Gérant A accède aux ardoises de sa boutique)';
end;
$$;

-- B.2 : Le gérant A ne doit pas pouvoir insérer un produit pour la Boutique B
do $$
begin
  insert into public.produits (id, boutique_id, nom, prix, quantite) values
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Sucre 1kg', 850, 50);
  raise exception 'ECHEC TEST B.2 : Gérant A a inséré un produit pour la Boutique B !';
exception 
  when insufficient_privilege then
    raise notice 'PASSED : Test B.2 (Gérant A bloqué en insertion de produit sur la Boutique B)';
end;
$$;


-- TEST C : SIMULATION D'UN SUPER_ADMIN
set local request.jwt.claim = '{"role": "super_admin", "sub": "sa999999-9999-9999-9999-999999999999"}';
set local request.jwt.claims = '{"role": "super_admin", "sub": "sa999999-9999-9999-9999-999999999999"}';

-- C.1 : Le super_admin doit voir toutes les ventes (2 ventes)
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.ventes;
  if v_count <> 2 then
    raise exception 'ECHEC TEST C.1 : Super Admin voit % ventes au lieu de 2', v_count;
  end if;
  raise notice 'PASSED : Test C.1 (Super Admin voit l''ensemble des ventes)';
end;
$$;

-- RETOUR AU ROLE PRINCIPAL (postgres) POUR FINALISER LA TRANSACTION ET LE ROLLBACK
reset role;

rollback;
