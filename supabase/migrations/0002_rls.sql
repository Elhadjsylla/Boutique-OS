-- supabase/migrations/0002_rls.sql
-- Migration : Custom Access Token Hook & Hardened RLS Policies using JWT claims

-- 1. DROP OLD RLS POLICIES (if they exist)
drop policy if exists "Users can view their own boutique" on public.boutiques;
drop policy if exists "Only super_admin can create boutiques" on public.boutiques;
drop policy if exists "gerant and super_admin can update their boutique" on public.boutiques;
drop policy if exists "Only super_admin can delete boutiques" on public.boutiques;

drop policy if exists "Users can view profiles in their boutique" on public.profils;
drop policy if exists "gerant and super_admin can insert profiles" on public.profils;
drop policy if exists "Users can update their own profile, gerant and super_admin can update boutique profiles" on public.profils;
drop policy if exists "gerant and super_admin can delete profiles" on public.profils;

drop policy if exists "Users can view products of their boutique" on public.produits;
drop policy if exists "gerant and super_admin can insert products" on public.produits;
drop policy if exists "gerant and super_admin can update products" on public.produits;
drop policy if exists "gerant and super_admin can delete products" on public.produits;

drop policy if exists "Users can view sales of their boutique" on public.ventes;
drop policy if exists "caissier, gerant and super_admin can insert sales" on public.ventes;

drop policy if exists "Users can view sale items of their boutique" on public.vente_items;
drop policy if exists "Users can insert sale items of their boutique" on public.vente_items;

drop policy if exists "gerant and super_admin can view ardoises" on public.ardoises;
drop policy if exists "gerant and super_admin can insert ardoises" on public.ardoises;
drop policy if exists "gerant-and-super_admin-can-update-ardoises" on public.ardoises;
drop policy if exists "gerant and super_admin can update ardoises" on public.ardoises;
drop policy if exists "gerant and super_admin can delete ardoises" on public.ardoises;

drop policy if exists "gerant and super_admin can view payments" on public.ardoise_paiements;
drop policy if exists "gerant and super_admin can insert payments" on public.ardoise_paiements;
drop policy if exists "gerant and super_admin can update payments" on public.ardoise_paiements;
drop policy if exists "gerant and super_admin can delete payments" on public.ardoise_paiements;


-- 2. CREATE AUTH CUSTOM ACCESS TOKEN HOOK (JWT Custom Claims) IN PUBLIC SCHEMA
-- (Defined in public schema to avoid auth schema permission denied error)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  claims jsonb;
  user_role text;
  user_boutique_id uuid;
begin
  -- Retrieve profile information from public schema
  select role, boutique_id into user_role, user_boutique_id
  from public.profils
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Add role and boutique_id to the claims
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

-- Grant execution permission to the auth admin role
grant execute on function public.custom_access_token_hook to supabase_auth_admin;


-- 3. ENFORCE RLS ON ALL TABLES
alter table public.boutiques enable row level security;
alter table public.profils enable row level security;
alter table public.produits enable row level security;
alter table public.ventes enable row level security;
alter table public.vente_items enable row level security;
alter table public.ardoises enable row level security;
alter table public.ardoise_paiements enable row level security;


-- 4. BOUTIQUES POLICIES
create policy "Select boutique"
    on public.boutiques for select
    using (id = (auth.jwt() ->> 'boutique_id')::uuid or coalesce(auth.jwt() ->> 'role', '') = 'super_admin');

create policy "Insert boutique"
    on public.boutiques for insert
    with check (coalesce(auth.jwt() ->> 'role', '') = 'super_admin');

create policy "Update boutique"
    on public.boutiques for update
    using ((id = (auth.jwt() ->> 'boutique_id')::uuid and coalesce(auth.jwt() ->> 'role', '') = 'gerant') or coalesce(auth.jwt() ->> 'role', '') = 'super_admin');

create policy "Delete boutique"
    on public.boutiques for delete
    using (coalesce(auth.jwt() ->> 'role', '') = 'super_admin');


-- 5. PROFILS POLICIES
create policy "Select profiles"
    on public.profils for select
    using (id = auth.uid() or boutique_id = (auth.jwt() ->> 'boutique_id')::uuid or coalesce(auth.jwt() ->> 'role', '') = 'super_admin');

create policy "Insert profiles"
    on public.profils for insert
    with check (
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin' or 
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid)
    );

create policy "Update profiles"
    on public.profils for update
    using (
        id = auth.uid() or 
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Delete profiles"
    on public.profils for delete
    using (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid and id <> auth.uid()) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );


-- 6. PRODUITS POLICIES
create policy "Select products"
    on public.produits for select
    using (boutique_id = (auth.jwt() ->> 'boutique_id')::uuid or coalesce(auth.jwt() ->> 'role', '') = 'super_admin');

create policy "Insert products"
    on public.produits for insert
    with check (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Update products"
    on public.produits for update
    using (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Delete products"
    on public.produits for delete
    using (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );


-- 7. VENTES POLICIES
create policy "Select sales"
    on public.ventes for select
    using (
        (boutique_id = (auth.jwt() ->> 'boutique_id')::uuid and coalesce(auth.jwt() ->> 'role', '') in ('caissier', 'gerant')) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Insert sales"
    on public.ventes for insert
    with check (
        (coalesce(auth.jwt() ->> 'role', '') in ('caissier', 'gerant') and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );


-- 8. VENTE_ITEMS POLICIES
create policy "Select sale items"
    on public.vente_items for select
    using (
        exists (
            select 1 from public.ventes 
            where ventes.id = vente_items.vente_id 
            and (ventes.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid or coalesce(auth.jwt() ->> 'role', '') = 'super_admin')
        )
    );

create policy "Insert sale items"
    on public.vente_items for insert
    with check (
        exists (
            select 1 from public.ventes 
            where ventes.id = vente_items.vente_id 
            and (
                (coalesce(auth.jwt() ->> 'role', '') in ('caissier', 'gerant') and ventes.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) 
                or coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
            )
        )
    );


-- 9. ARDOISES POLICIES (Caissier has absolutely no access)
create policy "Select ardoises"
    on public.ardoises for select
    using (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Insert ardoises"
    on public.ardoises for insert
    with check (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Update ardoises"
    on public.ardoises for update
    using (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );

create policy "Delete ardoises"
    on public.ardoises for delete
    using (
        (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
        coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
    );


-- 10. ARDOISE_PAIEMENTS POLICIES (Caissier has absolutely no access)
create policy "Select ardoise payments"
    on public.ardoise_paiements for select
    using (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and ardoises.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
                coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
            )
        )
    );

create policy "Insert ardoise payments"
    on public.ardoise_paiements for insert
    with check (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and ardoises.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
                coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
            )
        )
    );

create policy "Update ardoise payments"
    on public.ardoise_paiements for update
    using (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and ardoises.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
                coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
            )
        )
    );

create policy "Delete ardoise payments"
    on public.ardoise_paiements for delete
    using (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (coalesce(auth.jwt() ->> 'role', '') = 'gerant' and ardoises.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid) or 
                coalesce(auth.jwt() ->> 'role', '') = 'super_admin'
            )
        )
    );
