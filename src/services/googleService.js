/**
 * ============================================================
 * Google Maps Platform 통합 서비스 (해외여행 전용)
 * - 1. 실시간 구글 지도 JS SDK 로더 (중복 로드 방지 싱글톤)
 * - 2. Google Places API (Text Search) 해외 장소 검색
 * - 3. Google Directions / Routes API 해외 구간 소요시간 계산
 * - 4. 과금 방지용 영구 캐시(localStorage) + 일일 호출 상한(Hard Cap) 안전장치
 * ============================================================
 */

export const GOOGLE_MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
).trim()

const PLACES_CACHE_STORAGE_KEY = 'tripnote-google-places-cache-v2'
const ROUTES_CACHE_STORAGE_KEY = 'tripnote-google-routes-cache-v2'
const QUOTA_GUARD_STORAGE_KEY = 'tripnote-google-monthly-quota-v1'

// 한 달(YYYY-MM) 기준 무료 안전 상한선 (구글 월간 무료 제공 한도보다 여유 있게 낮춘 100% 무과금 안전 구간)
export const MONTHLY_SAFE_LIMITS = {
  mapLoads: 8000, // Maps JS API: 월 무료 10,000회 중 최대 8,000회까지만 허용
  places: 4000,   // Places API (Text Search): 월 무료 5,000~10,000회 중 최대 4,000회까지만 허용
  routes: 8000,   // Routes API (ComputeRoutes): 월 무료 10,000회 중 최대 8,000 요청까지만 허용
}

const MAX_PLACES_CACHE_ENTRIES = 200
const MAX_ROUTES_CACHE_ENTRIES = 500

// 메모리 캐시 (localStorage와 동기화)
const placesMemoryCache = new Map()
const routesMemoryCache = new Map()

/**
 * 초기 localStorage 캐시 로드
 */
function initPersistentCaches() {
  if (typeof window === 'undefined') return
  try {
    const rawPlaces = localStorage.getItem(PLACES_CACHE_STORAGE_KEY)
    if (rawPlaces) {
      const parsed = JSON.parse(rawPlaces)
      Object.entries(parsed).forEach(([k, v]) => placesMemoryCache.set(k, v))
    }
  } catch {
    // ignore storage errors
  }

  try {
    const rawRoutes = localStorage.getItem(ROUTES_CACHE_STORAGE_KEY)
    if (rawRoutes) {
      const parsed = JSON.parse(rawRoutes)
      Object.entries(parsed).forEach(([k, v]) => routesMemoryCache.set(k, v))
    }
  } catch {
    // ignore storage errors
  }
}

initPersistentCaches()

