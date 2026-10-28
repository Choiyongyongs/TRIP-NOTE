-- ============================================================
-- [TRIP NOTE · 여행 플래너] Supabase 데이터베이스 초기 설정 SQL
-- 사용법: Supabase 대시보드 좌측 메뉴 [SQL Editor] -> [New query] 클릭 후
-- 아래 내용을 전체 복사해서 붙여넣고 우측 하단 [Run] 버튼을 누르세요!
-- ============================================================

create table if not exists public.trips (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- 누구나 링크로 접속해 여행 플랜을 조회/생성/수정/삭제할 수 있도록 권한 허용
alter table public.trips enable row level security;

drop policy if exists "Allow public access to trips" on public.trips;
create policy "Allow public access to trips"
  on public.trips
  for all
  to anon, authenticated
  using (true)
  with check (true);

