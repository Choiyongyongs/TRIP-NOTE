/**
 * ============================================================
 * TRIP NOTE 프라이빗 보안 & 지인 전용 공유 링크 서비스
 * - 1. 외부인 무단 접속 차단 (마스터 비밀번호 잠금 게이트)
 * - 2. 개별 여행 플랜 전용 보안 공유 링크 생성 (?trip=ID&k=보안키)
 * - 3. 지인 공유 링크 접속 시 해당 플랜만 열람 허용 (타 개인 플랜 열람/삭제 차단)
 * ============================================================
 */

const OWNER_AUTH_STORAGE_KEY = 'tripnote-owner-auth-v1'
const OWNER_PASSCODE_STORAGE_KEY = 'tripnote-owner-passcode-v1'
const AUTHORIZED_TRIPS_STORAGE_KEY = 'tripnote-authorized-trips-v1'

// 초기 기본 비밀번호 (상단 '🔒 보안 설정'에서 언제든 변경 가능)
export const DEFAULT_PASSCODE = '1234'

/**
 * 간단한 해시 생성기 (여행 ID 기반 고유 보안 공유 키 산출)
 */
export function generateDeterministicKey(str = '') {
  const input = `tripnote-private-salt-2026::${str}`
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `${hex1}${hex2}`.slice(0, 12)
}

/**
 * 특정 여행 플랜의 보안 공유 키 반환
 * - 플랜에 재발급된 customShareKey가 있으면 우선 사용, 없으면 ID 기반 고유 키 반환
 */
export function getTripShareKey(trip) {
  if (!trip) return ''
  if (trip.shareKey && typeof trip.shareKey === 'string') {
    return trip.shareKey
  }
  return generateDeterministicKey(String(trip.id || 'default'))
}

/**
 * 특정 여행 플랜의 지인 공유용 전체 URL 생성
 */
export function buildTripShareUrl(trip) {
  if (!trip || typeof window === 'undefined') return ''
  const shareKey = getTripShareKey(trip)
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('trip', String(trip.id))
  url.searchParams.set('k', shareKey)
  return url.toString()
}

/**
 * URL 쿼리 파라미터에서 공유 링크 정보(?trip=...&k=...) 추출
 */
export function getShareParamsFromUrl() {
  if (typeof window === 'undefined') return { tripId: null, shareKey: null }
  try {
    const params = new URLSearchParams(window.location.search)
    const tripId = params.get('trip')
    const shareKey = params.get('k')
    return {
      tripId: tripId ? tripId.trim() : null,
      shareKey: shareKey ? shareKey.trim() : null,
    }
  } catch {
    return { tripId: null, shareKey: null }
  }
}

/**
 * URL 쿼리 파라미터를 현재 선택된 플랜에 맞게 업데이트 (새로고침 시에도 유지)
 */
export function syncUrlWithTrip(trip) {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (trip && trip.id) {
      url.searchParams.set('trip', String(trip.id))
      url.searchParams.set('k', getTripShareKey(trip))
    } else {
      url.searchParams.delete('trip')
      url.searchParams.delete('k')
    }
    window.history.replaceState({}, '', url.toString())
  } catch {
    // ignore history errors
  }
}

/**
 * 현재 설정된 관리자 비밀번호 조회
 */
export function getStoredPasscode() {
  if (typeof window === 'undefined') return DEFAULT_PASSCODE
  try {
    const saved = localStorage.getItem(OWNER_PASSCODE_STORAGE_KEY)
    return saved && saved.trim() ? saved.trim() : DEFAULT_PASSCODE
  } catch {
    return DEFAULT_PASSCODE
  }
}

/**
 * 관리자 비밀번호 변경 저장
 */
export function setStoredPasscode(newPasscode) {
  if (typeof window === 'undefined') return
  const clean = String(newPasscode || '').trim()
  if (!clean) return
  try {
    localStorage.setItem(OWNER_PASSCODE_STORAGE_KEY, clean)
    // 새 비밀번호로 인증 상태도 함께 갱신
    localStorage.setItem(OWNER_AUTH_STORAGE_KEY, generateDeterministicKey(`auth::${clean}`))
  } catch {
    // ignore
  }
}

/**
 * 현재 기기가 관리자(본인) 인증되었는지 확인
 */
export function isOwnerAuthenticated(passcode = getStoredPasscode()) {
  if (typeof window === 'undefined') return false
  try {
    const token = localStorage.getItem(OWNER_AUTH_STORAGE_KEY)
    return token === generateDeterministicKey(`auth::${passcode}`)
  } catch {
    return false
  }
}

/**
 * 관리자 비밀번호 검증 및 기기 인증 저장
 */
export function verifyAndSaveOwnerAuth(inputPasscode, currentPasscode = getStoredPasscode(), rememberDevice = true) {
  const cleanInput = String(inputPasscode || '').trim()
  if (!cleanInput || cleanInput !== currentPasscode) {
    return false
  }
  try {
    if (rememberDevice) {
      localStorage.setItem(OWNER_AUTH_STORAGE_KEY, generateDeterministicKey(`auth::${currentPasscode}`))
    }
  } catch {
    // ignore
  }
  return true
}

/**
 * 관리자 기기 인증 해제 (즉시 잠금)
 */
export function clearOwnerAuth() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(OWNER_AUTH_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * 지인이 공유 링크(?trip=...&k=...)로 접속하여 인증된 플랜 ID 목록 관리
 */
export function getAuthorizedSharedTrips() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(AUTHORIZED_TRIPS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveAuthorizedSharedTrip(tripId, shareKey) {
  if (typeof window === 'undefined' || !tripId || !shareKey) return
  try {
    const cur = getAuthorizedSharedTrips()
    cur[tripId] = shareKey
    localStorage.setItem(AUTHORIZED_TRIPS_STORAGE_KEY, JSON.stringify(cur))
  } catch {
    // ignore
  }
}

export function isTripAuthorizedByShareKey(trip, candidateKey) {
  if (!trip) return false
  const validKey = getTripShareKey(trip)
  if (candidateKey && candidateKey === validKey) {
    return true
  }
  const savedMap = getAuthorizedSharedTrips()
  return savedMap[trip.id] === validKey
}

/**
 * 클립보드 복사 유틸리티 (모바일 인앱 브라우저·Safari·PC 완벽 호환)
 */
export async function copyTextToClipboard(text) {
  if (!text) return false
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback below
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.top = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textArea)
    return ok
  } catch {
    return false
  }
}

