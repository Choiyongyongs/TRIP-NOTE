/**
 * 모바일 디바이스 감지 유틸리티
 */
export function isMobile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * 딥링크 실행 후 앱 미설치 시 웹 URL로 안전하게 폴백(Fallback) 이동
 */
export function openDeepLinkWithFallback(appUrl, fallbackWebUrl) {
  if (!isMobile()) {
    // PC인 경우 바로 웹사이트 열기
    window.open(fallbackWebUrl, '_blank', 'noopener,noreferrer')
    return
  }

  // 모바일인 경우: 앱 스킴 호출 후 타임아웃으로 웹으로 폴백
  let hasNavigated = false
  const onVisibilityChange = () => {
    if (document.hidden) {
      hasNavigated = true
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange, { once: true })

  // 앱 딥링크 호출
  window.location.href = appUrl

  setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (!hasNavigated && !document.hidden) {
      // 앱이 열리지 않았을 때 웹페이지로 이동
      window.open(fallbackWebUrl, '_blank', 'noopener,noreferrer')
    }
  }, 1600)
}

/**
 * [카카오맵 공식 웹 길찾기 URL 생성기]
 * 카카오 공식 URL 규격: https://map.kakao.com/link/by/{수단}/{출발지},{위도},{경도}/{도착지},{위도},{경도}
 * - traffic : 대중교통 탭이 바로 열리며 출발지와 도착지 자동 완성
 * - walk    : 도보 탭이 바로 열리며 출발지와 도착지 자동 완성
 * - car     : 자동차 탭이 바로 열리며 출발지와 도착지 자동 완성
 */
export function getKakaoWebDirectionsUrl({ mode = 'car', fName, fLat, fLng, tName, tLat, tLng }) {
  const fromName = fName || '출발지'
  const toName = tName || '도착지'

  // 카카오 공식 이동수단 경로 코드: 대중교통='traffic', 도보='walk', 자동차='car'
  const target = mode === 'walk' ? 'walk' : mode === 'transit' ? 'traffic' : 'car'

  if (fLat && fLng && tLat && tLng) {
    // 1) 대중교통인 경우: PC/모바일 브라우저 모두에서 대중교통 탭과 노선이 100% 즉시 펼쳐지는 카카오맵 공식 routeView 활용
    if (mode === 'transit') {
      return `https://map.kakao.com/link/by/traffic/${encodeURIComponent(fromName)},${fLat},${fLng}/${encodeURIComponent(toName)},${tLat},${tLng}`
    }
    // 2) 도보 및 자동차: 카카오 공식 link/by 경로
    return `https://map.kakao.com/link/by/${target}/${encodeURIComponent(fromName)},${fLat},${fLng}/${encodeURIComponent(toName)},${tLat},${tLng}`
  }

  // 좌표가 일부 없을 경우 도착지 기준
  if (tLat && tLng) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(toName)},${tLat},${tLng}`
  }

  return `https://map.kakao.com/?map_type=TYPE_MAP&target=${target}&sName=${encodeURIComponent(fromName)}&eName=${encodeURIComponent(toName)}`
}

/**
 * [1. 자가용 길찾기]
 * - 모바일: 카카오내비 어플(kakaonavi://) 자동 실행되어 목적지 길안내 즉각 시작
 * - PC: 카카오맵 자동차 길찾기 공식 웹 (출발지 + 목적지 100% 자동 입력 및 경로 표시)
 */
export function openKakaoNavi({ toName, toLat, toLng, fromName, fromLat, fromLng }) {
  const tName = toName || '목적지'
  const fName = fromName || '출발지'
  const tLatNum = Number(toLat)
  const tLngNum = Number(toLng)
  const fLatNum = Number(fromLat)
  const fLngNum = Number(fromLng)

  const pcWebUrl = getKakaoWebDirectionsUrl({
    mode: 'car',
    fName,
    fLat: fLatNum,
    fLng: fLngNum,
    tName,
    tLat: tLatNum,
    tLng: tLngNum,
  })

  if (isMobile()) {
    // 모바일 환경: 카카오내비 어플로 바로 연동되어 길찾기 즉시 실행
    const appUrl = `kakaonavi://navigate?name=${encodeURIComponent(tName)}&x=${tLngNum}&y=${tLatNum}&coord_type=wgs84`
    openDeepLinkWithFallback(appUrl, pcWebUrl)
  } else {
    // PC 환경: 카카오맵 자동차 길찾기 웹 열기 (출발지와 도착지 자동 입력)
    window.open(pcWebUrl, '_blank', 'noopener,noreferrer')
  }
}

/**
 * [2. 대중교통 / 도보 길찾기]
 * - 대중교통 선택 시: 카카오 공식 대중교통 길찾기로 직행하여 출발지/도착지 자동 완성 및 최적 노선 노출
 * - 도보 선택 시: 카카오 공식 link/by/walk/ 로 직행하여 도보 탭이 100% 열리고 보행자 경로 완성
 * - 모바일: 카카오맵 어플 즉시 연동 (미설치 시 모바일 웹 자동 폴백)
 * - PC: 카카오맵 길찾기 웹으로 직행
 */
