-- 0022_fix_rls_update.sql
-- Add WITH CHECK clauses to UPDATE policies to prevent privilege escalation / data reassignment

-- Boutiques
drop policy if exists "gerant and super_admin can update their boutique" on public.boutiques;
create policy "gerant and super_admin can update their boutique"
    on public.boutiques for update
    using ((id = public.get_my_boutique_id() and public.get_my_role() = 'gerant') or public.get_my_role() = 'super_admin')
    with check ((id = public.get_my_boutique_id() and public.get_my_role() = 'gerant') or public.get_my_role() = 'super_admin');

-- Profils
drop policy if exists "Users can update their own profile, gerant and super_admin can update boutique profiles" on public.profils;
create policy "Users can update their own profile, gerant and super_admin can update boutique profiles"
    on public.profils for update
    using (
        id = auth.uid() or 
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    )
    with check (
        id = auth.uid() or 
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

-- Produits
drop policy if exists "gerant and super_admin can update products" on public.produits;
create policy "gerant and super_admin can update products"
    on public.produits for update
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    )
    with check (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

-- Ardoises
drop policy if exists "gerant and super_admin can update ardoises" on public.ardoises;
create policy "gerant and super_admin can update ardoises"
    on public.ardoises for update
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    )
    with check (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

-- Ardoise Paiements
drop policy if exists "gerant and super_admin can update payments" on public.ardoise_paiements;
create policy "gerant and super_admin can update payments"
    on public.ardoise_paiements for update
    using (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (public.get_my_role() = 'gerant' and ardoises.boutique_id = public.get_my_boutique_id()) or 
                public.get_my_role() = 'super_admin'
            )
        )
    )
    with check (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (public.get_my_role() = 'gerant' and ardoises.boutique_id = public.get_my_boutique_id()) or 
                public.get_my_role() = 'super_admin'
            )
        )
    );
