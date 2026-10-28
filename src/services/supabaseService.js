/**
 * ============================================================
 * Supabase 클라우드 DB 실시간 연동 서비스 (REST API 기반)
 * - 별도 무거운 라이브러리 없이 Supabase PostgREST v1 직접 연동
 * - PC와 모바일, 동행자 간 여행 플랜(일정·체크리스트·가계부·정산) 자동 동기화
 * - 보안 설정(관리자 비밀번호)도 클라우드와 동기화하여 기기 간 일치 보장
 * - 오프라인 또는 테이블 미생성 시에도 localStorage 폴백으로 100% 무중단 동작
 * ============================================================
 */

import { setStoredPasscode } from './securityService'

const DEFAULT_SUPABASE_URL = 'https://jhmsrstydibdfsmjdrdf.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobXNyc3R5ZGliZGZzbWpkcmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTAwMTAsImV4cCI6MjEwODc4NjAxMH0.cIsqWSKolARgtIAHnau69JVk-tu7JSiBj8UlFzkwoAg'

export const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
)
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '')

export const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
).trim()

const REST_ENDPOINT = `${SUPABASE_URL}/rest/v1/trips`
const SECURITY_CONFIG_ID = '__security_config__'

function getHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

/**
 * 1. Supabase에서 전체 여행 플랜 목록 (+ 보안 설정) 불러오기
 * @returns {Promise<Array|null>} 성공 시 여행 배열, 테이블 미생성/오프라인 시 null
 */
export async function fetchTripsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  try {
    const res = await fetch(`${REST_ENDPOINT}?select=id,data,updated_at&order=updated_at.asc`, {
      method: 'GET',
      headers: getHeaders(),
    })

    if (!res.ok) {
      return null
    }

    const rows = await res.json()
    if (!Array.isArray(rows)) return null

    // 클라우드에 저장된 관리자 비밀번호 설정이 있으면 동기화
    const securityRow = rows.find((r) => r?.id === SECURITY_CONFIG_ID)
    if (securityRow?.data?.passcode) {
      try {
        localStorage.setItem('tripnote-owner-passcode-v1', String(securityRow.data.passcode))
      } catch {
        // ignore
      }
    }

    return rows
      .filter((r) => r?.id !== SECURITY_CONFIG_ID)
      .map((r) => (r?.data && typeof r.data === 'object' ? { ...r.data, id: r.id } : null))
      .filter(Boolean)
  } catch (err) {
    console.warn('Supabase 데이터 로드 실패 (로컬 저장소 사용):', err)
    return null
  }
}

/**
 * 2. 여행 플랜 전체 목록을 Supabase에 일괄 저장 (Upsert)
 */
export async function upsertTripsToSupabase(trips = []) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !Array.isArray(trips) || trips.length === 0) {
    return false
  }

  try {
    const payload = trips
      .filter((t) => t && t.id && t.id !== SECURITY_CONFIG_ID)
      .map((t) => ({
        id: String(t.id),
        data: t,
        updated_at: new Date().toISOString(),
      }))

    if (payload.length === 0) return false

    const res = await fetch(`${REST_ENDPOINT}?on_conflict=id`, {
      method: 'POST',
      headers: getHeaders({
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(payload),
    })

    return res.ok
  } catch (err) {
    console.warn('Supabase 자동 저장 실패:', err)
    return false
  }
}

/**
 * 3. 특정 여행 플랜 삭제 시 Supabase에서도 삭제
 */
export async function deleteTripFromSupabase(tripId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !tripId) return false

  try {
    const res = await fetch(`${REST_ENDPOINT}?id=eq.${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    return res.ok
  } catch (err) {
    console.warn('Supabase 플랜 삭제 실패:', err)
    return false
  }
}

/**
 * 4. 관리자 비밀번호 변경 시 Supabase 클라우드에도 동기화 저장
 */
export async function savePasscodeToSupabase(newPasscode) {
  const clean = String(newPasscode || '').trim()
  if (!clean) return false
  setStoredPasscode(clean)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true

  try {
    const res = await fetch(`${REST_ENDPOINT}?on_conflict=id`, {
      method: 'POST',
      headers: getHeaders({
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify([
        {
          id: SECURITY_CONFIG_ID,
          data: { isSystemConfig: true, passcode: clean },
          updated_at: new Date().toISOString(),
        },
      ]),
    })
    return res.ok
  } catch {
    return false
  }
}
