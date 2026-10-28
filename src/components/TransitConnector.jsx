import { useState, useEffect } from 'react'
import {
  Car,
  Footprints,
  Bus,
  Clock,
  ArrowRight,
  X,
  Navigation,
  Loader2,
} from 'lucide-react'
import { getKakaoCarDirections } from '../services/kakaoService'
import { getGoogleOverseasDirections, isValidGoogleApiKey } from '../services/googleService'
import { openKakaoNavi, openKakaoRoute, openGoogleDirections } from '../utils/navigation'

// 실제 길찾기 메모리 + localStorage 영구 캐시 (중복 API 호출 원천 방지)
const ROUTE_CACHE_STORAGE_KEY = 'tripnote-transit-route-cache-v2'
const routeCache = new Map()

try {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(ROUTE_CACHE_STORAGE_KEY)
    if (raw) {
      Object.entries(JSON.parse(raw)).forEach(([k, v]) => routeCache.set(k, v))
    }
  }
} catch {
  // ignore
}

function saveRouteCacheToStorage() {
  try {
    if (routeCache.size > 500) {
      const firstKey = routeCache.keys().next().value
      if (firstKey) routeCache.delete(firstKey)
    }
    localStorage.setItem(ROUTE_CACHE_STORAGE_KEY, JSON.stringify(Object.fromEntries(routeCache.entries())))
  } catch {
    // ignore
  }
}

