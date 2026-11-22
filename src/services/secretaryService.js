/**
 * ============================================================
 * 일상 비서 종합 대시보드 (/secretary) 전용 Supabase 연동 서비스
 * - 기존 여행 플래너 테이블(trips)과 완전히 격리된 secretary_* 테이블만 사용
 * - 평소 조회 시에는 Supabase DB 캐시(secretary_briefings)에서 즉시 로드하여
 *   Gemini 무료 티어 429 한도 초과를 방지
 * - 외부 API(Gemini, 날씨, 경제 RSS)는 반드시 Supabase Edge Functions에서만 실행
 * ============================================================
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseService'

function getHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export function getTodayKstString() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

// ============================================================
// 1. 종합 AI 브리핑 캐시 조회 & Edge Function 실행
// ============================================================

/**
 * DB(secretary_briefings)에 저장된 날짜별 캐시 브리핑 조회 (Edge Function 미호출)
 */
export async function fetchCachedBriefing(dateStr) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_briefings?briefing_date=eq.${encodeURIComponent(dateStr)}&select=*`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`브리핑 조회 실패 (${res.status}): ${text || '테이블 생성 여부를 확인하세요.'}`)
  }

  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

/**
 * Supabase Edge Function (secretary-briefing) 호출하여 AI 종합 브리핑 생성/갱신
 */
export async function generateBriefingViaEdge(dateStr, { force = false } = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/secretary-briefing`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ date: dateStr, force }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || `브리핑 생성 실패 (${res.status})`)
  }
  return payload
}

// ============================================================
// 2. 개인 · 육아 스케줄 CRUD (secretary_schedules)
// ============================================================

export async function fetchSchedulesByDate(dateStr) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_schedules?schedule_date=eq.${encodeURIComponent(
      dateStr
    )}&order=schedule_time.asc,created_at.asc&select=*`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  )

  if (!res.ok) {
    throw new Error(`일정 조회 실패 (${res.status})`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

export async function fetchUpcomingSchedules(fromDateStr, limit = 15) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_schedules?schedule_date=gte.${encodeURIComponent(
      fromDateStr
    )}&order=schedule_date.asc,schedule_time.asc&limit=${limit}&select=*`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  )

  if (!res.ok) {
    throw new Error(`예정 일정 조회 실패 (${res.status})`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

export async function addScheduleItem({ schedule_date, schedule_time = '', category = 'personal', title, memo = '' }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/secretary_schedules`, {
    method: 'POST',
    headers: getHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify([
      {
        schedule_date,
        schedule_time: schedule_time.trim(),
        category,
        title: title.trim(),
        memo: memo.trim(),
        is_done: false,
      },
    ]),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`일정 등록 실패 (${res.status}): ${text}`)
  }
  const rows = await res.json()
  return rows?.[0] || null
}

export async function toggleScheduleDone(id, isDone) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_schedules?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: getHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ is_done: Boolean(isDone) }),
    }
  )
  if (!res.ok) {
    throw new Error(`일정 상태 변경 실패 (${res.status})`)
  }
  const rows = await res.json()
  return rows?.[0] || null
}

export async function deleteScheduleItem(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_schedules?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
    }
  )
  if (!res.ok) {
    throw new Error(`일정 삭제 실패 (${res.status})`)
  }
  return true
}

// ============================================================
// 3. 어린이집 식단표 조회 + Storage 업로드 + Edge Function 파싱
// ============================================================

export async function fetchMealByDate(dateStr) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_meals?meal_date=eq.${encodeURIComponent(dateStr)}&select=*`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  )
  if (!res.ok) {
    throw new Error(`식단 조회 실패 (${res.status})`)
  }
  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

export async function fetchMealsByMonth(yearMonth) {
  const start = `${yearMonth}-01`
  const [y, m] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/secretary_meals?meal_date=gte.${start}&meal_date=lte.${end}&order=meal_date.asc&select=*`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  )
  if (!res.ok) return []
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

/**
 * 1) Supabase Storage (secretary-meals)에 이미지/PDF 업로드
 * 2) Edge Function (secretary-parse-meal) 호출하여 월간 식단표 자동 추출 및 DB 저장
 */
export async function uploadAndParseMealFile(file, yearMonth) {
  if (!file) throw new Error('업로드할 식단표 파일을 선택해주세요.')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeName = `${yearMonth}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  // 1. Storage 업로드
  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/secretary-meals/${safeName}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    }
  )

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '')
    throw new Error(`식단표 업로드 실패 (${uploadRes.status}): ${errText}`)
  }

  // 2. Edge Function 멀티모달 파싱 호출
  const parseRes = await fetch(`${SUPABASE_URL}/functions/v1/secretary-parse-meal`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filePath: safeName,
      mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      yearMonth,
    }),
  })

  const payload = await parseRes.json().catch(() => ({}))
  if (!parseRes.ok) {
    throw new Error(payload?.error || `식단표 AI 분석 실패 (${parseRes.status})`)
  }
  return payload
}
