-- supabase/seed.sql
-- Jeu de données de test pour le développement LOCAL uniquement.
-- Appliqué automatiquement par `supabase db reset` / `supabase start` sur le stack Supabase local
-- (docker). Ne touche jamais la base de production — ce fichier n'est jamais exécuté contre un
-- projet distant par la CLI Supabase.
--
-- Comptes de test (mot de passe identique pour tous : devpassword123) :
--   super_admin : superadmin@dev.local
--   gérant boutique 1 : gerant1@dev.local
--   gérant boutique 2 : gerant2@dev.local

BEGIN;

-- 0. pgcrypto est nécessaire pour crypt()/gen_salt() ci-dessous (déjà présent sur l'image Supabase standard,
-- cette ligne est juste défensive en cas d'image locale minimaliste).
create extension if not exists pgcrypto with schema extensions;

-- 1. UTILISATEURS AUTH (nécessaires avant les profils, à cause de la FK profils.id -> auth.users.id)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'superadmin@dev.local',
    crypt('devpassword123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'gerant1@dev.local',
    crypt('devpassword123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'gerant2@dev.local',
    crypt('devpassword123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

-- 2. BOUTIQUES
insert into public.boutiques (id, nom, adresse, quartier) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Boutique Sandaga', 'Marché Sandaga, Dakar', 'Plateau'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Boutique Ouakam', 'Route de Ouakam', 'Ouakam')
on conflict (id) do nothing;

-- 3. PROFILS (liés aux users auth ci-dessus)
insert into public.profils (id, role, boutique_id, nom, prenom, status) values
  ('11111111-1111-1111-1111-111111111111', 'super_admin', null, 'Diop', 'Admin', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'gerant', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ndiaye', 'Fatou', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'gerant', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sarr', 'Moussa', 'active')
on conflict (id) do nothing;

update public.boutiques set gerant_id = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.boutiques set gerant_id = '33333333-3333-3333-3333-333333333333' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- 4. PRODUITS
insert into public.produits (boutique_id, nom, prix, quantite, seuil_alerte) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Riz Long Grain 5kg', 5000, 40, 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Huile Végétale 1L', 1500, 60, 15),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sucre en Poudre 1kg', 750, 100, 20),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lait Concentré Sucré', 600, 80, 15),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Savon de Marseille', 500, 50, 10),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Thé Vert Boîte', 1200, 30, 5)
on conflict do nothing;

-- 5. ABONNEMENT actif pour chaque gérant, pour ne pas bloquer les écrans derrière le paywall en local
insert into public.subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at, is_trial) values
  ('22222222-2222-2222-2222-222222222222', 'pro', 'active', 'admin', 5900, 5900, now(), now() + interval '1 year', false),
  ('33333333-3333-3333-3333-333333333333', 'pro', 'active', 'admin', 5900, 5900, now(), now() + interval '1 year', false)
on conflict do nothing;

COMMIT;
