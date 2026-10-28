import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Plus, Minus, Maximize2, MapPin } from 'lucide-react'
import { won, getDayColor } from '../data'
import { KAKAO_JS_KEY } from '../services/kakaoService'
import { GOOGLE_MAPS_API_KEY, isValidGoogleApiKey, loadGoogleMapsSdk } from '../services/googleService'

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

/**
 * 1. 인터랙티브 동적 지도 (Leaflet + OpenStreetMap 기반 - 키 미등록/폴백용)
 */
function InteractiveDynamicMap({ points = [], selectedId, onSelect, label = '카카오지도' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerGroupRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialLat = points[0]?.lat || 33.38
    const initialLng = points[0]?.lng || 126.55

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup
    mapRef.current = map

    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const group = layerGroupRef.current
    if (!map || !group) return

    group.clearLayers()
    if (points.length === 0) return

    const allLatLngs = []
    // 일차별로 그룹화 (일차별 고유 색상 및 경로선 렌더링)
    const dayGroups = new Map()

    points.forEach((p, idx) => {
      const d = p.day || 1
      if (!dayGroups.has(d)) dayGroups.set(d, [])
      dayGroups.get(d).push(p)

      const isSel = p.id === selectedId
      const dayColor = getDayColor(d)
      const color = isSel ? '#e11d48' : dayColor
      const size = isSel ? 36 : 28
      allLatLngs.push([p.lat, p.lng])

      // 일차 내 순번 또는 대체 일정 번호 (1-1, 1-2 등)
      const markerNum = p.altNumber || p.dayIndex || idx + 1
      const isAlt = Boolean(p.isAlternative)

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${color};
            color: #ffffff;
            font-size: ${isAlt ? '10px' : isSel ? '13px' : '11px'};
            font-weight: 800;
            border: ${isAlt ? '2.5px dashed #ffffff' : '2.5px solid #ffffff'};
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            transition: transform 0.2s;
            cursor: pointer;
            transform: translate(-50%, -50%);
          ">
            ${markerNum}
          </div>
        `,
        iconSize: [0, 0],
      })

      const marker = L.marker([p.lat, p.lng], { icon: customIcon }).addTo(group)

      marker.on('click', () => {
        onSelect(p.id)
      })

      if (isSel) {
        const popupContent = `
          <div style="font-family: inherit; min-width: 140px; padding: 2px;">
            <div style="margin-bottom: 4px;">
              <span style="display:inline-block; padding: 2px 6px; border-radius: 6px; background: ${dayColor}; color: #fff; font-size: 10px; font-weight: 800; margin-right: 4px;">${d}일차</span>
              ${isAlt ? `<span style="display:inline-block; padding: 2px 6px; border-radius: 6px; background: #64748b; color: #fff; font-size: 10px; font-weight: 800;">대체 일정 ${markerNum}</span>` : ''}
            </div>
            <p style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a;">${esc(p.title)}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 700; color: #e11d48;">${won(p.expense)}</p>
            ${p.memo ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.3;">${esc(p.memo)}</p>` : ''}
          </div>
        `
        marker.bindPopup(popupContent, { offset: [0, -size / 2], closeButton: false }).openPopup()
        map.panTo([p.lat, p.lng], { animate: true, duration: 0.5 })
      }
    })

    // 일차별 코스선 연결 (일차별 색상 반영, [요청사항] 대체 일정은 선 연결 제외!)
    dayGroups.forEach((groupPoints, d) => {
      const mainPoints = groupPoints.filter((p) => !p.isAlternative)
      if (mainPoints.length > 1) {
        const lineCoords = mainPoints.map((p) => [p.lat, p.lng])
        L.polyline(lineCoords, {
          color: getDayColor(d),
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8',
        }).addTo(group)
      }
    })

    if (allLatLngs.length > 1 && !selectedId) {
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 14 })
    } else if (allLatLngs.length === 1 && !selectedId) {
      map.setView(allLatLngs[0], 12)
    }
  }, [points, selectedId, onSelect])

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const fitAll = () => {
    if (!mapRef.current || points.length === 0) return
    const latLngs = points.map((p) => [p.lat, p.lng])
    if (latLngs.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
    } else if (latLngs.length === 1) {
      mapRef.current.setView(latLngs[0], 13)
    }
  }

  return (
    <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[540px] w-full overflow-hidden bg-slate-100 select-none">
      <div ref={containerRef} className="absolute inset-0 h-full w-full z-0" />

      {points.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-white/70 backdrop-blur-sm text-sm font-semibold text-slate-500">
          <MapPin className="h-6 w-6 text-slate-400" />
          지도에 표시할 일정이 없습니다
        </div>
      )}

      {/* 우측 상단 줌 컨트롤 버튼 */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl bg-white/95 shadow-md border border-slate-200/80 backdrop-blur">
        <button
          type="button"
          aria-label="확대"
          onClick={zoomIn}
          className="p-2.5 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="축소"
          onClick={zoomOut}
          className="border-y border-slate-200 p-2.5 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="전체 보기"
          onClick={fitAll}
          className="p-2.5 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* 좌측 하단 뱃지 */}
      <span className="absolute bottom-2.5 left-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow backdrop-blur bg-amber-500">
        {label}
      </span>
    </div>
  )
}

/**
 * 2. 카카오 지도 SDK 공식 동적 지도 렌더러 (국내 플랜용)
 */
function KakaoSdkMapView({ points = [], selectedId, onSelect, kakaoJsKey }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const polylinesRef = useRef([])
  const [loadError, setLoadError] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // 카카오 지도 SDK 동적 로드
  useEffect(() => {
    const key = (kakaoJsKey || KAKAO_JS_KEY || '').trim()
    if (!key) {
      setLoadError(true)
      return
    }

    const scriptId = 'kakao-map-sdk'
    const existing = document.getElementById(scriptId)

    const initMap = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setIsReady(true)
        })
      }
    }

    if (existing) {
      if (window.kakao && window.kakao.maps) {
        initMap()
      } else {
        existing.addEventListener('load', initMap)
      }
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'text/javascript'
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      key
    )}&libraries=services,clusterer&autoload=false`
    script.onload = initMap
    script.onerror = () => {
      setLoadError(true)
    }
    document.head.appendChild(script)
  }, [kakaoJsKey])

  // 지도 인스턴스 생성
  useEffect(() => {
    if (!isReady || !containerRef.current || mapRef.current) return

    try {
      const initialLat = points[0]?.lat || 33.38
      const initialLng = points[0]?.lng || 126.55
      const center = new window.kakao.maps.LatLng(initialLat, initialLng)

      const map = new window.kakao.maps.Map(containerRef.current, {
        center,
        level: 8,
      })

      mapRef.current = map
    } catch (err) {
      console.error('카카오맵 생성 실패:', err)
      setLoadError(true)
    }
  }, [isReady])

  // 마커 및 일차별 코스선(Polyline) 갱신
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady || !window.kakao?.maps) return

    // 기존 오버레이 및 폴리라인 제거
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    if (points.length === 0) return

    const bounds = new window.kakao.maps.LatLngBounds()
    // 일차별로 그룹화
    const dayGroups = new Map()

    points.forEach((p, idx) => {
      const d = p.day || 1
      if (!dayGroups.has(d)) dayGroups.set(d, [])
      dayGroups.get(d).push(p)

      const isSel = p.id === selectedId
      const dayColor = getDayColor(d)
      const color = isSel ? '#e11d48' : dayColor
      const size = isSel ? 36 : 28
      const latLng = new window.kakao.maps.LatLng(p.lat, p.lng)

      bounds.extend(latLng)

      const isAlt = Boolean(p.isAlternative)
      const markerNum = p.altNumber || p.dayIndex || idx + 1

      // 마커 DOM 생성
      const markerEl = document.createElement('div')
      markerEl.style.display = 'flex'
      markerEl.style.alignItems = 'center'
      markerEl.style.justifyContent = 'center'
      markerEl.style.width = `${size}px`
      markerEl.style.height = `${size}px`
      markerEl.style.borderRadius = '50%'
      markerEl.style.backgroundColor = color
      markerEl.style.color = '#ffffff'
      markerEl.style.fontSize = isAlt ? '10px' : isSel ? '13px' : '11px'
      markerEl.style.fontWeight = '800'
      markerEl.style.border = isAlt ? '2.5px dashed #ffffff' : '2.5px solid #ffffff'
      markerEl.style.boxShadow = '0 4px 10px rgba(0,0,0,0.35)'
      markerEl.style.cursor = 'pointer'
      markerEl.style.transform = 'translate(-50%, -50%)'
      markerEl.innerText = String(markerNum)

      markerEl.onclick = () => onSelect(p.id)

      const overlay = new window.kakao.maps.CustomOverlay({
        position: latLng,
        content: markerEl,
        clickable: true,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)

      // 선택된 경우 말풍선 인포윈도우
      if (isSel) {
        const infoEl = document.createElement('div')
        infoEl.style.position = 'relative'
        infoEl.style.bottom = `${size + 8}px`
        infoEl.style.left = '50%'
        infoEl.style.transform = 'translateX(-50%)'
        infoEl.style.backgroundColor = '#ffffff'
        infoEl.style.padding = '8px 12px'
        infoEl.style.borderRadius = '12px'
        infoEl.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.2)'
        infoEl.style.border = '1px solid #e2e8f0'
        infoEl.style.whiteSpace = 'nowrap'
        infoEl.style.zIndex = '50'
        infoEl.innerHTML = `
          <div style="margin-bottom: 4px;">
            <span style="display:inline-block; padding: 2px 6px; border-radius: 6px; background: ${dayColor}; color: #fff; font-size: 10px; font-weight: 800; margin-right: 4px;">${d}일차</span>
            ${isAlt ? `<span style="display:inline-block; padding: 2px 6px; border-radius: 6px; background: #64748b; color: #fff; font-size: 10px; font-weight: 800;">대체 일정 ${markerNum}</span>` : ''}
          </div>
          <p style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a;">${esc(p.title)}</p>
          <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 700; color: #e11d48;">${won(p.expense)}</p>
        `

        const infoOverlay = new window.kakao.maps.CustomOverlay({
          position: latLng,
          content: infoEl,
          yAnchor: 1,
        })
        infoOverlay.setMap(map)
        overlaysRef.current.push(infoOverlay)

        map.panTo(latLng)
      }
    })

    // 일차별 코스선 연결 (일차별 색상 반영, [요청사항] 대체 일정은 선 연결 제외!)
    dayGroups.forEach((groupPoints, d) => {
      const mainPoints = groupPoints.filter((p) => !p.isAlternative)
      if (mainPoints.length > 1) {
        const linePath = mainPoints.map((p) => new window.kakao.maps.LatLng(p.lat, p.lng))
        const polyline = new window.kakao.maps.Polyline({
          path: linePath,
          strokeWeight: 4,
          strokeColor: getDayColor(d),
          strokeOpacity: 0.85,
          strokeStyle: 'shortdash',
        })
        polyline.setMap(map)
        polylinesRef.current.push(polyline)
      }
    })

    if (!selectedId && points.length > 1) {
      map.setBounds(bounds)
    } else if (!selectedId && points.length === 1) {
      map.setCenter(new window.kakao.maps.LatLng(points[0].lat, points[0].lng))
      map.setLevel(5)
    }
  }, [points, selectedId, isReady, onSelect])

  if (loadError) {
    return <InteractiveDynamicMap points={points} selectedId={selectedId} onSelect={onSelect} label="카카오지도" />
  }

  return (
    <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[540px] w-full min-h-[380px] bg-slate-200">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" style={{ minHeight: '380px' }} />
      <span className="absolute bottom-2.5 left-3 z-10 rounded-full bg-amber-400 text-slate-900 font-extrabold px-2.5 py-1 text-[11px] shadow backdrop-blur flex items-center gap-1">
        카카오지도
      </span>
    </div>
  )
}

