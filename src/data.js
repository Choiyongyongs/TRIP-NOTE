import {
  Utensils,
  Coffee,
  Camera,
  ShoppingBag,
  BedDouble,
  Car,
  Sparkles,
} from 'lucide-react'

/** 카테고리 정의 — Tailwind 클래스는 빌드 시 감지되도록 전체 문자열로 작성 */
export const CATEGORIES = {
  food: {
    label: '식사',
    icon: Utensils,
    hex: '#f97316',
    badge: 'bg-orange-50 text-orange-600 ring-orange-200',
    bar: 'bg-orange-500',
    soft: 'bg-orange-100 text-orange-600',
  },
  cafe: {
    label: '카페',
    icon: Coffee,
    hex: '#b45309',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    bar: 'bg-amber-600',
    soft: 'bg-amber-100 text-amber-700',
  },
  sightseeing: {
    label: '관광',
    icon: Camera,
    hex: '#0ea5e9',
    badge: 'bg-sky-50 text-sky-600 ring-sky-200',
    bar: 'bg-sky-500',
    soft: 'bg-sky-100 text-sky-600',
  },
  shopping: {
    label: '쇼핑',
    icon: ShoppingBag,
    hex: '#ec4899',
    badge: 'bg-pink-50 text-pink-600 ring-pink-200',
    bar: 'bg-pink-500',
    soft: 'bg-pink-100 text-pink-600',
  },
  lodging: {
    label: '숙박',
    icon: BedDouble,
    hex: '#8b5cf6',
    badge: 'bg-violet-50 text-violet-600 ring-violet-200',
    bar: 'bg-violet-500',
    soft: 'bg-violet-100 text-violet-600',
  },
  transport: {
    label: '교통',
    icon: Car,
    hex: '#10b981',
    badge: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-100 text-emerald-600',
  },
  etc: {
    label: '기타',
    icon: Sparkles,
    hex: '#64748b',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    bar: 'bg-slate-500',
    soft: 'bg-slate-200 text-slate-600',
  },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES)

/** 주요 국가별 통화 및 돈 단위 정의 */
export const CURRENCIES = {
  KRW: { code: 'KRW', name: '대한민국 원', symbol: '₩', unit: '원', rate: 1 },
  JPY: { code: 'JPY', name: '일본 엔', symbol: '¥', unit: '엔', rate: 9.2 },
  USD: { code: 'USD', name: '미국 달러', symbol: '$', unit: '달러', rate: 1350 },
  EUR: { code: 'EUR', name: '유럽 유로', symbol: '€', unit: '유로', rate: 1460 },
  TWD: { code: 'TWD', name: '대만 달러', symbol: 'NT$', unit: 'TWD', rate: 42 },
  THB: { code: 'THB', name: '태국 바트', symbol: '฿', unit: '바트', rate: 37 },
  VND: { code: 'VND', name: '베트남 동', symbol: '₫', unit: '동', rate: 0.054 },
  CNY: { code: 'CNY', name: '중국 위안', symbol: '¥', unit: '위안', rate: 186 },
  GBP: { code: 'GBP', name: '영국 파운드', symbol: '£', unit: '파운드', rate: 1720 },
  AUD: { code: 'AUD', name: '호주 달러', symbol: 'A$', unit: 'AUD', rate: 880 },
  SGD: { code: 'SGD', name: '싱가포르 달러', symbol: 'S$', unit: 'SGD', rate: 1010 },
  HKD: { code: 'HKD', name: '홍콩 달러', symbol: 'HK$', unit: 'HKD', rate: 173 },
}

export const getCurrency = (code) => CURRENCIES[code] || CURRENCIES.KRW

/** 통화에 맞춘 금액 포맷 함수 */
export const formatMoney = (amount, currencyCode = 'KRW') => {
  const num = Math.round(Number(amount) || 0)
  const curr = getCurrency(currencyCode)
  if (curr.code === 'KRW') {
    return `${num.toLocaleString('ko-KR')}원`
  }
  if (curr.code === 'JPY') {
    return `${num.toLocaleString('ja-JP')}엔`
  }
  if (curr.code === 'USD') {
    return `$${num.toLocaleString('en-US')}`
  }
  if (curr.code === 'EUR') {
    return `€${num.toLocaleString('de-DE')}`
  }
  if (curr.code === 'GBP') {
    return `£${num.toLocaleString('en-GB')}`
  }
  return `${curr.symbol}${num.toLocaleString()} ${curr.unit}`
}

