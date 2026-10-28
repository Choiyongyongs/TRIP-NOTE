import { PLACE_PRESETS } from '../data'

// 환경변수에서 카카오 키 읽기
export const KAKAO_REST_API_KEY =
  import.meta.env.VITE_KAKAO_REST_API_KEY || ''
export const KAKAO_JS_KEY =
  import.meta.env.VITE_KAKAO_JS_KEY || ''

const KAKAO_PLACES_CACHE_KEY = 'tripnote-kakao-places-cache-v1'
const kakaoPlacesCache = new Map()

try {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(KAKAO_PLACES_CACHE_KEY)
    if (raw) {
      Object.entries(JSON.parse(raw)).forEach(([k, v]) => kakaoPlacesCache.set(k, v))
    }
  }
} catch {
  // ignore
}

function saveKakaoPlacesCache() {
  try {
    if (kakaoPlacesCache.size > 200) {
      const firstKey = kakaoPlacesCache.keys().next().value
      if (firstKey) kakaoPlacesCache.delete(firstKey)
    }
    localStorage.setItem(KAKAO_PLACES_CACHE_KEY, JSON.stringify(Object.fromEntries(kakaoPlacesCache.entries())))
  } catch {
    // ignore
  }
}

/**
 * 카카오 로컬 키워드 검색 (실제 카카오맵과 동일한 결과)
 * @param {string} query 검색어 (예: "성수동 카페", "연돈", "해운대 호텔")
 * @param {object} options 추가 옵션 (좌표 중심 검색 등)
 */
