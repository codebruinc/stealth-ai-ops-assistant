-- ======================================
-- 📥 Supabase Table: emails
-- ======================================

create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  thread_id text,
  message_id text,
  sender text,
  subject text,
  snippet text,
  full_body text,
  received_at timestamp with time zone,
  is_read boolean default false,
  suggested_reply text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable Row Level Security
alter table emails enable row level security;

-- RLS: Allow only service role to access
create policy "Allow service access to emails"
on emails for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');