export const won = (n) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 12)

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 시작일(YYYY-MM-DD)과 일수(dayCount)로부터
 * 시작일, 종료일, 요일, 몇박몇일을 모두 계산
 */
export const getTripPeriod = (start, days = 1) => {
  if (!start) return { fullPeriod: '', shortPeriod: '', nightDay: '', startDateStr: '', endDateStr: '', endDateIso: '' }
  const sDt = new Date(`${start}T00:00:00`)
  if (isNaN(sDt)) return { fullPeriod: start, shortPeriod: start, nightDay: `${days}일간`, startDateStr: start, endDateStr: '', endDateIso: start }

  const sYear = sDt.getFullYear()
  const sMonth = String(sDt.getMonth() + 1).padStart(2, '0')
  const sDate = String(sDt.getDate()).padStart(2, '0')
  const sDay = WEEK_DAYS[sDt.getDay()]

  const eDt = new Date(sDt)
  eDt.setDate(eDt.getDate() + Math.max(1, Number(days)) - 1)
  const eYear = eDt.getFullYear()
  const eMonth = String(eDt.getMonth() + 1).padStart(2, '0')
  const eDate = String(eDt.getDate()).padStart(2, '0')
  const eDay = WEEK_DAYS[eDt.getDay()]

  const sFull = `${sYear}.${sMonth}.${sDate} (${sDay})`
  const eFull = `${eYear}.${eMonth}.${eDate} (${eDay})`
  const nightDay = days - 1 > 0 ? `${days - 1}박 ${days}일` : '당일치기'
  const eIso = `${eYear}-${eMonth}-${eDate}`

  return {
    fullPeriod: `${sFull} ~ ${eFull}`,
    shortPeriod: `${sDt.getMonth() + 1}.${sDt.getDate()} ~ ${eDt.getMonth() + 1}.${eDt.getDate()}`,
    nightDay,
    startDateStr: sFull,
    endDateStr: eFull,
    endDateIso: eIso,
  }
}

/**
 * 시작일(YYYY-MM-DD)과 마지막일(YYYY-MM-DD)로부터 일수(dayCount) 계산
 */
export const calculateDayCount = (start, end) => {
  if (!start || !end) return 1
  const sDt = new Date(`${start}T00:00:00`)
  const eDt = new Date(`${end}T00:00:00`)
  if (isNaN(sDt) || isNaN(eDt)) return 1
  const diffTime = eDt.getTime() - sDt.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1)
}

/** 일차별 지도 마커 및 경로선 고유 테마 색상 팔레트 */
export const DAY_COLORS = [
  '#4f46e5', // 1일차: 인디고
  '#059669', // 2일차: 에메랄드
  '#d97706', // 3일차: 앰버
  '#e11d48', // 4일차: 로즈
  '#7c3aed', // 5일차: 바이올렛
  '#0284c7', // 6일차: 스카이블루
  '#0d9488', // 7일차: 틸
  '#c026d3', // 8일차: 푸시아
  '#475569', // 9일차: 슬레이트
]

export const getDayColor = (dayNum) => {
  const idx = Math.max(0, (Number(dayNum) || 1) - 1)
  return DAY_COLORS[idx % DAY_COLORS.length]
}

/** 24시간 형식 문자열("HH:mm")을 0~1439 분 단위 숫자로 파싱 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** 분 단위 숫자를 24시간 형식 문자열("HH:mm")로 변환 */
export const minutesToTime24 = (mins) => {
  if (mins === null || mins === undefined || isNaN(mins)) return '--:--'
  let normalized = mins
  let dayOffset = 0
  while (normalized < 0) {
    normalized += 1440
    dayOffset -= 1
  }
  while (normalized >= 1440) {
    normalized -= 1440
    dayOffset += 1
  }
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  if (dayOffset > 0) return `+${dayOffset}일 ${timeStr}`
  if (dayOffset < 0) return `${dayOffset}일 ${timeStr}`
  return timeStr
}

