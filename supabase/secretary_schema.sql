-- ============================================================
-- 일상 비서 종합 대시보드 (/secretary) 전용 DB 스키마 & Storage 설정
-- 기존 여행 플래너 테이블(trips)과 완전히 격리된 secretary_ 접두사 사용
-- Supabase Dashboard > SQL Editor 에서 전체 복사 후 Run 실행
-- ============================================================

-- 1. 개인 및 육아(어린이집) 스케줄 테이블
CREATE TABLE IF NOT EXISTS public.secretary_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date DATE NOT NULL,
  schedule_time TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'personal', -- 'personal' | 'daycare' | 'supplies' | 'event'
  title TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secretary_schedules_date
  ON public.secretary_schedules (schedule_date, schedule_time);

-- 2. 어린이집 월간 식단표 파싱 저장 테이블 (날짜별 1건 Upsert)
CREATE TABLE IF NOT EXISTS public.secretary_meals (
  meal_date DATE PRIMARY KEY,
  lunch_menu TEXT[] NOT NULL DEFAULT '{}',
  morning_snack TEXT NOT NULL DEFAULT '',
  afternoon_snack TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  source_file_path TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 일자별 AI 종합 브리핑 캐시 테이블 (429 에러 방지 & 즉시 조회)
CREATE TABLE IF NOT EXISTS public.secretary_briefings (
  briefing_date DATE PRIMARY KEY,
  weather_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  economy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_briefing_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_used TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 설정
-- 기존 프로젝트(trips 테이블)의 프라이빗 비밀번호 게이트 + anon 키 연동 방식과 동일하게 구성
-- ============================================================
ALTER TABLE public.secretary_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on secretary_schedules" ON public.secretary_schedules;
CREATE POLICY "Allow all on secretary_schedules"
  ON public.secretary_schedules
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on secretary_meals" ON public.secretary_meals;
CREATE POLICY "Allow all on secretary_meals"
  ON public.secretary_meals
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on secretary_briefings" ON public.secretary_briefings;
CREATE POLICY "Allow all on secretary_briefings"
  ON public.secretary_briefings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Storage 버킷: secretary-meals (어린이집 식단표 이미지/PDF 업로드용)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('secretary-meals', 'secretary-meals', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow upload and read secretary-meals" ON storage.objects;
CREATE POLICY "Allow upload and read secretary-meals"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'secretary-meals')
  WITH CHECK (bucket_id = 'secretary-meals');
