-- 재고밸런스 마스터 랭킹 테이블
-- 이 프로젝트는 로컬 Supabase나 CLI 마이그레이션을 쓰지 않으므로, Supabase 대시보드의
-- SQL Editor에 이 파일 내용을 붙여넣고 한 번 실행해서 만든다.

create table if not exists public.game_rankings (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  score integer not null check (score between 0 and 100),
  period_weeks integer not null,
  created_at timestamptz not null default now()
);

alter table public.game_rankings enable row level security;

-- 이 게임은 로그인 없이(Auth 미사용) 누구나 자기 점수를 등록하고 전체 순위를 볼 수 있는
-- 공개 랭킹판이라, 소유자 전용이 아니라 익명(anon) 등록·조회를 모두 허용한다.
create policy "누구나 점수를 등록할 수 있음"
  on public.game_rankings for insert
  to anon
  with check (true);

create policy "누구나 순위를 조회할 수 있음"
  on public.game_rankings for select
  to anon
  using (true);