/** "약 1시간 30분", "약 25분", "40분" 등 이동시간 문자열을 분 단위 숫자로 파싱 */
export const parseDurationToMinutes = (durStr) => {
  if (!durStr || typeof durStr !== 'string') return 0
  let total = 0
  const hMatch = durStr.match(/(\d+)\s*시간/)
  const mMatch = durStr.match(/(\d+)\s*분/)
  if (hMatch) total += parseInt(hMatch[1], 10) * 60
  if (mMatch) total += parseInt(mMatch[1], 10)
  if (!hMatch && !mMatch) {
    const rawNum = parseInt(durStr.replace(/[^\d]/g, ''), 10)
    if (!isNaN(rawNum)) total = rawNum
  }
  return total
}

/**
 * 1번 일정과 2번 일정(다음 일정) 및 이동 시간을 기반으로
 * 1번 일정에서 언제까지 머무를 수 있는지(출발 한계 시각 및 체류 시간) 자동 계산
 */
export const calculateStayInfo = (currentItem, nextItem) => {
  if (!currentItem?.time || !nextItem?.time) return null

  const curMins = parseTimeToMinutes(currentItem.time)
  const nextMins = parseTimeToMinutes(nextItem.time)
  if (curMins === null || nextMins === null) return null

  // 1번 장소에서 2번 장소까지의 이동 소요시간
  const transitMins = parseDurationToMinutes(nextItem.transitDuration) || 10
  const transitText = nextItem.transitDuration || '약 10분'

  // 다음 일정 시작 시각에서 이동시간을 뺀 것이 1번 장소에서 출발해야 하는 한계 시각
  let departureMins = nextMins - transitMins
  if (departureMins < curMins && nextMins < curMins) {
    // 자정을 넘기는 스케줄
    departureMins += 1440
  }

  const untilTime = minutesToTime24(departureMins)
  const stayMins = departureMins - curMins

  let stayDurationText = ''
  let isShort = false
  if (stayMins < 0) {
    stayDurationText = '이동시간 부족'
    isShort = true
  } else if (stayMins < 60) {
    stayDurationText = `${stayMins}분`
  } else {
    const h = Math.floor(stayMins / 60)
    const m = stayMins % 60
    stayDurationText = m > 0 ? `${h}시간 ${m}분` : `${h}시간`
  }

  return {
    untilTime, // 예: "12:30" (24시간 형식)
    stayMins,
    stayDurationText, // 예: "2시간 30분"
    transitText, // 예: "약 30분"
    isShort,
  }
}

/** 새 일정 추가 시 빠르게 고를 수 있는 주요 장소 좌표 */
export const PLACE_PRESETS = [
  { name: '제주국제공항', lat: 33.5066, lng: 126.4929 },
  { name: '동문재래시장', lat: 33.5122, lng: 126.5266 },
  { name: '함덕해수욕장', lat: 33.5432, lng: 126.6697 },
  { name: '비자림', lat: 33.4908, lng: 126.8098 },
  { name: '한라산 성판악', lat: 33.3851, lng: 126.6196 },
  { name: '카멜리아힐', lat: 33.2896, lng: 126.3699 },
  { name: '산방산', lat: 33.2380, lng: 126.3137 },
  { name: '쇠소깍', lat: 33.2524, lng: 126.6237 },
  { name: '이호테우해변', lat: 33.4977, lng: 126.4531 },
  // 경주 / 부산 프리셋
  { name: '불국사', lat: 35.7901, lng: 129.3321 },
  { name: '첨성대', lat: 35.8347, lng: 129.2190 },
  { name: '황리단길', lat: 35.8384, lng: 129.2096 },
  { name: '해운대해수욕장', lat: 35.1587, lng: 129.1604 },
  { name: '광안리해수욕장', lat: 35.1532, lng: 129.1189 },
]

let n = 0
export const mk = (day, time, title, category, expense, lat, lng, memo = '', showOnMap = true, placeName = '') => ({
  id: `seed-${++n}`,
  day,
  time,
  title,
  showOnMap,
  lat,
  lng,
  expense,
  category,
  memo,
  placeName: placeName || title,
})

/** 준비물 카테고리 정의 (필수, 의류, 전자기기, 세면/화장품, 약, 식품, 기타) */
export const PACKING_CATEGORIES = ['필수', '의류', '전자기기', '세면/화장품', '약', '식품', '기타']