export function openKakaoRoute({
  mode = 'transit', // 'transit' (대중교통) | 'walk' (도보)
  fromName,
  fromLat,
  fromLng,
  toName,
  toLat,
  toLng,
}) {
  const fName = fromName || '출발지'
  const tName = toName || '목적지'
  const fLatNum = Number(fromLat)
  const fLngNum = Number(fromLng)
  const tLatNum = Number(toLat)
  const tLngNum = Number(toLng)

  const kakaoBy = mode === 'walk' ? 'FOOT' : 'PUBLICTRANSIT'

  let targetWebUrl = getKakaoWebDirectionsUrl({
    mode,
    fName,
    fLat: fLatNum,
    fLng: fLngNum,
    tName,
    tLat: tLatNum,
    tLng: tLngNum,
  })

  if (isMobile()) {
    // 모바일 카카오맵 어플 딥링크 (출발지 sp/sn, 도착지 ep/en 및 이동수단 by)
    const appUrl = `kakaomap://route?sp=${fLatNum},${fLngNum}&sn=${encodeURIComponent(fName)}&ep=${tLatNum},${tLngNum}&en=${encodeURIComponent(tName)}&by=${kakaoBy}`
    openDeepLinkWithFallback(appUrl, targetWebUrl)
  } else {
    // PC 웹 환경:
    // 대중교통 모드일 때 사용자가 대중교통 환승 노선 화면을 가장 직관적으로 볼 수 있도록 연동
    window.open(targetWebUrl, '_blank', 'noopener,noreferrer')
  }
}

/**
 * [3. 네이버 상세보기 URL 생성 유틸 (generateNaverDetailUrl)]
 * - 수동 입력 링크(customNaverUrl) 최우선
 * - 상호명 정제: (...) 및 [...] 제거
 * - 행정구역(읍/면/동 또는 시/군/구) 결합하여 1개 매장으로 특정
 * - 모바일: m.map.naver.com/search2/search.naver?query=...
 * - PC: map.naver.com/p/search/...?c=17.00,경도,위도,0,0,0,dh (좌표 고정)
 */
export function generateNaverDetailUrl(item = {}) {
  // 1. 수동 입력 링크 최우선 (customNaverUrl)
  // 1. 수동 입력 네이버 공유 링크(customNaverUrl)가 있으면 최우선 반환
  if (item?.customNaverUrl && typeof item.customNaverUrl === 'string' && item.customNaverUrl.trim()) {
    return item.customNaverUrl.trim()
  }

  // 2. 카카오 API에서 받은 검색어 그대로 검색 (placeName 우선, 없으면 title)
  const searchKeyword = (item?.placeName || item?.title || '').trim() || '장소'
  const encodedQuery = encodeURIComponent(searchKeyword)

  if (isMobile()) {
    return `https://m.map.naver.com/search2/search.naver?query=${encodedQuery}`
  }

  const lat = Number(item?.lat)
  const lng = Number(item?.lng)
  if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
    return `https://map.naver.com/p/search/${encodedQuery}?c=17.00,${lng},${lat},0,0,0,dh`
  }

  return `https://map.naver.com/p/search/${encodedQuery}`
}

/**
 * [네이버 지도 상세 바로보기 팝업/앱 연동]
 */
export function openNaverPlaceDetails(item = {}) {
  const url = generateNaverDetailUrl(item)

  if (isMobile() && (!item?.customNaverUrl || !item.customNaverUrl.trim())) {
    const rawName = (item?.placeName || item?.title || '').trim() || '장소'
    const appUrl = `nmap://search?query=${encodeURIComponent(rawName)}&appname=com.tripnote.app`
    openDeepLinkWithFallback(appUrl, url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * [4. 해외여행 구글 공식 길찾기 API 연동]
 * - driving (자가용)
 * - transit (대중교통)
 * - walking (도보)
 */
export function openGoogleDirections({
  mode = 'driving', // 'driving' | 'transit' | 'walking' | 'car' | 'walk'
  fromName,
  fromLat,
  fromLng,
  toName,
  toLat,
  toLng,
}) {
  const fLat = Number(fromLat)
  const fLng = Number(fromLng)
  const tLat = Number(toLat)
  const tLng = Number(toLng)

  const origin =
    fLat && fLng && !isNaN(fLat) && !isNaN(fLng)
      ? `${fLat},${fLng}`
      : encodeURIComponent(fromName || '출발지')

  const destination =
    tLat && tLng && !isNaN(tLat) && !isNaN(tLng)
      ? `${tLat},${tLng}`
      : encodeURIComponent(toName || '도착지')

  let travelMode = 'driving'
  if (mode === 'walk' || mode === 'walking') {
    travelMode = 'walking'
  } else if (mode === 'transit' || mode === 'bus' || mode === 'subway') {
    travelMode = 'transit'
  }

  const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${travelMode}`

  if (isMobile()) {
    // 모바일 구글 지도 앱 딥링크 호출 후 웹 폴백
    const appUrl = `comgooglemaps://?saddr=${origin}&daddr=${destination}&directionsmode=${travelMode}`
    openDeepLinkWithFallback(appUrl, webUrl)
  } else {
    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }
}