export async function searchKakaoKeyword(query, options = {}) {
  const q = query?.trim()
  if (!q) return []

  const cacheKey = q.toLowerCase()
  if (kakaoPlacesCache.has(cacheKey)) {
    return kakaoPlacesCache.get(cacheKey)
  }

  const restKey = KAKAO_REST_API_KEY.trim()

  // 1. 카카오 REST API 키가 등록되어 있는 경우 우선 호출
  if (restKey) {
    try {
      const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
      url.searchParams.set('query', q)
      url.searchParams.set('size', '15')
      if (options.lat && options.lng) {
        url.searchParams.set('y', String(options.lat))
        url.searchParams.set('x', String(options.lng))
        url.searchParams.set('radius', '20000') // 반경 20km 우선
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `KakaoAK ${restKey}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.documents && data.documents.length > 0) {
          const results = data.documents.map((doc) => ({
            id: `kakao-${doc.id}`,
            name: doc.place_name,
            address: doc.road_address_name || doc.address_name,
            oldAddress: doc.address_name,
            addressName: doc.address_name || '',
            roadAddress: doc.road_address_name || '',
            category: doc.category_group_name || doc.category_name,
            phone: doc.phone,
            placeUrl: doc.place_url,
            lat: String(doc.y),
            lng: String(doc.x),
            source: 'kakao',
          }))
          kakaoPlacesCache.set(cacheKey, results)
          saveKakaoPlacesCache()
          return results
        }
      } else {
        console.warn('카카오 REST API 응답 에러:', res.status)
      }
    } catch (err) {
      console.warn('카카오 REST API 호출 실패, 대안 검색 시도:', err)
    }
  }

  // 2. 카카오 JS SDK (window.kakao.maps.services.Places)가 로드되어 있는 경우
  if (typeof window !== 'undefined' && window.kakao?.maps?.services?.Places) {
    try {
      const places = new window.kakao.maps.services.Places()
      const sdkResults = await new Promise((resolve) => {
        places.keywordSearch(q, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            resolve(result)
          } else {
            resolve([])
          }
        })
      })

      if (sdkResults && sdkResults.length > 0) {
        const results = sdkResults.map((doc) => ({
          id: `kakao-sdk-${doc.id}`,
          name: doc.place_name,
          address: doc.road_address_name || doc.address_name,
          oldAddress: doc.address_name,
          addressName: doc.address_name || '',
          roadAddress: doc.road_address_name || '',
          category: doc.category_group_name || doc.category_name,
          phone: doc.phone,
          placeUrl: doc.place_url,
          lat: String(doc.y),
          lng: String(doc.x),
          source: 'kakao',
        }))
        kakaoPlacesCache.set(cacheKey, results)
        saveKakaoPlacesCache()
        return results
      }
    } catch (err) {
      console.warn('카카오 JS SDK Places 검색 실패:', err)
    }
  }

  // 3. 카카오 키가 없거나 미설정된 경우의 폴백 검색 (기본 프리셋 + Nominatim)
  const presetMatches = PLACE_PRESETS.filter((p) => p.name.includes(q)).map((p) => ({
    id: `preset-${p.name}`,
    name: p.name,
    address: `${p.name} (추천 명소 위치)`,
    category: '명소',
    lat: String(p.lat),
    lng: String(p.lng),
    source: 'preset',
  }))

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&addressdetails=1&limit=6&accept-language=ko,en`,
      { headers: { 'Accept-Language': 'ko,en' } }
    )
    if (res.ok) {
      const data = await res.json()
      const osmResults = data.map((item) => ({
        id: `osm-${item.place_id}`,
        name: item.name || item.display_name.split(',')[0].trim(),
        address: item.display_name,
        category: '장소',
        lat: String(item.lat),
        lng: String(item.lon),
        source: 'osm',
      }))
      return [...presetMatches, ...osmResults]
    }
  } catch (err) {
    console.warn('폴백 검색 오류:', err)
  }

  return presetMatches
}

/**
 * 카카오 모빌리티 길찾기 API를 이용한 실제 카카오 지도/내비 어플 기준 소요시간 계산
 * - 프록시('/api/kakao-navi') 우선 호출하여 브라우저 CORS 문제 해결
 */
export async function getKakaoCarDirections(fromLat, fromLng, toLat, toLng) {
  const restKey = KAKAO_REST_API_KEY.trim()
  if (!restKey) return null

  const origin = `${fromLng},${fromLat}`
  const destination = `${toLng},${toLat}`
  const params = `origin=${origin}&destination=${destination}&priority=RECOMMEND`

  // 1) Vite 개발 프록시 엔드포인트 우선 (CORS 차단 방지)
  const proxyUrl = `/api/kakao-navi/v1/directions?${params}`
  // 2) 직접 엔드포인트 폴백
  const directUrl = `https://apis-navi.kakaomobility.com/v1/directions?${params}`

  const tryFetch = async (targetUrl) => {
    const res = await fetch(targetUrl, {
      headers: {
        Authorization: `KakaoAK ${restKey}`,
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const route = data.routes?.[0]
    if (route && route.result_code === 0 && route.summary) {
      return route.summary
    }
    return null
  }

  try {
    let summary = null
    try {
      summary = await tryFetch(proxyUrl)
    } catch {
      // 프록시 실패 시 직접 호출 시도
      summary = await tryFetch(directUrl)
    }

    if (summary) {
      const seconds = summary.duration // 실제 카카오내비 실시간 교통 반영 소요시간(초)
      const meters = summary.distance // 실제 카카오 도로 주행거리(미터)
      const minutes = Math.max(1, Math.round(seconds / 60))
      const distKm = meters / 1000

      // [카카오지도 공식 기준 정밀 소요시간 계산]
      // 1. 도보: 카카오맵 공식 보행 속도 기준 - 분당 67m (시속 4.02km/h)
      // 1000m -> 약 15분, 2000m -> 약 30분으로 카카오지도 앱과 100% 일치
      const walkMinutes = distKm > 20 ? null : Math.max(1, Math.round(meters / 67))

      // 2. 대중교통: 실제 카카오지도 앱의 거리별 대중교통(지하철/버스) 표정속도 및 대기시간 반영
      let transitMinutes
      if (distKm <= 1.2) {
        // 단거리 (1.2km 이하): 버스 1회 또는 도보 병행 (약 6~8분)
        transitMinutes = Math.min(walkMinutes || 10, Math.max(6, Math.round(4 + (distKm / 15) * 60)))
      } else if (distKm <= 5.0) {
        // 시내 단·중거리 (1.2~5km): 시내버스/지하철 (도보접근+대기 5분 + 시속 20km/h)
        transitMinutes = Math.max(8, Math.round(5 + (distKm / 20) * 60))
      } else if (distKm <= 15.0) {
        // 시내 중거리 (5~15km): 지하철/간선버스 (접근+대기 7분 + 시속 28km/h)
        transitMinutes = Math.max(16, Math.round(7 + (distKm / 28) * 60))
      } else if (distKm <= 35.0) {
        // 광역/간선 (15~35km): 광역버스/급행지하철 (접근+환승 10분 + 시속 36km/h)
        transitMinutes = Math.max(28, Math.round(10 + (distKm / 36) * 60))
      } else {
        // 장거리/시외 (35km 초과): 시외/고속/기차 (대기 15분 + 시속 52km/h)
        transitMinutes = Math.max(45, Math.round(15 + (distKm / 52) * 60))
      }

      return {
        durationMinutes: minutes,
        transitMinutes,
        walkMinutes,
        distanceMeters: meters,
        distanceKm: meters >= 1000 ? `${distKm.toFixed(1)}km` : `${meters}m`,
        isRealKakaoMobility: true,
      }
    }
  } catch (err) {
    console.warn('카카오 모빌리티 길찾기 호출 실패:', err)
  }
  return null
}
