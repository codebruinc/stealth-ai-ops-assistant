-- ======================================
-- 📊 feedback_patterns (Analysis of user feedback patterns)
-- ======================================
create table if not exists feedback_patterns (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid references summaries(id) on delete cascade,
  rating text, -- 'approved', 'edited', 'rejected'
  source text, -- 'slack', 'zendesk', 'harvest', 'email'
  pattern_type text, -- 'edit', 'rejection', 'approval'
  content text, -- original content
  user_edit text, -- user's edited version
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable Row-Level Security
alter table feedback_patterns enable row level security;

-- RLS Policy (Service Role Only)
create policy "Allow service access to feedback_patterns"
on feedback_patterns for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- ======================================
-- 📝 edit_analyses (Detailed analysis of edits)
-- ======================================
create table if not exists edit_analyses (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid references summaries(id) on delete cascade,
  original_length integer,
  edited_length integer,
  length_change_percent float,
  tone_change text,
  style_change text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable Row-Level Security
alter table edit_analyses enable row level security;

-- RLS Policy (Service Role Only)
create policy "Allow service access to edit_analyses"
on edit_analyses for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- ======================================
-- 📈 feedback_analytics (Analytics for feedback events)
-- ======================================
create table if not exists feedback_analytics (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid references summaries(id) on delete cascade,
  event_type text, -- 'approval', 'edit', 'rejection'
  source text, -- 'slack', 'zendesk', 'harvest', 'email'
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable Row-Level Security
alter table feedback_analytics enable row level security;

-- RLS Policy (Service Role Only)
create policy "Allow service access to feedback_analytics"
on feedback_analytics for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');