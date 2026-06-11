-- 20260611000000_init_schema.sql
-- BoutikOS Database Init Migration

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLES CREATION

-- Boutiques
create table public.boutiques (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    adresse text,
    gerant_id uuid, -- Reference to auth.users (will be linked via FK or kept as UUID)
    created_at timestamptz not null default now()
);

-- Profils (Linked to Supabase auth.users)
create table public.profils (
    id uuid primary key,
    role text not null check (role in ('caissier', 'gerant', 'super_admin')),
    boutique_id uuid references public.boutiques(id) on delete set null,
    created_at timestamptz not null default now()
);

-- Foreign key check for boutiques.gerant_id pointing to auth.users
-- Since auth.users is managed by Supabase, we add a foreign key from profils.id to auth.users.id
alter table public.profils add constraint fk_profils_auth_users foreign key (id) references auth.users(id) on delete cascade;

-- Produits
create table public.produits (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references public.boutiques(id) on delete cascade,
    nom text not null,
    prix numeric not null check (prix >= 0),
    quantite integer not null default 0 check (quantite >= 0),
    seuil_alerte integer not null default 5,
    archive boolean not null default false,
    created_at timestamptz not null default now()
);

-- Ventes
create table public.ventes (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references public.boutiques(id) on delete cascade,
    caissier_id uuid not null references auth.users(id),
    total numeric not null check (total >= 0),
    created_at timestamptz not null default now()
);

-- Vente Items
create table public.vente_items (
    id uuid primary key default gen_random_uuid(),
    vente_id uuid not null references public.ventes(id) on delete cascade,
    produit_id uuid not null references public.produits(id),
    quantite integer not null check (quantite > 0),
    prix_unitaire numeric not null check (prix_unitaire >= 0)
);

-- Ardoises (Dettes clients)
create table public.ardoises (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references public.boutiques(id) on delete cascade,
    client_nom text not null,
    montant_total numeric not null check (montant_total >= 0),
    statut text not null check (statut in ('non_paye', 'partiel', 'paye')),
    created_at timestamptz not null default now()
);

-- Ardoise Paiements
create table public.ardoise_paiements (
    id uuid primary key default gen_random_uuid(),
    ardoise_id uuid not null references public.ardoises(id) on delete cascade,
    montant numeric not null check (montant > 0),
    paid_at timestamptz not null default now()
);

-- 3. INDEXES FOR PERFORMANCE
create index idx_profils_boutique on public.profils(boutique_id);
create index idx_produits_boutique on public.produits(boutique_id);
create index idx_ventes_boutique on public.ventes(boutique_id);
create index idx_ventes_created_at on public.ventes(created_at);
create index idx_vente_items_vente on public.vente_items(vente_id);
create index idx_ardoises_boutique on public.ardoises(boutique_id);
create index idx_ardoise_paiements_ardoise on public.ardoise_paiements(ardoise_id);

-- 4. UTILITY SECURITY FUNCTIONS (Avoids policy recursion on public.profils)
create or replace function public.get_my_role()
returns text
language sql security definer
stable
as $$
  select role from public.profils where id = auth.uid();
$$;

create or replace function public.get_my_boutique_id()
returns uuid
language sql security definer
stable
as $$
  select boutique_id from public.profils where id = auth.uid();
$$;

-- 5. TRIGGER FOR AUTO-CREATING USER PROFILES
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profils (id, role, boutique_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'caissier'),
    case 
      when new.raw_user_meta_data->>'boutique_id' is not null 
      then (new.raw_user_meta_data->>'boutique_id')::uuid
      else null
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
alter table public.boutiques enable row level security;
alter table public.profils enable row level security;
alter table public.produits enable row level security;
alter table public.ventes enable row level security;
alter table public.vente_items enable row level security;
alter table public.ardoises enable row level security;
alter table public.ardoise_paiements enable row level security;

-- Policies for BOUTIQUES
create policy "Users can view their own boutique"
    on public.boutiques for select
    using (id = public.get_my_boutique_id() or public.get_my_role() = 'super_admin');

create policy "Only super_admin can create boutiques"
    on public.boutiques for insert
    with check (public.get_my_role() = 'super_admin');