/** 카테고리별 배지 스타일 */
export const PACKING_CATEGORY_STYLES = {
  필수: 'bg-rose-50 text-rose-600 ring-rose-200',
  의류: 'bg-indigo-50 text-indigo-600 ring-indigo-200',
  전자기기: 'bg-blue-50 text-blue-600 ring-blue-200',
  '세면/화장품': 'bg-pink-50 text-pink-600 ring-pink-200',
  약: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  식품: 'bg-amber-50 text-amber-700 ring-amber-200',
  기타: 'bg-slate-100 text-slate-600 ring-slate-200',
}

/** 국내여행 기본 준비물 프리셋 */
export const DOMESTIC_PACKING_ITEMS = [
  // 필수
  { text: '신분증', category: '필수' },
  { text: '운전면허증', category: '필수' },
  { text: '숙소', category: '필수' },
  { text: '렌트카', category: '필수' },
  // 의류
  { text: '잠옷', category: '의류' },
  { text: '외출복', category: '의류' },
  { text: '양말', category: '의류' },
  { text: '속옷', category: '의류' },
  // 전자기기
  { text: '수면등', category: '전자기기' },
  { text: '핸드폰충전기', category: '전자기기' },
  { text: '보조배터리', category: '전자기기' },
  { text: '태블릿', category: '전자기기' },
  { text: '워치', category: '전자기기' },
  { text: '체온계', category: '전자기기' },
  { text: '면도기', category: '전자기기' },
  // 세면/화장품
  { text: '클렌징티슈', category: '세면/화장품' },
  { text: '칫솔', category: '세면/화장품' },
  { text: '치약', category: '세면/화장품' },
  { text: '바디워시', category: '세면/화장품' },
  { text: '샴푸', category: '세면/화장품' },
  { text: '클렌징폼', category: '세면/화장품' },
  { text: '토너', category: '세면/화장품' },
  { text: '로션', category: '세면/화장품' },
  { text: '크림', category: '세면/화장품' },
  { text: '썬크림', category: '세면/화장품' },
  { text: '앰플', category: '세면/화장품' },
  { text: '오일', category: '세면/화장품' },
  { text: '페이스 팩', category: '세면/화장품' },
  // 약
  { text: '약', category: '약' },
  { text: '상비약', category: '약' },
  { text: '모기퇴치제', category: '약' },
  { text: '종합영양제', category: '약' },
  { text: '유산균', category: '약' },
  { text: '오메가3', category: '약' },
  // 식품
  { text: '김', category: '식품' },
  { text: '간식', category: '식품' },
  { text: '음료', category: '식품' },
  { text: '물', category: '식품' },
  // 기타
  { text: '장난감', category: '기타' },
  { text: '책', category: '기타' },
  { text: '인형', category: '기타' },
  { text: '썬글라스', category: '기타' },
]

/** 해외여행 기본 준비물 프리셋 */
export const OVERSEAS_PACKING_ITEMS = [
  // 필수
  { text: '여권', category: '필수' },
  { text: '운전면허증', category: '필수' },
  { text: '변환 플러그', category: '필수' },
  { text: '이심', category: '필수' },
  { text: '여행자보험', category: '필수' },
  { text: '숙소', category: '필수' },
  { text: '렌트카', category: '필수' },
  { text: '항공권', category: '필수' },
  // 의류
  { text: '잠옷', category: '의류' },
  { text: '외출복', category: '의류' },
  { text: '양말', category: '의류' },
  { text: '속옷', category: '의류' },
  // 전자기기
  { text: '수면등', category: '전자기기' },
  { text: '핸드폰충전기', category: '전자기기' },
  { text: '보조배터리', category: '전자기기' },
  { text: '태블릿', category: '전자기기' },
  { text: '워치', category: '전자기기' },
  { text: '체온계', category: '전자기기' },
  { text: '면도기', category: '전자기기' },
  // 세면/화장품
  { text: '클렌징티슈', category: '세면/화장품' },
  { text: '칫솔', category: '세면/화장품' },
  { text: '치약', category: '세면/화장품' },
  { text: '바디워시', category: '세면/화장품' },
  { text: '샴푸', category: '세면/화장품' },
  { text: '클렌징폼', category: '세면/화장품' },
  { text: '토너', category: '세면/화장품' },
  { text: '로션', category: '세면/화장품' },
  { text: '크림', category: '세면/화장품' },
  { text: '썬크림', category: '세면/화장품' },
  { text: '앰플', category: '세면/화장품' },
  { text: '오일', category: '세면/화장품' },
  { text: '페이스 팩', category: '세면/화장품' },
  // 약
  { text: '약', category: '약' },
  { text: '상비약', category: '약' },
  { text: '모기퇴치제', category: '약' },
  { text: '종합영양제', category: '약' },
  { text: '유산균', category: '약' },
  { text: '오메가3', category: '약' },
  // 식품
  { text: '김', category: '식품' },
  { text: '간식', category: '식품' },
  { text: '음료', category: '식품' },
  { text: '물', category: '식품' },
  // 기타
  { text: '장난감', category: '기타' },
  { text: '책', category: '기타' },
  { text: '인형', category: '기타' },
  { text: '썬글라스', category: '기타' },
]