/**
 * 3. 해외여행용 Google Maps JavaScript SDK 공식 동적 지도 렌더러
 * - 유효한 Google API Key가 등록되어 있으면 실제 구글 지도 렌더링 (한글 지명 지원)
 * - 미등록 또는 인증 실패 시 무료 인터랙티브 지도로 안전하게 자동 폴백
 */
function GoogleSdkMapView({ points = [], selectedId, onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const polylinesRef = useRef([])
  const infoWindowRef = useRef(null)
  const [loadError, setLoadError] = useState(!isValidGoogleApiKey(GOOGLE_MAPS_API_KEY))
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isValidGoogleApiKey(GOOGLE_MAPS_API_KEY)) {
      setLoadError(true)
      return
    }

    let cancelled = false
    const handleAuthError = () => {
      if (!cancelled) setLoadError(true)
    }
    window.addEventListener('google-maps-auth-error', handleAuthError)

    loadGoogleMapsSdk(GOOGLE_MAPS_API_KEY)
      .then(() => {
        if (!cancelled) setIsReady(true)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true
      window.removeEventListener('google-maps-auth-error', handleAuthError)
    }
  }, [])

  // 지도 인스턴스 1회 생성 (재렌더링 시에도 API 재호출 방지)
  useEffect(() => {
    if (!isReady || !containerRef.current || mapRef.current || !window.google?.maps) return

    try {
      const initialLat = Number(points[0]?.lat) || 34.6687
      const initialLng = Number(points[0]?.lng) || 135.5013

      const map = new window.google.maps.Map(containerRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      mapRef.current = map
      infoWindowRef.current = new window.google.maps.InfoWindow()
    } catch (err) {
      console.error('구글맵 생성 실패:', err)
      setLoadError(true)
    }
  }, [isReady])

  // 마커 및 일차별 코스선 갱신
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady || !window.google?.maps) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []
    if (infoWindowRef.current) infoWindowRef.current.close()

    if (points.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    const dayGroups = new Map()

    points.forEach((p, idx) => {
      const lat = Number(p.lat)
      const lng = Number(p.lng)
      if (!lat || !lng) return

      const d = p.day || 1
      if (!dayGroups.has(d)) dayGroups.set(d, [])
      dayGroups.get(d).push(p)

      const isSel = p.id === selectedId
      const dayColor = getDayColor(d)
      const color = isSel ? '#e11d48' : dayColor
      const size = isSel ? 36 : 28
      const position = { lat, lng }
      bounds.extend(position)

      const isAlt = Boolean(p.isAlternative)
      const markerNum = String(p.altNumber || p.dayIndex || idx + 1)

      // SVG 커스텀 원형 번호 마커 생성
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="#ffffff" stroke-width="2.5" ${
            isAlt ? 'stroke-dasharray="3,2"' : ''
          } />
          <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="800" font-size="${
            isAlt ? 10 : isSel ? 13 : 11
          }px">${esc(markerNum)}</text>
        </svg>
      `.trim()

      const marker = new window.google.maps.Marker({
        position,
        map,
        title: p.title,
        zIndex: isSel ? 100 : idx + 1,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new window.google.maps.Size(size, size),
          anchor: new window.google.maps.Point(size / 2, size / 2),
        },
      })

      marker.addListener('click', () => onSelect(p.id))
      markersRef.current.push(marker)

      if (isSel && infoWindowRef.current) {
        infoWindowRef.current.setContent(`
          <div style="padding: 4px 6px; min-width: 140px;">
            <div style="margin-bottom: 4px;">
              <span style="display:inline-block; padding: 2px 6px; border-radius: 6px; background: ${dayColor}; color: #fff; font-size: 10px; font-weight: 800; margin-right: 4px;">${d}일차</span>
              ${
                isAlt
                  ? `<span style="display:inline-block; padding: 2px 6px; border-radius: 6px; background: #64748b; color: #fff; font-size: 10px; font-weight: 800;">대체 일정 ${esc(markerNum)}</span>`
                  : ''
              }
            </div>
            <p style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a;">${esc(p.title)}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 700; color: #e11d48;">${won(p.expense)}</p>
          </div>
        `)
        infoWindowRef.current.open(map, marker)
        map.panTo(position)
      }
    })

    // 일차별 코스 점선 연결 (대체 일정 제외)
    dayGroups.forEach((groupPoints, d) => {
      const mainPoints = groupPoints.filter((p) => !p.isAlternative && p.lat && p.lng)
      if (mainPoints.length > 1) {
        const path = mainPoints.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
        const lineSymbol = {
          path: 'M 0,-1 0,1',
          strokeOpacity: 0.85,
          scale: 3.5,
        }
        const polyline = new window.google.maps.Polyline({
          path,
          strokeColor: getDayColor(d),
          strokeOpacity: 0,
          icons: [
            {
              icon: lineSymbol,
              offset: '0',
              repeat: '14px',
            },
          ],
          map,
        })
        polylinesRef.current.push(polyline)
      }
    })

    if (!selectedId && points.length > 1) {
      map.fitBounds(bounds)
    } else if (!selectedId && points.length === 1) {
      map.setCenter({ lat: Number(points[0].lat), lng: Number(points[0].lng) })
      map.setZoom(14)
    }
  }, [points, selectedId, isReady, onSelect])

  if (loadError) {
    return (
      <InteractiveDynamicMap points={points} selectedId={selectedId} onSelect={onSelect} label="구글맵" />
    )
  }

  return (
    <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[540px] w-full min-h-[380px] bg-slate-200">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" style={{ minHeight: '380px' }} />
      <span className="absolute bottom-2.5 left-3 z-10 rounded-full bg-indigo-600 text-white font-extrabold px-2.5 py-1 text-[11px] shadow backdrop-blur flex items-center gap-1">
        Google Maps
      </span>
    </div>
  )
}

export default function MapView({
  points = [],
  selectedId,
  onSelect,
  tripType = 'domestic',
}) {
  const kakaoJsKey = KAKAO_JS_KEY

  // 1. 국내여행 -> 카카오 지도
  if (tripType !== 'overseas') {
    if (kakaoJsKey) {
      return (
        <KakaoSdkMapView
          points={points}
          selectedId={selectedId}
          onSelect={onSelect}
          kakaoJsKey={kakaoJsKey}
        />
      )
    }
    return (
      <InteractiveDynamicMap
        points={points}
        selectedId={selectedId}
        onSelect={onSelect}
        label="카카오지도"
      />
    )
  }

  // 2. 해외여행 -> 구글맵 (Google Maps JS SDK + 자동 폴백)
  return (
    <GoogleSdkMapView
      points={points}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}
