-- ======================================
-- 📤 replies (Stored outgoing messages)
-- ======================================
create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  service text, -- 'slack', 'zendesk', 'email'
  message text,
  recipient text,
  thread_id text,
  ticket_id text,
  email_id text,
  status text, -- 'pending', 'ready', 'sent'
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable Row-Level Security
alter table replies enable row level security;

-- RLS Policy (Service Role Only)
create policy "Allow service access to replies"
on replies for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');