/** 2박 3일 제주 여행 샘플 데이터 */
export const SAMPLE_ITEMS_JEJU = [
  mk(1, '09:30', '제주공항 렌터카 픽업', 'transport', 89000, 33.5066, 126.4929, '완전자차 보험 포함, 셔틀 5번 승강장', true, '제주국제공항'),
  mk(1, '10:00', '편의점 간식 & 생수', 'etc', 8600, 0, 0, '차에 둘 생수 2L 구매', false),
  mk(1, '11:00', '애월 오션뷰 카페', 'cafe', 18000, 33.4630, 126.3105, '창가 오션뷰 자리, 한라봉 에이드 & 크루아상', true, '애월 카페거리'),
  mk(1, '12:30', '협재해수욕장', 'sightseeing', 0, 33.3940, 126.2397, '비양도 배경으로 사진 📸', true, '협재해수욕장'),
  mk(1, '13:30', '한림 고기국수', 'food', 24000, 33.4110, 126.2650, '웨이팅 20분', true, '한림 고기국수'),
  mk(1, '15:30', '오설록 티뮤지엄 카페', 'cafe', 32000, 33.3058, 126.2895, '녹차 아이스크림 & 롤케이크', true, '오설록 티뮤지엄'),
  mk(1, '18:00', '서귀포 오션뷰 호텔 체크인', 'lodging', 360000, 33.2470, 126.5600, '2박 결제 완료, 조식 포함', true, '서귀포 호텔'),
  mk(1, '19:30', '숙소 휴식', 'etc', 0, 0, 0, '내일 일출 대비 일찍 취침', false),

  mk(2, '07:30', '호텔 조식', 'food', 0, 0, 0, '숙박에 포함', false),
  mk(2, '09:00', '성산일출봉', 'sightseeing', 10000, 33.4580, 126.9425, '입장료 1인 5,000원 × 2', true, '성산일출봉'),
  mk(2, '11:00', '섭지코지', 'sightseeing', 0, 33.4240, 126.9310, '바람 강함, 겉옷 필수', true, '섭지코지'),
  mk(2, '12:30', '성산 해물라면', 'food', 30000, 33.4620, 126.9300, '', true, '성산 해물라면'),
  mk(2, '14:00', '우도 전기차 투어', 'transport', 46000, 33.5060, 126.9530, '도항선 왕복 + 전기차 3시간', true, '우도'),
  mk(2, '15:30', '우도 땅콩아이스크림 카페', 'cafe', 14000, 33.5010, 126.9550, '땅콩라떼 & 땅콩 아이스크림', true, '우도 카페'),
  mk(2, '17:30', '주유소 들르기', 'transport', 40000, 0, 0, '반납 전 가득 채우기 X, 절반만', false),
  mk(2, '19:00', '서귀포 흑돼지 저녁', 'food', 72000, 33.2500, 126.5630, '근고기 2인 + 볶음밥', true, '서귀포 흑돼지'),

  mk(3, '09:00', '체크아웃 준비', 'etc', 0, 0, 0, '충전기·우산 챙기기', false),
  mk(3, '10:00', '천지연폭포', 'sightseeing', 4000, 33.2468, 126.5545, '', true, '천지연폭포'),
  mk(3, '11:30', '중문 색달해변', 'sightseeing', 0, 33.2440, 126.4120, '서핑 구경', true, '중문색달해수욕장'),
  mk(3, '13:00', '동문시장 기념품 쇼핑', 'shopping', 45000, 33.5122, 126.5266, '오메기떡, 감귤초콜릿', true, '제주 동문재래시장'),
  mk(3, '14:30', '동문시장 야시장 먹거리', 'food', 28000, 33.5110, 126.5250, '흑돼지 김밥, 딱새우회', true, '제주 동문재래시장'),
  mk(3, '15:30', '공항 근처 베이커리 카페', 'cafe', 16000, 33.5020, 126.4890, '비행기 시간 전 휴식', true, '제주공항 카페'),
  mk(3, '16:00', '렌터카 반납', 'transport', 0, 0, 0, '반납 후 셔틀로 공항 이동', false),
  mk(3, '17:30', '제주공항 탑승', 'transport', 0, 33.5066, 126.4929, '탑승 30분 전 게이트', true, '제주국제공항'),
]

