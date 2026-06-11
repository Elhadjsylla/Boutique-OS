-- supabase/migrations/0001_init.sql
-- Migration initiale : BoutikOS public schema, tables, triggers, indexes et RLS

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. UPDATED_AT TRIGGER FUNCTION
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- 3. TABLES CREATION

-- Boutiques
create table if not exists public.boutiques (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    adresse text,
    gerant_id uuid, -- link to auth.users (profile id)
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Profils (Linked to Supabase auth.users)
create table if not exists public.profils (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('caissier', 'gerant', 'super_admin')),
    boutique_id uuid references public.boutiques(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Foreign key in boutiques pointing to public.profils.id (optional but secure)
-- We can add a constraint, but it's simpler to keep gerant_id as a standard uuid reference
alter table public.boutiques drop constraint if exists fk_boutiques_gerant;
alter table public.boutiques add constraint fk_boutiques_gerant foreign key (gerant_id) references public.profils(id) on delete set null;

-- Produits
create table if not exists public.produits (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references public.boutiques(id) on delete cascade,
    nom text not null,
    prix numeric not null check (prix > 0), -- Constraint: prix > 0
    quantite integer not null default 0 check (quantite >= 0), -- Constraint: quantite >= 0
    seuil_alerte integer not null default 5 check (seuil_alerte >= 0), -- Constraint: seuil_alerte >= 0
    archive boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Ventes
create table if not exists public.ventes (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references public.boutiques(id) on delete cascade,
    caissier_id uuid not null references auth.users(id),
    total numeric not null default 0 check (total >= 0), -- Constraint: montants >= 0
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Vente Items
create table if not exists public.vente_items (
    id uuid primary key default gen_random_uuid(),
    vente_id uuid not null references public.ventes(id) on delete cascade,
    produit_id uuid not null references public.produits(id) on delete restrict,
    quantite integer not null check (quantite > 0),
    prix_unitaire numeric not null check (prix_unitaire >= 0), -- Constraint: montants >= 0
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Ardoises (Dettes clients)
create table if not exists public.ardoises (
    id uuid primary key default gen_random_uuid(),
    boutique_id uuid not null references public.boutiques(id) on delete cascade,
    client_nom text not null,
    montant_total numeric not null default 0 check (montant_total >= 0), -- Constraint: montants >= 0
    statut text not null check (statut in ('en_cours', 'soldee')), -- Constraint: status ('en_cours', 'soldee')
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Ardoise Paiements
create table if not exists public.ardoise_paiements (
    id uuid primary key default gen_random_uuid(),
    ardoise_id uuid not null references public.ardoises(id) on delete cascade,
    montant numeric not null check (montant >= 0), -- Constraint: montants >= 0
    paid_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4. ATTACH UPDATED_AT TRIGGERS TO EACH TABLE
drop trigger if exists set_updated_at on public.boutiques;
create trigger set_updated_at before update on public.boutiques
    for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at on public.profils;
create trigger set_updated_at before update on public.profils
    for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at on public.produits;
create trigger set_updated_at before update on public.produits
    for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at on public.ventes;
create trigger set_updated_at before update on public.ventes
    for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at on public.vente_items;
create trigger set_updated_at before update on public.vente_items
    for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at on public.ardoises;
create trigger set_updated_at before update on public.ardoises
    for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at on public.ardoise_paiements;
create trigger set_updated_at before update on public.ardoise_paiements
    for each row execute procedure public.set_current_timestamp_updated_at();

-- 5. PERFORMANCE INDEXES (On Foreign Keys and boutique_id)
create index if not exists idx_profils_boutique_id on public.profils(boutique_id);
create index if not exists idx_produits_boutique_id on public.produits(boutique_id);
create index if not exists idx_ventes_boutique_id on public.ventes(boutique_id);
create index if not exists idx_ventes_caissier_id on public.ventes(caissier_id);
create index if not exists idx_vente_items_vente_id on public.vente_items(vente_id);
create index if not exists idx_vente_items_produit_id on public.vente_items(produit_id);
create index if not exists idx_ardoises_boutique_id on public.ardoises(boutique_id);
create index if not exists idx_ardoise_paiements_ardoise_id on public.ardoise_paiements(ardoise_id);

-- 6. SECURITY FUNCTIONS (RLS Helpers)
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

-- 7. TRIGGER FOR AUTH -> PUBLIC.PROFILS SYNCHRONIZATION
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES

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

-- Policies for ARDOISES
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

-- Policies for ARDOISE_PAIEMENTS
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
