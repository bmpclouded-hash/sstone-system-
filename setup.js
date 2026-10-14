// Superior Stone Pro — Database Setup
// Fill in your keys then run: node setup.js
const SUPABASE_URL         = "YOUR_SUPABASE_URL";
const SUPABASE_SERVICE_KEY = "YOUR_SUPABASE_SERVICE_KEY";

const https = require("https");

const SQL = `
create extension if not exists pgcrypto;

do $$ begin
  create type app_role as enum('operations_manager','estimator','project_manager','fabricator','installer','delivery_crew');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,org_id uuid not null references public.organizations(id) on delete cascade,full_name text not null,role app_role not null default 'delivery_crew',created_at timestamptz not null default now());

create or replace function public.current_org() returns uuid language sql stable security definer set search_path=public as $$ select org_id from public.profiles where id=auth.uid() $$;

create table if not exists public.categories(id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,name text not null,unique(org_id,name));

create table if not exists public.clients(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.materials(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  supplier text,
  unit text not null default 'sqft',
  low_threshold numeric not null default 700,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id,sku)
);

create table if not exists public.location_stock(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  location text not null default 'Charleston',
  stock numeric not null default 0,
  cost numeric not null default 0,
  unique(material_id,location)
);

create table if not exists public.slabs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  location text not null default 'Charleston',
  slab_number text not null,
  width numeric,
  height numeric,
  status text not null default 'In Stock',
  job_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.remnants(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  slab_id uuid references public.slabs(id),
  location text not null default 'Charleston',
  width numeric not null,
  height numeric not null,
  notes text,
  job_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id),
  name text not null,
  details text,
  status text not null default 'Scheduled',
  fab_status text not null default 'Queued',
  location text not null default 'Charleston',
  job_date date,
  job_time text,
  assigned_to uuid references public.profiles(id),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.job_materials(
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  required numeric not null default 0,
  notes text
);

create table if not exists public.job_photos(
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  file_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  supplier text,
  po_number text,
  order_date date,
  expected_date date,
  status text not null default 'Ordered',
  location text not null default 'Charleston',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.po_items(
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  material_id uuid references public.materials(id),
  material_name text not null,
  ordered_qty numeric not null default 0,
  received_qty numeric not null default 0,
  unit_cost numeric,
  received_at timestamptz
);

create table if not exists public.stock_transfers(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  from_location text not null,
  to_location text not null,
  qty numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id),
  job_id uuid references public.jobs(id),
  title text not null,
  status text not null default 'Draft',
  notes text,
  tax_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items(
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  material_id uuid references public.materials(id),
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  unit text not null default 'sqft'
);

create table if not exists public.activity_log(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.clients enable row level security;
alter table public.materials enable row level security;
alter table public.location_stock enable row level security;
alter table public.slabs enable row level security;
alter table public.remnants enable row level security;
alter table public.jobs enable row level security;
alter table public.job_materials enable row level security;
alter table public.job_photos enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_items enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.activity_log enable row level security;

do $$ begin create policy "org" on public.organizations for select using(id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.profiles for select using(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "upd" on public.profiles for update using(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.categories for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.clients for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.materials for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.location_stock for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.slabs for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.remnants for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.jobs for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.job_materials for all using(exists(select 1 from public.jobs j where j.id=job_id and j.org_id=public.current_org())) with check(exists(select 1 from public.jobs j where j.id=job_id and j.org_id=public.current_org())); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.job_photos for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.purchase_orders for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.po_items for all using(exists(select 1 from public.purchase_orders p where p.id=po_id and p.org_id=public.current_org())) with check(exists(select 1 from public.purchase_orders p where p.id=po_id and p.org_id=public.current_org())); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.stock_transfers for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.quotes for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.quote_items for all using(exists(select 1 from public.quotes q where q.id=quote_id and q.org_id=public.current_org())) with check(exists(select 1 from public.quotes q where q.id=quote_id and q.org_id=public.current_org())); exception when duplicate_object then null; end $$;
do $$ begin create policy "org" on public.activity_log for all using(org_id=public.current_org()) with check(org_id=public.current_org()); exception when duplicate_object then null; end $$;

create or replace function public.create_company(p_company text,p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare new_org uuid;
begin
  if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Already in a company'; end if;
  insert into public.organizations(name) values(p_company) returning id into new_org;
  insert into public.profiles(id,org_id,full_name,role) values(auth.uid(),new_org,p_name,'operations_manager');
  return new_org;
end $$;

create or replace function public.join_company(p_org uuid,p_name text) returns uuid language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Already in a company'; end if;
  if not exists(select 1 from public.organizations where id=p_org) then raise exception 'Invalid join code'; end if;
  insert into public.profiles(id,org_id,full_name,role) values(auth.uid(),p_org,p_name,'delivery_crew');
  return p_org;
end $$;

-- Storage bucket for job photos
insert into storage.buckets(id,name,public) values('job-photos','job-photos',false) on conflict(id) do nothing;
do $$ begin
  create policy "own photos read" on storage.objects for select using(bucket_id='job-photos' and (storage.foldername(name))[1]=auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own photos write" on storage.objects for insert with check(bucket_id='job-photos' and (storage.foldername(name))[1]=auth.uid()::text);
exception when duplicate_object then null; end $$;
`;

async function run() {
  if (SUPABASE_URL === "YOUR_SUPABASE_URL") {
    console.error("\n❌  Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY at the top of setup.js\n");
    process.exit(1);
  }
  const url = new URL(SUPABASE_URL);
  const ref = url.hostname.split(".")[0];
  console.log("\n🟧  Superior Stone Pro — Database Setup");
  console.log("📡  Project:", ref);
  console.log("📋  Creating tables...\n");

  await new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: SQL });
    const req = https.request({
      hostname: "api.supabase.com",
      path: `/v1/projects/${ref}/database/query`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_SERVICE_KEY, "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode < 300) { console.log("✅  All tables created!\n"); resolve(); }
        else { console.log("⚠️  Status:", res.statusCode, d.slice(0, 200)); resolve(); }
      });
    });
    req.on("error", reject); req.write(body); req.end();
  });

  console.log("─────────────────────────────────────────");
  console.log("✅  SETUP COMPLETE");
  console.log("─────────────────────────────────────────");
  console.log("\n1. Add your SUPABASE_URL and SUPABASE_ANON_KEY to public/js/config.js");
  console.log("2. Click Run in Replit");
  console.log("3. Create your account and company\n");
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