/** 경주 1박 2일 샘플 데이터 */
export const SAMPLE_ITEMS_GYEONGJU = [
  mk(1, '10:00', '신경주역 KTX 도착', 'transport', 45000, 35.7975, 129.1386, '역에서 700번 버스 탑승', true, '신경주역'),
  mk(1, '11:30', '황리단길 솥밥 점심', 'food', 34000, 35.8384, 129.2096, '스테이크 솥밥 & 전복 솥밥', true, '황리단길'),
  mk(1, '13:00', '황리단길 한옥 감성 카페', 'cafe', 17000, 35.8390, 129.2085, '시그니처 흑임자 라떼', true, '황리단길 카페'),
  mk(1, '14:30', '대릉원 & 천마총', 'sightseeing', 6000, 35.8360, 129.2140, '포토존 줄서기', true, '대릉원'),
  mk(1, '16:30', '첨성대 & 핑크뮬리', 'sightseeing', 0, 35.8347, 129.2190, '자전거 대여', true, '첨성대'),
  mk(1, '18:30', '한우 물회 저녁식사', 'food', 42000, 35.8450, 129.2150, '치즈 떡갈비 추가', true, '경주 한우물회'),
  mk(1, '20:00', '동궁과 월지(안압지) 야경', 'sightseeing', 6000, 35.8340, 129.2280, '야경 조명 관람 필수', true, '동궁과 월지'),
  mk(1, '21:30', '황리단길 한옥 게스트하우스', 'lodging', 120000, 35.8380, 129.2100, '조식 포함 온돌방', true, '황리단길 숙소'),

  mk(2, '09:00', '체크아웃 & 순두부 아침', 'food', 24000, 35.8390, 129.2110, '맷돌 순두부찌개', true, '경주 맷돌순두부'),
  mk(2, '10:30', '불국사 투어', 'sightseeing', 12000, 35.7901, 129.3321, '다보탑, 석가탑 감상', true, '불국사'),
  mk(2, '13:00', '보문단지 호수뷰 브런치 카페', 'cafe', 22000, 35.8420, 129.2800, '호수 전망 테라스 자리', true, '보문단지 카페'),
  mk(2, '15:00', '황남빵 & 십원빵 기념품', 'shopping', 32000, 35.8370, 129.2130, '가족 선물용 박스', true, '황남빵 본점'),
  mk(2, '17:00', '신경주역 KTX 귀가', 'transport', 45000, 35.7975, 129.1386, '', true, '신경주역'),
]

/** 나들이 기본 준비물 프리셋 */
export const OUTING_PACKING_ITEMS = [
  // 필수
  { text: '운전면허증', category: '필수' },
  { text: '관광지 찾기', category: '필수' },
  // 의류
  { text: '외투', category: '의류' },
  { text: '여분옷', category: '의류' },
  // 전자기기
  { text: '워치', category: '전자기기' },
  { text: '태블릿', category: '전자기기' },
  { text: '보조배터리', category: '전자기기' },
  // 세면/화장품
  { text: '칫솔세트', category: '세면/화장품' },
  // 약
  { text: '모기퇴치제', category: '약' },
  // 식품
  { text: '간식', category: '식품' },
  { text: '물', category: '식품' },
  { text: '음료', category: '식품' },
  { text: '김', category: '식품' },
  // 기타
  { text: '선글라스', category: '기타' },
  { text: '물티슈', category: '기타' },
]