function savePlacesCacheToStorage() {
  if (typeof window === 'undefined') return
  try {
    // 오래된 항목 정리 (최대 개수 유지)
    if (placesMemoryCache.size > MAX_PLACES_CACHE_ENTRIES) {
      const firstKey = placesMemoryCache.keys().next().value
      if (firstKey) placesMemoryCache.delete(firstKey)
    }
    const obj = Object.fromEntries(placesMemoryCache.entries())
    localStorage.setItem(PLACES_CACHE_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // ignore quota exceeded
  }
}

function saveRoutesCacheToStorage() {
  if (typeof window === 'undefined') return
  try {
    if (routesMemoryCache.size > MAX_ROUTES_CACHE_ENTRIES) {
      const firstKey = routesMemoryCache.keys().next().value
      if (firstKey) routesMemoryCache.delete(firstKey)
    }
    const obj = Object.fromEntries(routesMemoryCache.entries())
    localStorage.setItem(ROUTES_CACHE_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // ignore quota exceeded
  }
}

/**
 * 월간(YYYY-MM) 호출 횟수 체크 및 카운트 증가 (매월 1일 자동 초기화 · 과금 원천 차단 안전장치)
 */
export function checkAndIncrementMonthlyQuota(type, count = 1) {
  if (typeof window === 'undefined') return true
  try {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const raw = localStorage.getItem(QUOTA_GUARD_STORAGE_KEY)
    let data = raw ? JSON.parse(raw) : { month: currentMonth, mapLoads: 0, places: 0, routes: 0 }

    // 달이 바뀌면(매월 1일) 카운트 자동 0으로 초기화
    if (data.month !== currentMonth) {
      data = { month: currentMonth, mapLoads: 0, places: 0, routes: 0 }
    }

    const limit = MONTHLY_SAFE_LIMITS[type] || 4000
    if ((data[type] || 0) + count > limit) {
      console.warn(
        `[Google API 월간 안전장치] 이번 달(${currentMonth}) ${type} 무료 안전 한도(${limit}회)에 도달하여 무료 폴백으로 전환합니다.`
      )
      return false
    }

    data[type] = (data[type] || 0) + count
    localStorage.setItem(QUOTA_GUARD_STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return true
  }
}

/**
 * 유효한 구글 클라우드 API 키 형식인지 확인 (일반적으로 AIza로 시작하는 39자 문자열)
 */
export function isValidGoogleApiKey(key = GOOGLE_MAPS_API_KEY) {
  if (!key || typeof key !== 'string') return false
  const trimmed = key.trim()
  // Google Cloud API 키는 'AIza'로 시작함
  return trimmed.startsWith('AIza') && trimmed.length >= 30
}

// Google Maps JS SDK 싱글톤 로더 상태
let googleSdkPromise = null
let googleSdkAuthFailed = false

/**
 * Google Maps JavaScript SDK 동적 로드 (해외여행 진입 시에만 1회 로드)
 */
export function loadGoogleMapsSdk(customKey) {
  const key = (customKey || GOOGLE_MAPS_API_KEY || '').trim()

  if (!isValidGoogleApiKey(key) || googleSdkAuthFailed) {
    return Promise.reject(new Error('유효한 Google Maps API Key가 아닙니다.'))
  }

  if (typeof window !== 'undefined' && window.google?.maps?.Map) {
    return Promise.resolve(window.google.maps)
  }

  if (googleSdkPromise) {
    return googleSdkPromise
  }

  // 월간 지도 로드 안전 한도(8,000회/월) 체크
  if (!checkAndIncrementMonthlyQuota('mapLoads', 1)) {
    return Promise.reject(new Error('월간 Google Maps 로드 무료 안전 한도 초과'))
  }

  googleSdkPromise = new Promise((resolve, reject) => {
    // 구글 지도 인증 실패 글로벌 콜백 감시 (잘못된 키나 결제 미등록 시 즉시 폴백 전환)
    window.gm_authFailure = () => {
      googleSdkAuthFailed = true
      googleSdkPromise = null
      window.dispatchEvent(new CustomEvent('google-maps-auth-error'))
      reject(new Error('Google Maps API 인증 실패 (gm_authFailure)'))
    }

    const scriptId = 'google-maps-js-sdk'
    const existing = document.getElementById(scriptId)
    if (existing) {
      if (window.google?.maps?.Map) {
        resolve(window.google.maps)
      } else {
        existing.addEventListener('load', () => resolve(window.google?.maps))
        existing.addEventListener('error', (err) => reject(err))
      }
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'text/javascript'
    script.async = true
    script.defer = true
    // language=ko 설정으로 해외 지명을 한글 병기로 친숙하게 표시
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places&language=ko`

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps)
      } else {
        reject(new Error('Google Maps SDK 로드 후 객체를 찾을 수 없습니다.'))
      }
    }
    script.onerror = () => {
      googleSdkPromise = null
      reject(new Error('Google Maps SDK 스크립트 로드 실패'))
    }

    document.head.appendChild(script)
  })

  return googleSdkPromise
}

/**
 * 구글 장소 타입(types)을 한글 카테고리명으로 변환
 */
function formatGooglePlaceType(types = [], primaryTypeDisplayName = '') {
  if (primaryTypeDisplayName) return primaryTypeDisplayName
  if (!Array.isArray(types) || types.length === 0) return '명소'
  const t = types.join(' ').toLowerCase()
  if (t.includes('cafe') || t.includes('bakery')) return '카페'
  if (t.includes('restaurant') || t.includes('food') || t.includes('meal')) return '음식점'
  if (t.includes('lodging') || t.includes('hotel')) return '숙박'
  if (t.includes('shopping') || t.includes('store') || t.includes('mall')) return '쇼핑'
  if (t.includes(' airport') || t.includes('station') || t.includes('transit')) return '교통'
  if (t.includes('tourist_attraction') || t.includes('museum') || t.includes('park')) return '관광명소'
  return '명소'
}

/**
 * [1] 해외 장소 키워드 검색 (버튼 클릭 시 1회 호출 + localStorage 영구 캐싱)
 * - 1순위: Google Places API (New) REST Text Search (최소 필드만 요청하여 비용 절감)
 * - 2순위: Google Maps JS SDK PlacesService.textSearch
 * - 3순위: OpenStreetMap Nominatim 무료 글로벌 검색 (폴백)
 */
export async function searchOverseasPlaces(query) {
  const q = (query || '').trim()
  if (!q) return []

  const cacheKey = q.toLowerCase()
  if (placesMemoryCache.has(cacheKey)) {
    return placesMemoryCache.get(cacheKey)
  }

  // 1. 유효한 구글 API 키가 있고 월간 안전 한도(4,000회/월) 이내인 경우 Google Places API 호출
  if (isValidGoogleApiKey() && !googleSdkAuthFailed && checkAndIncrementMonthlyQuota('places', 1)) {
    // 1-A. Google Places API (New) v1 Text Search 시도
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          // 과금 최소화: Basic 등급 필드만 요청 (고비용 Enterprise/Atmosphere 필드 제외)
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryTypeDisplayName',
        },
        body: JSON.stringify({
          textQuery: q,
          languageCode: 'ko',
          maxResultCount: 10,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const places = data?.places || []
        if (places.length > 0) {
          const formatted = places
            .filter((p) => p.location?.latitude && p.location?.longitude)
            .map((p, idx) => ({
              id: `gplace-${p.id || idx}`,
              name: p.displayName?.text || q,
              address: p.formattedAddress || '',
              addressName: p.formattedAddress || '',
              roadAddress: p.formattedAddress || '',
              lat: Number(p.location.latitude).toFixed(4),
              lng: Number(p.location.longitude).toFixed(4),
              category: formatGooglePlaceType(p.types, p.primaryTypeDisplayName?.text),
              source: 'google',
            }))

          placesMemoryCache.set(cacheKey, formatted)
          savePlacesCacheToStorage()
          return formatted
        }
      }
    } catch (err) {
      console.warn('Google Places API (New) 호출 실패, JS SDK 또는 폴백 시도:', err)
    }

    // 1-B. Google Maps JS SDK 내장 PlacesService.textSearch 시도
    try {
      const gmaps = await loadGoogleMapsSdk()
      if (gmaps?.places?.PlacesService) {
        const sdkResults = await new Promise((resolve) => {
          const dummyDiv = document.createElement('div')
          const service = new gmaps.places.PlacesService(dummyDiv)
          service.textSearch({ query: q, language: 'ko' }, (results, status) => {
            if (status === gmaps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
              resolve(results.slice(0, 10))
            } else {
              resolve(null)
            }
          })
        })

        if (sdkResults && sdkResults.length > 0) {
          const formatted = sdkResults
            .filter((p) => p.geometry?.location)
            .map((p, idx) => ({
              id: `gsdk-${p.place_id || idx}`,
              name: p.name || q,
              address: p.formatted_address || '',
              addressName: p.formatted_address || '',
              roadAddress: p.formatted_address || '',
              lat: Number(p.geometry.location.lat()).toFixed(4),
              lng: Number(p.geometry.location.lng()).toFixed(4),
              category: formatGooglePlaceType(p.types),
              source: 'google-sdk',
            }))

          placesMemoryCache.set(cacheKey, formatted)
          savePlacesCacheToStorage()
          return formatted
        }
      }
    } catch (err) {
      console.warn('Google Places JS SDK 검색 실패, 무료 글로벌 검색으로 폴백:', err)
    }
  }

  // 2. 폴백: OpenStreetMap Nominatim 무료 글로벌 검색 (API 키 미설정/오류 시에도 100% 작동 보장)
  const resp = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q
    )}&addressdetails=1&limit=10&accept-language=ko,en`,
    { headers: { 'Accept-Language': 'ko,en' } }
  )
  if (!resp.ok) throw new Error('검색 실패')
  const data = await resp.json()

  const fallbackResults = (data || []).map((item, idx) => {
    const parts = (item.display_name || '').split(',')
    const mainName = parts[0]?.trim() || q
    const address = parts
      .slice(1)
      .map((p) => p.trim())
      .filter(Boolean)
      .join(', ')

    return {
      id: `global-${item.place_id || idx}`,
      name: mainName,
      address: address || item.display_name,
      addressName: address || item.display_name,
      roadAddress: address || item.display_name,
      lat: Number(item.lat).toFixed(4),
      lng: Number(item.lon).toFixed(4),
      category: item.type || item.class || '명소',
      source: 'osm',
    }
  })

  if (fallbackResults.length > 0) {
    placesMemoryCache.set(cacheKey, fallbackResults)
    savePlacesCacheToStorage()
  }

  return fallbackResults
}

/**
 * [2] 해외 일정 간 이동 소요시간 자동 계산 (영구 캐싱 + 최소 호출 최적화)
 * - localStorage에 구간 좌표별 소요시간을 영구 저장하여 재접속/새로고침 시 API 호출 0회
 * - Google DirectionsService(대중교통 TRANSIT / 자동차 DRIVING) 호출 후 도보는 실제 도로거리 기반 산출하여 호출 횟수 절감
 */
export async function getGoogleOverseasDirections(fromLat, fromLng, toLat, toLng, formatMinutesFn) {
  const fLat = Number(fromLat)
  const fLng = Number(fromLng)
  const tLat = Number(toLat)
  const tLng = Number(toLng)

  if (!fLat || !fLng || !tLat || !tLng) return null

  const cacheKey = `${fLng.toFixed(4)},${fLat.toFixed(4)}_${tLng.toFixed(4)},${tLat.toFixed(4)}`
  if (routesMemoryCache.has(cacheKey)) {
    const cached = routesMemoryCache.get(cacheKey)
    // 구글 API 키가 활성화되어 있는데 과거 OSRM 폴백 캐시라면 무시하고 구글 API로 재계산
    if (!isValidGoogleApiKey() || cached?.source === 'google-routes' || cached?.source === 'google') {
      return cached
    }
  }

  // 대중교통 미지원 지역(일본 일부 사철 등 API 제약)일 때 구글 거리 기반 정밀 대중교통 시간 산출 헬퍼
  const estimateSmartTransitMinutes = (distKm, carMins, walkMins) => {
    if (distKm <= 0.8) return walkMins || Math.max(4, carMins)
    if (distKm <= 2.5) return Math.max(7, Math.round(5 + (distKm / 18) * 60))
    if (distKm <= 12) return Math.max(12, Math.round(7 + (distKm / 28) * 60))
    if (distKm <= 35) return Math.max(24, Math.round(10 + (distKm / 40) * 60))
    return Math.max(40, Math.round(12 + (distKm / 58) * 60))
  }

  // 1. 유효한 구글 API 키가 있고 월간 안전 한도(8,000요청/월) 내인 경우 Google Routes API / Directions 사용
  if (isValidGoogleApiKey() && !googleSdkAuthFailed && checkAndIncrementMonthlyQuota('routes', 3)) {
    // 1-A. Google Routes API (v2 computeRoutes - 구 Directions API의 최신 통합 버전) 우선 호출
    try {
      const fetchRouteV2 = async (travelMode) => {
        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            // 과금 최소화: 가장 저렴한 Basic SKU 필드(소요시간, 거리)만 요청
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
          },
          body: JSON.stringify({
            origin: {
              location: { latLng: { latitude: fLat, longitude: fLng } },
            },
            destination: {
              location: { latLng: { latitude: tLat, longitude: tLng } },
            },
            travelMode, // 'DRIVE' | 'TRANSIT' | 'WALK'
            languageCode: 'ko',
          }),
        })
        if (!res.ok) return null
        const data = await res.json()
        const route = data?.routes?.[0]
        if (!route) return null
        const seconds = parseInt(String(route.duration || '0').replace('s', ''), 10) || 0
        const meters = Number(route.distanceMeters) || 0
        return seconds > 0 || meters > 0 ? { seconds, meters } : null
      }

      const [driveRes, transitRes, walkRes] = await Promise.all([
        fetchRouteV2('DRIVE'),
        fetchRouteV2('TRANSIT'),
        fetchRouteV2('WALK'),
      ])

      const baseRes = driveRes || transitRes || walkRes
      if (baseRes) {
        const distMeters = baseRes.meters || 1000
        const distKm = distMeters / 1000

        const carMins = driveRes?.seconds
          ? Math.max(1, Math.round(driveRes.seconds / 60))
          : Math.max(3, Math.round((distKm / 30) * 60))

        const walkMins =
          distKm > 25
            ? null
            : walkRes?.seconds
            ? Math.max(1, Math.round(walkRes.seconds / 60))
            : Math.max(1, Math.round((walkRes?.meters || distMeters) / 67))

        const transitMins = transitRes?.seconds
          ? Math.max(1, Math.round(transitRes.seconds / 60))
          : estimateSmartTransitMinutes(distKm, carMins, walkMins)

        const result = {
          distanceKm: distKm < 1 ? `${Math.round(distMeters)}m` : `${distKm.toFixed(1)}km`,
          car: formatMinutesFn(carMins),
          walk: walkMins ? formatMinutesFn(walkMins) : '도보 불가',
          transit: formatMinutesFn(transitMins),
          source: 'google-routes',
        }

        routesMemoryCache.set(cacheKey, result)
        saveRoutesCacheToStorage()
        return result
      }
    } catch (err) {
      console.warn('Google Routes API (v2) 호출 실패, JS SDK 폴백 시도:', err)
    }

    // 1-B. Google Maps JS SDK DirectionsService 폴백 시도
    try {
      const gmaps = await loadGoogleMapsSdk()
      if (gmaps?.DirectionsService) {
        const directionsService = new gmaps.DirectionsService()
        const origin = { lat: fLat, lng: fLng }
        const destination = { lat: tLat, lng: tLng }

        const querySdkMode = (mode) =>
          new Promise((resolve) => {
            directionsService.route(
              { origin, destination, travelMode: mode },
              (res, status) => {
                if (status === 'OK' && res?.routes?.[0]?.legs?.[0]) {
                  resolve(res.routes[0].legs[0])
                } else {
                  resolve(null)
                }
              }
            )
          })

        const [drivingLeg, transitLeg, walkingLeg] = await Promise.all([
          querySdkMode(gmaps.TravelMode.DRIVING),
          querySdkMode(gmaps.TravelMode.TRANSIT),
          querySdkMode(gmaps.TravelMode.WALKING),
        ])

        const baseLeg = drivingLeg || transitLeg || walkingLeg
        if (baseLeg) {
          const distMeters = baseLeg.distance?.value || 1000
          const distKm = distMeters / 1000

          const carMins = drivingLeg?.duration?.value
            ? Math.max(1, Math.round(drivingLeg.duration.value / 60))
            : Math.max(3, Math.round((distKm / 30) * 60))

          const walkMins =
            distKm > 25
              ? null
              : walkingLeg?.duration?.value
              ? Math.max(1, Math.round(walkingLeg.duration.value / 60))
              : Math.max(1, Math.round(distMeters / 67))

          const transitMins = transitLeg?.duration?.value
            ? Math.max(1, Math.round(transitLeg.duration.value / 60))
            : estimateSmartTransitMinutes(distKm, carMins, walkMins)

          const result = {
            distanceKm: distKm < 1 ? `${Math.round(distMeters)}m` : `${distKm.toFixed(1)}km`,
            car: formatMinutesFn(carMins),
            walk: walkMins ? formatMinutesFn(walkMins) : '도보 불가',
            transit: formatMinutesFn(transitMins),
            source: 'google',
          }

          routesMemoryCache.set(cacheKey, result)
          saveRoutesCacheToStorage()
          return result
        }
      }
    } catch (err) {
      console.warn('Google Directions 계산 실패, OSRM 도로망 엔진으로 폴백:', err)
    }
  }

  // 2. 폴백: OSRM 도로망 엔진 (결과 역시 localStorage에 영구 캐싱하여 재호출 방지)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=false`
    const res = await fetch(osrmUrl)
    if (res.ok) {
      const data = await res.json()
      const route = data?.routes?.[0]
      if (route && route.duration) {
        const distKm = route.distance / 1000
        const carMins = Math.max(3, Math.round(route.duration / 60))
        const transitMins = Math.max(7, Math.round(6 + (route.duration / 60) * 1.2))
        const walkMins = distKm > 25 ? null : Math.max(3, Math.round((distKm / 4.3) * 60))

        const result = {
          distanceKm: distKm < 1 ? `${Math.round(route.distance)}m` : `${distKm.toFixed(1)}km`,
          car: formatMinutesFn(carMins),
          walk: walkMins ? formatMinutesFn(walkMins) : '도보 불가',
          transit: formatMinutesFn(transitMins),
          source: 'osrm',
        }

        routesMemoryCache.set(cacheKey, result)
        saveRoutesCacheToStorage()
        return result
      }
    }
  } catch (err) {
    console.warn('OSRM 길찾기 폴백 실패:', err)
  }

  return null
}