// 두 지점 간 거리(km) 계산 (하버사인 공식)
export function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null
  const numLat1 = Number(lat1)
  const numLng1 = Number(lng1)
  const numLat2 = Number(lat2)
  const numLng2 = Number(lng2)
  if (isNaN(numLat1) || isNaN(numLng1) || isNaN(numLat2) || isNaN(numLng2)) return null
  if (numLat1 === 0 || numLng1 === 0 || numLat2 === 0 || numLng2 === 0) return null

  const R = 6371
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180
  const dLng = ((numLng2 - numLng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatMinutes(min) {
  if (!min || min <= 0) return '약 5분'
  if (min < 60) return `약 ${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`
}

// 거리 기반 예상 시간 계산 (오프라인/폴백용)
export function estimateTransitTimes(fromItem, toItem) {
  const dist = getDistanceKm(fromItem?.lat, fromItem?.lng, toItem?.lat, toItem?.lng)

  if (dist !== null && dist > 0.03) {
    const roadMeters = Math.round(dist * 1.35 * 1000) // 도로망 기준 환산 거리
    const roadKm = roadMeters / 1000

    // 1. 자가용 (도심 시속 32km/h 기준)
    const carMins = Math.max(3, Math.round((roadKm / 32) * 60))

    // 2. 도보: 카카오 공식 기준 분당 67m (시속 4.02km/h)
    const walkMins = roadKm > 20 ? null : Math.max(1, Math.round(roadMeters / 67))

    // 3. 대중교통: 카카오지도 앱 실제 구간별 표정속도
    let transitMins
    if (roadKm <= 1.2) {
      transitMins = Math.min(walkMins || 10, Math.max(6, Math.round(4 + (roadKm / 15) * 60)))
    } else if (roadKm <= 5.0) {
      transitMins = Math.max(8, Math.round(5 + (roadKm / 20) * 60))
    } else if (roadKm <= 15.0) {
      transitMins = Math.max(16, Math.round(7 + (roadKm / 28) * 60))
    } else if (roadKm <= 35.0) {
      transitMins = Math.max(28, Math.round(10 + (roadKm / 36) * 60))
    } else {
      transitMins = Math.max(45, Math.round(15 + (roadKm / 52) * 60))
    }

    return {
      distanceKm: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`,
      car: formatMinutes(carMins),
      walk: walkMins ? formatMinutes(walkMins) : '도보 불가',
      transit: formatMinutes(transitMins),
      source: 'estimate',
    }
  }

  return {
    distanceKm: null,
    car: '약 10분',
    walk: '약 25분',
    transit: '약 18분',
    source: 'default',
  }
}

/**
 * 1번 장소 ~ 2번 장소 사이의 이동 소요시간 및 길찾기 연동 컴포넌트
 */
export default function TransitConnector({
  fromItem,
  toItem,
  onUpdateTransit,
  tripType = 'domestic',
}) {
  const [open, setOpen] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [realRouteData, setRealRouteData] = useState(null)

  const fallbackEstimates = estimateTransitTimes(fromItem, toItem)

  // 1. 카카오 모빌리티 / 도로망 길찾기 비동기 계산
  useEffect(() => {
    const fLat = Number(fromItem?.lat)
    const fLng = Number(fromItem?.lng)
    const tLat = Number(toItem?.lat)
    const tLng = Number(toItem?.lng)

    if (!fLat || !fLng || !tLat || !tLng || (fLat === tLat && fLng === tLng)) {
      setRealRouteData(null)
      return
    }

    const cacheKey = `${tripType}_${fLng.toFixed(4)},${fLat.toFixed(4)}_${tLng.toFixed(4)},${tLat.toFixed(4)}`
    if (routeCache.has(cacheKey)) {
      const cached = routeCache.get(cacheKey)
      // 해외여행이고 구글 API 키가 유효한데 이전 폴백(osrm) 캐시인 경우 구글 API로 새로 계산
      const isStaleFallback =
        tripType === 'overseas' &&
        isValidGoogleApiKey() &&
        cached?.source !== 'google-routes' &&
        cached?.source !== 'google'

      if (!isStaleFallback) {
        setRealRouteData(cached)
        return
      }
    }

    let isCancelled = false
    setLoadingRoute(true)

    async function fetchDirections() {
      try {
        // [해외여행] Google Directions API (영구 캐싱 + OSRM 폴백 내장)
        if (tripType === 'overseas') {
          const googleRes = await getGoogleOverseasDirections(fLat, fLng, tLat, tLng, formatMinutes)
          if (googleRes && !isCancelled) {
            routeCache.set(cacheKey, googleRes)
            saveRouteCacheToStorage()
            setRealRouteData(googleRes)
            return
          }
        }

        // [국내여행] 1순위: 카카오 모빌리티 길찾기 API 시도
        if (tripType !== 'overseas') {
          const kakaoRes = await getKakaoCarDirections(fLat, fLng, tLat, tLng)
          if (kakaoRes && !isCancelled) {
            const result = {
              distanceKm: kakaoRes.distanceKm,
              car: formatMinutes(kakaoRes.durationMinutes),
              walk: kakaoRes.walkMinutes ? formatMinutes(kakaoRes.walkMinutes) : '도보 불가',
              transit: formatMinutes(kakaoRes.transitMinutes),
              source: 'kakao',
            }
            routeCache.set(cacheKey, result)
            saveRouteCacheToStorage()
            setRealRouteData(result)
            return
          }
        }

        // 2순위: OSRM 도로망 엔진 (카카오 키 미등록 시 폴백)
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=false`
        const res = await fetch(osrmUrl)
        if (res.ok && !isCancelled) {
          const data = await res.json()
          const route = data?.routes?.[0]
          if (route && route.duration) {
            const distKm = route.distance / 1000
            const carMins = Math.max(3, Math.round(route.duration / 60))
            const transitMins = Math.max(7, Math.round(6 + (route.duration / 60) * 1.2))
            const walkMins = distKm > 25 ? null : Math.max(3, Math.round((distKm / 4.3) * 60))

            const result = {
              distanceKm: distKm < 1 ? `${Math.round(route.distance)}m` : `${distKm.toFixed(1)}km`,
              car: formatMinutes(carMins),
              walk: walkMins ? formatMinutes(walkMins) : '도보 불가',
              transit: formatMinutes(transitMins),
              source: 'osrm',
            }
            routeCache.set(cacheKey, result)
            saveRouteCacheToStorage()
            setRealRouteData(result)
            return
          }
        }
      } catch (err) {
        console.warn('길찾기 계산 실패, 기본 추정치 사용:', err)
      } finally {
        if (!isCancelled) setLoadingRoute(false)
      }
    }

    fetchDirections()

    return () => {
      isCancelled = true
    }
  }, [fromItem?.lat, fromItem?.lng, toItem?.lat, toItem?.lng, tripType])

  const estimates = realRouteData || fallbackEstimates

  // 현재 선택된 이동수단 (자가용 car 기본)
  const currentMethod = toItem?.transitMethod || 'car'

  // 계산된 소요 시간
  const routeCalculatedDuration =
    currentMethod === 'walk'
      ? estimates.walk
      : currentMethod === 'transit'
      ? estimates.transit
      : estimates.car

  // 직접 입력한 시간인지 확인
  const currentDuration = toItem?.isCustomDuration
    ? toItem.transitDuration
    : routeCalculatedDuration

  // 계산된 실시간 시간 자동 동기화
  useEffect(() => {
    if (realRouteData && !toItem?.isCustomDuration) {
      const liveDuration =
        currentMethod === 'walk'
          ? realRouteData.walk
          : currentMethod === 'transit'
          ? realRouteData.transit
          : realRouteData.car

      if (liveDuration && liveDuration !== toItem?.transitDuration) {
        onUpdateTransit(currentMethod, liveDuration, false)
      }
    }
  }, [realRouteData, currentMethod, toItem?.isCustomDuration])

  const [customTime, setCustomTime] = useState(currentDuration)

  const handleSelectMethod = (method, defaultDuration) => {
    onUpdateTransit(method, defaultDuration, false)
    setOpen(false)
  }

  const handleSaveCustom = (method = currentMethod) => {
    if (customTime.trim()) {
      onUpdateTransit(method, customTime.trim(), true)
      setOpen(false)
    }
  }

  // [3번 요구사항 실행 핸들러]
  // 자가용: 카카오내비 연동 / 대중교통&도보: 카카오맵 길찾기 연동
  const handleDirectNavigation = (e) => {
    e.stopPropagation()

    const fromName = fromItem?.placeName || fromItem?.title || '출발지'
    const toName = toItem?.placeName || toItem?.title || '도착지'
    const fromLat = fromItem?.lat
    const fromLng = fromItem?.lng
    const toLat = toItem?.lat
    const toLng = toItem?.lng

    // [해외여행 길찾기] 도보, 대중교통, 자가용 모두 구글 공식 길찾기 API 연동
    if (tripType === 'overseas') {
      openGoogleDirections({
        mode: currentMethod, // 'car' | 'transit' | 'walk'
        fromName,
        fromLat,
        fromLng,
        toName,
        toLat,
        toLng,
      })
      return
    }

    if (currentMethod === 'car') {
      // 1) 국내 자가용: 모바일 카카오내비 앱 / PC 카카오맵 자동차 길찾기
      openKakaoNavi({
        toName,
        toLat,
        toLng,
        fromName,
        fromLat,
        fromLng,
      })
    } else {
      // 2) 국내 대중교통 or 도보: 모바일 카카오맵 앱 / PC 카카오맵 길찾기
      openKakaoRoute({
        mode: currentMethod, // 'transit' or 'walk'
        fromName,
        fromLat,
        fromLng,
        toName,
        toLat,
        toLng,
      })
    }
  }

  // 이동수단 메타 정보
  const getMethodMeta = (method) => {
    switch (method) {
      case 'walk':
        return { label: '도보', icon: <Footprints className="h-3.5 w-3.5 text-amber-500" /> }
      case 'transit':
        return { label: '대중교통(가장 빠른)', icon: <Bus className="h-3.5 w-3.5 text-emerald-500" /> }
      case 'car':
      default:
        return { label: '자가용', icon: <Car className="h-3.5 w-3.5 text-sky-500" /> }
    }
  }

  const meta = getMethodMeta(currentMethod)

  return (
    <>
      {/* 타임라인 연결선 상의 소요시간 뱃지 및 바로 안내/길찾기 버튼 */}
      <div className="relative flex gap-3 py-1.5 items-center">
        {/* 왼쪽 거터 세로 연결선 (w-8 중심) */}
        <div className="relative flex w-8 shrink-0 flex-col items-center justify-center">
          <span className="absolute inset-y-0 w-0.5 bg-slate-200" />
          <span className="relative z-[1] h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" />
        </div>

        {/* 이동 소요시간 뱃지 & 바로안내 버튼 그룹 */}
        <div className="flex-1 flex flex-wrap items-center gap-2 pl-0.5">
          {/* 소요시간 뱃지 (클릭 시 이동수단 선택 모달 열림) */}
          <button
            type="button"
            onClick={() => {
              setCustomTime(currentDuration)
              setOpen(true)
            }}
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-xs backdrop-blur hover:border-amber-400 hover:bg-amber-50/70 hover:text-slate-900 active:scale-95 transition"
            title="클릭하여 자가용, 대중교통, 도보 중 선택"
          >
            {meta.icon}
            <span className="font-extrabold">{currentMethod === 'transit' ? '대중교통' : meta.label}</span>
            <span className="text-slate-300">·</span>
            <span className="font-extrabold text-indigo-600">
              {currentDuration}
            </span>
            {estimates.distanceKm && (
              <span className="text-[10px] font-medium text-slate-400">({estimates.distanceKm})</span>
            )}
            <span className="text-[10px] font-medium text-slate-400 group-hover:text-amber-600 ml-0.5">
              변경 ▾
            </span>
          </button>

          {/* [3번 요구사항] 길찾기 버튼 (자가용, 대중교통, 도보 용어 통일) */}
          <button
            type="button"
            onClick={handleDirectNavigation}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold px-3 py-1 text-[11px] shadow-xs active:scale-95 transition"
            title={
              tripType === 'overseas'
                ? currentMethod === 'car'
                  ? '구글 지도 길찾기 (자가용 자동차 실시간 최적 경로)'
                  : currentMethod === 'transit'
                  ? '구글 지도 길찾기 (대중교통 지하철·버스 최적 환승 경로)'
                  : '구글 지도 길찾기 (도보 보행자 최단 경로)'
                : currentMethod === 'car'
                ? '길찾기 (모바일: 카카오내비 앱 바로 실행 / PC: 카카오맵 자동차)'
                : currentMethod === 'transit'
                ? '길찾기 (대중교통 최적 환승 노선 바로보기)'
                : '길찾기 (도보 보행자 전용 경로 바로보기)'
            }
          >
            <Navigation className="h-3 w-3 fill-slate-950 text-slate-950" />
            <span>길찾기</span>
          </button>
        </div>
      </div>

      {/* 이동수단(자가용, 대중교통, 도보) 선택 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 animate-scale max-h-[90vh] overflow-y-auto">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-slate-900">
                  <Navigation className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-extrabold text-slate-900">이동수단 및 소요시간 선택</h3>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {tripType === 'overseas' ? '구글 지도로 계산된 시간입니다' : '카카오 지도로 계산된 시간입니다'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 이동 구간 요약 */}
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs flex items-center justify-between">
              <span className="font-bold text-slate-700 truncate max-w-[120px]">
                {fromItem?.title || '출발지'}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 px-2 shrink-0">
                <ArrowRight className="h-3 w-3 text-amber-500" />
                {estimates.distanceKm && (
                  <span className="font-semibold text-slate-700">{estimates.distanceKm}</span>
                )}
              </div>
              <span className="font-bold text-slate-700 truncate max-w-[120px] text-right">
                {toItem?.title || '도착지'}
              </span>
            </div>

            {/* 계산 로딩 상태 */}
            {loadingRoute && (
              <div className="mt-2 flex items-center justify-center gap-1.5 py-1 text-xs text-amber-700 font-semibold bg-amber-50 rounded-xl">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                <span>
                  {tripType === 'overseas'
                    ? '구글 지도로 실시간 소요시간 계산 중...'
                    : '카카오 지도로 실시간 소요시간 계산 중...'}
                </span>
              </div>
            )}

            {/* 3가지 이동수단 선택 카드 목록 (요구사항 2번) */}
            <div className="mt-3 space-y-2">
              {/* 1. 자가용 */}
              <button
                type="button"
                onClick={() => handleSelectMethod('car', estimates.car)}
                className={`w-full flex items-center justify-between rounded-2xl p-3 border transition active:scale-[0.98] ${
                  currentMethod === 'car'
                    ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-200 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-600">
                    <Car className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-slate-800">자가용</span>
                      {currentMethod === 'car' && (
                        <span className="rounded-full bg-sky-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          선택됨
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {tripType === 'overseas' ? '구글 지도 실시간 자동차 경로' : '카카오내비 실시간 교통 반영'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-sky-600 block">
                    {estimates.car}
                  </span>
                  <span className="text-[10px] text-slate-400">선택하기</span>
                </div>
              </button>

              {/* 2. 대중교통 (가장 빠른) */}
              <button
                type="button"
                onClick={() => handleSelectMethod('transit', estimates.transit)}
                className={`w-full flex items-center justify-between rounded-2xl p-3 border transition active:scale-[0.98] ${
                  currentMethod === 'transit'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-slate-800">대중교통 (가장 빠른)</span>
                      {currentMethod === 'transit' && (
                        <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          선택됨
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {tripType === 'overseas' ? '구글 지도 지하철/버스 최적 환승' : '지하철/버스 최적 환승'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-emerald-600 block">
                    {estimates.transit}
                  </span>
                  <span className="text-[10px] text-slate-400">선택하기</span>
                </div>
              </button>

              {/* 3. 도보 */}
              <button
                type="button"
                onClick={() => handleSelectMethod('walk', estimates.walk)}
                className={`w-full flex items-center justify-between rounded-2xl p-3 border transition active:scale-[0.98] ${
                  currentMethod === 'walk'
                    ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-200 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600">
                    <Footprints className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-slate-800">도보</span>
                      {currentMethod === 'walk' && (
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-bold text-slate-900">
                          선택됨
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {tripType === 'overseas' ? '구글 지도 보행자 전용 경로' : '보행로 기준'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-amber-600 block">
                    {estimates.walk}
                  </span>
                  <span className="text-[10px] text-slate-400">선택하기</span>
                </div>
              </button>
            </div>

            {/* 바로 길찾기 실행 버튼 */}
            <div className="mt-3.5 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                {tripType === 'overseas'
                  ? '구글 지도로 지금 바로 길안내 시작하기 (모바일 앱 / PC 웹)'
                  : '지금 바로 길안내 시작하기 (모바일 앱 / PC 웹)'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDirectNavigation}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 py-2.5 text-xs font-bold transition shadow-xs"
                >
                  <Navigation className="h-3.5 w-3.5 fill-slate-950" />
                  <span>길찾기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition"
                >
                  <span>닫기</span>
                </button>
              </div>
            </div>

            {/* 소요시간 직접 수정 */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">
                소요시간 직접 입력/수정
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    placeholder="예: 약 20분"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveCustom(currentMethod)}
                  className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black active:scale-95 transition shrink-0 shadow-xs"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