/** 기본 초기 여행 플랜 목록 (준비물은 기본적으로 빈 배열 [] 로 제공) */
export const INITIAL_TRIPS = [
  {
    id: 'trip-jeju',
    tripType: 'domestic', // 국내여행
    title: '제주도 힐링 여행 🍊',
    description: '서쪽 애월부터 우도, 서귀포까지 만끽하는 2박 3일 코스',
    startDate: '2026-10-25',
    dayCount: 3,
    headcount: 2,
    badgeColor: 'from-orange-500 to-amber-500',
    coverEmoji: '🍊',
    items: SAMPLE_ITEMS_JEJU,
    packingList: [], // 기본 빈 상태
  },
  {
    id: 'trip-gyeongju',
    tripType: 'domestic', // 국내여행
    title: '경주 역사 & 감성 여행 🌸',
    description: '황리단길 카페 투어와 천년 고도의 야경을 담은 1박 2일',
    startDate: '2026-11-05',
    dayCount: 2,
    headcount: 2,
    badgeColor: 'from-pink-500 to-rose-500',
    coverEmoji: '🌸',
    items: SAMPLE_ITEMS_GYEONGJU,
    packingList: [], // 기본 빈 상태
  },
  {
    id: 'trip-busan',
    tripType: 'domestic', // 국내여행
    title: '부산 바다 & 미식 투어 🌊',
    description: '해운대 오션뷰, 광안리 드론쇼, 자갈치 시장 먹방 2박 3일',
    startDate: '2026-11-20',
    dayCount: 3,
    headcount: 3,
    badgeColor: 'from-sky-500 to-indigo-500',
    coverEmoji: '🌊',
    items: [
      mk(1, '11:00', '부산역 KTX 도착 & 돼지국밥', 'food', 33000, 35.1152, 129.0422, '부추 듬뿍 넣기', true, '부산역'),
      mk(1, '13:30', '흰여울문화마을 바다뷰 카페', 'cafe', 21000, 35.0772, 129.0456, '영도 오션뷰 테라스', true, '흰여울문화마을'),
      mk(1, '16:00', '광안리 해수욕장 산책', 'sightseeing', 0, 35.1532, 129.1189, '모래사장 걷기', true, '광안리해수욕장'),
      mk(1, '18:30', '광안리 민락회타운 저녁', 'food', 90000, 35.1555, 129.1245, '광어 & 우럭 모듬회', true, '민락회타운'),
      mk(1, '21:00', '해운대 오션뷰 호텔', 'lodging', 280000, 35.1587, 129.1604, '오션뷰 트윈룸', true, '해운대해수욕장'),
    ],
    packingList: [], // 기본 빈 상태
  },
  {
    id: 'trip-osaka',
    tripType: 'overseas', // 해외여행
    title: '오사카 먹방 & 유니버셜 🇯🇵',
    description: '도톤보리 맛집 탐방과 유니버셜 스튜디오 3박 4일',
    startDate: '2026-12-10',
    dayCount: 4,
    headcount: 2,
    badgeColor: 'from-purple-500 to-pink-500',
    coverEmoji: '🇯🇵',
    items: [
      mk(1, '10:30', '간사이 국제공항 도착', 'transport', 35000, 34.4320, 135.2304, '라피트 특급열차 탑승', true, '간사이 국제공항'),
      mk(1, '13:00', '도톤보리 라멘 점심', 'food', 24000, 34.6687, 135.5013, '이치란 본점', true, '이치란 도톤보리점'),
      mk(1, '15:00', '신사이바시 쇼핑', 'shopping', 50000, 34.6710, 135.5005, '드럭스토어 & 패션', true, '신사이바시스지'),
      mk(1, '18:30', '난바 이자카야 저녁', 'food', 60000, 34.6655, 135.5020, '꼬치구이 & 생맥주', true, '도톤보리'),
      mk(1, '21:00', '난바역 근처 호텔 체크인', 'lodging', 320000, 34.6640, 135.5010, '3박 연박 예약', true, '난바역'),
    ],
    packingList: [],
  },
]

export const SAMPLE_ITEMS = SAMPLE_ITEMS_JEJU
