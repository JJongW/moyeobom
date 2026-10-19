-- 스터디 매칭보드 스키마 (PostgreSQL 14+ / Supabase)
-- 여러 번 실행해도 안전하도록 IF NOT EXISTS를 사용한다.

create extension if not exists pgcrypto;

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_nickname text not null,
  manage_secret_hash text not null,
  title text not null,
  category text not null,
  tags text[] not null default '{}',
  mode text not null check (mode in ('online','offline','hybrid')),
  region_sido text,
  region_sigungu text,
  online_tool text,
  days text[] not null,
  time_slots text[] not null,
  start_date date not null,
  duration_weeks int,               -- null = 정하지 않음
  capacity int not null check (capacity between 2 and 10),
  deadline date not null,
  level text,
  description text not null,
  contact_url text not null,
  status text not null default 'recruiting'
    check (status in ('recruiting','closed','finished','deleted','hidden')),
  status_before_hidden text,
  closed_reason text,
  report_count int not null default 0,
  created_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_status_created_idx on posts (status, created_at desc);
create index if not exists posts_deadline_idx on posts (deadline) where status = 'recruiting';

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  applicant_nickname text not null,
  message text not null,
  check_secret_hash text not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','not_selected','cancelled','removed','post_deleted')),
  reject_reason text,
  reason_visible boolean not null default false,
  decided_at timestamptz,
  created_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_post_idx on applications (post_id, status);
-- 같은 글 안에서 활성(대기·수락) 지원자의 닉네임은 겹칠 수 없다 (FR-001)
create unique index if not exists applications_active_nick_uq
  on applications (post_id, lower(applicant_nickname))
  where status in ('pending','accepted');

-- 브라우저 기억: 기기 쿠키(해시)가 어떤 글·지원의 주인인지 (FR-001, FR-011)
create table if not exists grants (
  id bigserial primary key,
  device_hash text not null,
  target_type text not null check (target_type in ('post','application')),
  target_id uuid not null,
  role text not null check (role in ('author','applicant')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (device_hash, target_type, target_id)
);
create index if not exists grants_target_idx on grants (target_type, target_id);

-- 새 소식 (FR-012)
create table if not exists news (
  id bigserial primary key,
  target_type text not null check (target_type in ('post','application')),
  target_id uuid not null,
  code text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists news_target_idx on news (target_type, target_id, created_at desc);

create table if not exists reports (
  id bigserial primary key,
  post_id uuid not null references posts(id) on delete cascade,
  reason text not null,
  memo text,
  reporter_ip_hash text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_ip_hash)
);

-- 요청 제한·비밀번호 실패 기록 (BR-017, NFR-004)
create table if not exists rate_events (
  id bigserial primary key,
  ip_hash text not null,
  kind text not null,
  scope text,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_idx on rate_events (kind, ip_hash, created_at desc);

create table if not exists events (
  id bigserial primary key,
  name text not null,
  anon_id text,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_name_idx on events (name, created_at desc);

-- Supabase의 자동 REST API(anon 키)로 테이블에 접근하지 못하도록 RLS를 켜고 정책은 만들지 않는다.
-- 앱은 DATABASE_URL(테이블 소유자 역할)로만 접속하므로 영향이 없다.
alter table posts enable row level security;
alter table applications enable row level security;
alter table grants enable row level security;
alter table news enable row level security;
alter table reports enable row level security;
alter table rate_events enable row level security;
alter table events enable row level security;