create policy "gerant and super_admin can update their boutique"
    on public.boutiques for update
    using ((id = public.get_my_boutique_id() and public.get_my_role() = 'gerant') or public.get_my_role() = 'super_admin');

create policy "Only super_admin can delete boutiques"
    on public.boutiques for delete
    using (public.get_my_role() = 'super_admin');

-- Policies for PROFILS
create policy "Users can view profiles in their boutique"
    on public.profils for select
    using (id = auth.uid() or boutique_id = public.get_my_boutique_id() or public.get_my_role() = 'super_admin');

create policy "gerant and super_admin can insert profiles"
    on public.profils for insert
    with check (
        public.get_my_role() = 'super_admin' or 
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id())
    );

create policy "Users can update their own profile, gerant and super_admin can update boutique profiles"
    on public.profils for update
    using (
        id = auth.uid() or 
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

create policy "gerant and super_admin can delete profiles"
    on public.profils for delete
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id() and id <> auth.uid()) or 
        public.get_my_role() = 'super_admin'
    );

-- Policies for PRODUITS
create policy "Users can view products of their boutique"
    on public.produits for select
    using (boutique_id = public.get_my_boutique_id() or public.get_my_role() = 'super_admin');

create policy "gerant and super_admin can insert products"
    on public.produits for insert
    with check (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

create policy "gerant and super_admin can update products"
    on public.produits for update
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

create policy "gerant and super_admin can delete products"
    on public.produits for delete
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

-- Policies for VENTES
create policy "Users can view sales of their boutique"
    on public.ventes for select
    using (boutique_id = public.get_my_boutique_id() or public.get_my_role() = 'super_admin');

create policy "caissier, gerant and super_admin can insert sales"
    on public.ventes for insert
    with check (
        (public.get_my_role() in ('caissier', 'gerant') and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

-- Note: No update/delete allowed on sales for security/traceability.

-- Policies for VENTE_ITEMS
create policy "Users can view sale items of their boutique"
    on public.vente_items for select
    using (
        exists (
            select 1 from public.ventes 
            where ventes.id = vente_items.vente_id 
            and (ventes.boutique_id = public.get_my_boutique_id() or public.get_my_role() = 'super_admin')
        )
    );

create policy "Users can insert sale items of their boutique"
    on public.vente_items for insert
    with check (
        exists (
            select 1 from public.ventes 
            where ventes.id = vente_items.vente_id 
            and (
                (public.get_my_role() in ('caissier', 'gerant') and ventes.boutique_id = public.get_my_boutique_id()) 
                or public.get_my_role() = 'super_admin'
            )
        )
    );

-- Note: No update/delete allowed on sale items for security/traceability.

-- Policies for ARDOISES (Caissier has no access to Ardoises)
create policy "gerant and super_admin can view ardoises"
    on public.ardoises for select
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

create policy "gerant and super_admin can insert ardoises"
    on public.ardoises for insert
    with check (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

create policy "gerant and super_admin can update ardoises"
    on public.ardoises for update
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

create policy "gerant and super_admin can delete ardoises"
    on public.ardoises for delete
    using (
        (public.get_my_role() = 'gerant' and boutique_id = public.get_my_boutique_id()) or 
        public.get_my_role() = 'super_admin'
    );

-- Policies for ARDOISE_PAIEMENTS (Caissier has no access to payments)
create policy "gerant and super_admin can view payments"
    on public.ardoise_paiements for select
    using (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (public.get_my_role() = 'gerant' and ardoises.boutique_id = public.get_my_boutique_id()) or 
                public.get_my_role() = 'super_admin'
            )
        )
    );

create policy "gerant and super_admin can insert payments"
    on public.ardoise_paiements for insert
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
    );

create policy "gerant and super_admin can delete payments"
    on public.ardoise_paiements for delete
    using (
        exists (
            select 1 from public.ardoises 
            where ardoises.id = ardoise_paiements.ardoise_id 
            and (
                (public.get_my_role() = 'gerant' and ardoises.boutique_id = public.get_my_boutique_id()) or 
                public.get_my_role() = 'super_admin'
            )
        )
    );
