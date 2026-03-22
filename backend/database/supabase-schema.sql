create table if not exists public.logs (
  id bigint generated always as identity primary key,
  event text not null,
  ip text,
  user_agent text,
  user_id text,
  user_name text,
  details text,
  category text not null default 'site',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.logs
  add column if not exists user_name text;

alter table public.logs
  add column if not exists details text;

alter table public.logs
  add column if not exists category text;

alter table public.logs
  alter column category set default 'site';

update public.logs
set category = case
  when event like 'ai_%'
    or event like 'player_%'
    or event = 'suspicious_player_command'
    or user_agent in ('backend-ai', 'backend-game')
  then 'game'
  else 'site'
end
where category is null or category = '';

create index if not exists idx_logs_event on public.logs (event);
create index if not exists idx_logs_category on public.logs (category);
create index if not exists idx_logs_created_at on public.logs (created_at desc);
create index if not exists idx_logs_ip on public.logs (ip);

create table if not exists public.game_scores (
  actor_id text not null,
  actor_type text not null,
  actor_name text,
  outfit_color text,
  current_score integer not null default 0,
  best_score integer not null default 0,
  deaths integer not null default 0,
  respawns integer not null default 0,
  last_death_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (actor_id, actor_type)
);

create index if not exists idx_game_scores_best_score
  on public.game_scores (best_score desc, updated_at desc);

create index if not exists idx_game_scores_actor_name
  on public.game_scores (actor_name);

alter table public.game_scores
  add column if not exists outfit_color text;

alter table public.game_scores
  add column if not exists soccer_goals integer not null default 0;

create index if not exists idx_game_scores_soccer_goals
  on public.game_scores (soccer_goals desc, updated_at desc);
