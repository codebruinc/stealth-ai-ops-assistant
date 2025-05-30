-- ======================================
-- 📦 Supabase Schema for AI Assistant MVP
-- ======================================

-- ======================================
-- 📝 summaries (AI output logs)
-- ======================================
create table if not exists summaries (
  id uuid primary key default gen_random_uuid(),
  source text, -- 'slack' | 'zendesk' | 'harvest'
  summary text,
  action_items text[],
  suggested_messages jsonb,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ======================================
-- 💬 feedback (User feedback on suggestions)
-- ======================================
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid references summaries(id) on delete cascade,
  rating text, -- 'approved', 'edited', 'rejected'
  comment text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ======================================
-- 👤 clients (Profile + context memory)
-- ======================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text,
  profile jsonb, -- any custom traits, flags, etc.
  last_mentioned timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ======================================
-- 🔐 Enable Row-Level Security
-- ======================================
alter table summaries enable row level security;
alter table feedback enable row level security;
alter table clients enable row level security;

-- ======================================
-- 🔐 RLS Policies (Service Role Only)
-- ======================================
create policy "Allow service access to summaries"
on summaries for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Allow service access to feedback"
on feedback for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Allow service access to clients"
on clients for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
