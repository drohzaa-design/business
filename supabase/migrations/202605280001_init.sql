create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null default 'general',
  color text,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index businesses_user_slug_key on public.businesses(user_id, slug);

create table public.projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, status text not null default 'active', budget_amount numeric(14,2), target_revenue numeric(14,2),
  customer_name text, location text, start_date date, end_date date, notes text, metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, type text not null default 'cash', initial_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0, is_active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null, type text not null check (type in ('income','expense')),
  is_default boolean not null default false, sort_order int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid not null references public.categories(id),
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0), transaction_date date not null,
  status text not null check (status in ('paid','pending','cancelled')) default 'paid', payment_method text,
  contact_name text, note text, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  file_name text not null, file_url text not null, file_type text, created_at timestamptz default now()
);

create index idx_tx_user on public.transactions(user_id);
create index idx_tx_business on public.transactions(business_id);
create index idx_tx_project on public.transactions(project_id);
create index idx_tx_date on public.transactions(transaction_date);
create index idx_tx_type on public.transactions(type);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.projects enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.attachments enable row level security;

create policy "own rows" on public.businesses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.attachments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.seed_default_data_for_user(p_user_id uuid)
returns void language plpgsql security definer as $$
declare solar_id uuid; home_id uuid;
begin
  insert into public.businesses(user_id,name,slug,type,color,icon) values
  (p_user_id,'Solar Cell','solar-cell','solar','#16a34a','sun'),
  (p_user_id,'รีโนเวทบ้านมือสอง','second-hand-home-renovation','renovation','#0ea5e9','home')
  returning id into solar_id;

  select id into home_id from public.businesses where user_id=p_user_id and slug='second-hand-home-renovation';

  insert into public.accounts(user_id,name,type,is_active) values (p_user_id,'เงินสด / บัญชีหลัก','cash',true);
end $$;
