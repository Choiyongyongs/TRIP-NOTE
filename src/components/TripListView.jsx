import { useState, useMemo } from 'react'
import {
  Plane,
  Plus,
  CalendarDays,
  MapPin,
  Users,
  CheckCircle2,
  CheckCheck,
  Receipt,
  Trash2,
  ChevronRight,
  Sparkles,
  Luggage,
  X,
  Coins,
} from 'lucide-react'
import { won, uid, getTripPeriod, calculateDayCount } from '../data'
import DateInput from './DateInput'

const EMOJI_OPTIONS = ['🍊', '🌸', '🌊', '✈️', '🏔️', '🏕️', '🎡', '🍣', '🏙️', '🚂']

/**
 * [요청사항] 여행 플랜 라이프사이클 상태 계산 함수
 * 1. 정산하기 버튼에서 '정산 저장하기' 누르면 -> "정산완료"
 * 2. 여행 마지막 날짜 + 1일 -> "여행완료"
 * 3. 여행 날짜 되면 (시작일 <= 오늘 <= 마지막날) -> "여행중"
 * 4. 체크리스트 다 체크되면 -> "준비완료"
 * 5. 일정 만들기 시작하면 -> "계획"
 */
export function getTripStatus(trip) {
  // 1. 정산완료 여부 우선 확인
  if (trip?.isSettled) {
    return {
      type: 'settled',
      label: '정산완료',
      className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 font-black',
      icon: Receipt,
    }
  }

  // 오늘 날짜 문자열 YYYY-MM-DD
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${date}`

  const startDate = trip?.startDate || todayStr
  const dayCount = Number(trip?.dayCount) || 1

  // 마지막 날짜 계산: startDate + (dayCount - 1)일
  const sDate = new Date(startDate + 'T00:00:00')
  const eDate = new Date(sDate)
  eDate.setDate(sDate.getDate() + Math.max(0, dayCount - 1))
  const endYear = eDate.getFullYear()
  const endMonth = String(eDate.getMonth() + 1).padStart(2, '0')
  const endDateVal = String(eDate.getDate()).padStart(2, '0')
  const endDateStr = `${endYear}-${endMonth}-${endDateVal}`

  // 마지막 날짜 + 1일 계산
  const dayAfterEnd = new Date(eDate)
  dayAfterEnd.setDate(eDate.getDate() + 1)
  const afterYear = dayAfterEnd.getFullYear()
  const afterMonth = String(dayAfterEnd.getMonth() + 1).padStart(2, '0')
  const afterDateVal = String(dayAfterEnd.getDate()).padStart(2, '0')
  const dayAfterEndStr = `${afterYear}-${afterMonth}-${afterDateVal}`

  // 2. 여행 마지막 날짜 + 1일 -> '여행완료' (또는 완료 처리된 경우)
  if (todayStr >= dayAfterEndStr || trip?.isCompleted) {
    return {
      type: 'completed',
      label: '여행완료',
      className: 'bg-purple-100 text-purple-900 ring-1 ring-purple-300 font-black',
      icon: CheckCheck,
    }
  }

  // 3. 여행 날짜 되면 (시작일 <= 오늘 <= 마지막날) -> '여행중'
  if (todayStr >= startDate && todayStr <= endDateStr) {
    return {
      type: 'traveling',
      label: '여행중',
      className: 'bg-indigo-600 text-white ring-2 ring-indigo-300 font-black shadow-xs animate-pulse',
      icon: Plane,
    }
  }

  // 4. 체크리스트 다 체크되면 -> '준비완료'
  const packingList = trip?.packingList || []
  if (packingList.length > 0 && packingList.every((item) => item.checked)) {
    return {
      type: 'ready',
      label: '준비완료',
      className: 'bg-teal-100 text-teal-900 ring-1 ring-teal-300 font-black',
      icon: CheckCircle2,
    }
  }

  // 5. 일정 만들기 시작하면 -> '계획' (기본 상태)
  return {
    type: 'planning',
    label: '계획',
    className: 'bg-sky-100 text-sky-800 ring-1 ring-sky-300 font-black',
    icon: Sparkles,
  }
}

export default function TripListView({
  trips,
  onSelectTrip,
  onCreateTrip,
  onDeleteTrip,
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newEmoji, setNewEmoji] = useState('✈️')
  const [newTripType, setNewTripType] = useState('domestic')
  const [newCurrency, setNewCurrency] = useState('JPY')
  
  // 시작일(오늘) 및 기본 마지막일(오늘+2일 = 2박 3일)
  const todayIso = new Date().toISOString().split('T')[0]
  const defaultEndIso = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  })()

  const [newStartDate, setNewStartDate] = useState(todayIso)
  const [newEndDate, setNewEndDate] = useState(defaultEndIso)
  const [newHeadcount, setNewHeadcount] = useState(2)

  // 시작일과 마지막일로부터 몇박몇일 자동 계산
  const calculatedDayCount = useMemo(
    () => calculateDayCount(newStartDate, newEndDate),
    [newStartDate, newEndDate]
  )
  const calculatedPeriod = useMemo(
    () => getTripPeriod(newStartDate, calculatedDayCount),
    [newStartDate, calculatedDayCount]
  )

  const handleStartDateChange = (val) => {
    setNewStartDate(val)
    if (newEndDate < val) {
      setNewEndDate(val)
    }
  }

  const handleEndDateChange = (val) => {
    if (val < newStartDate) {
      setNewEndDate(newStartDate)
    } else {
      setNewEndDate(val)
    }
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const newTrip = {
      id: `trip-${uid()}`,
      tripType: newTripType,
      title: `${newTitle.trim()} ${newEmoji}`,
      description: newDesc.trim() || `${calculatedPeriod.nightDay} 여행`,
      startDate: newStartDate,
      dayCount: Number(calculatedDayCount),
      headcount: Number(newHeadcount),
      badgeColor: newTripType === 'domestic' ? 'from-emerald-500 to-teal-600' : 'from-indigo-600 to-violet-600',
      coverEmoji: newEmoji,
      currency: newTripType === 'overseas' ? (newCurrency || 'JPY') : 'KRW',
      items: [],
      packingList: [],
    }

    onCreateTrip(newTrip)
    setModalOpen(false)
    setNewTitle('')
    setNewDesc('')
  }

  return (
    <div className="mx-auto max-w-[1700px] w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* ===== 상단 브랜드 히어로 (은은하고 깔끔한 모던 소프트 톤) ===== */}
      <section className="mb-8 rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Plane className="h-4.5 w-4.5 -rotate-12" />
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black tracking-wider text-slate-600 uppercase">
                TRIP NOTE
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl tracking-tight">
              나의 여행 플랜 목록
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm font-medium">
              여행 플랜을 선택하거나 새로운 여행을 계획해보세요. 일정, 지도, 준비물, 정산까지 한 번에 관리합니다.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-500/20 transition active:scale-95"
          >
            <Plus className="h-4.5 w-4.5 stroke-[2.5]" /> 새 여행 플랜 만들기
          </button>
        </div>
      </section>

      {/* ===== 여행 플랜 카드 그리드 ===== */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800">
          진행 중인 여행 플랜 ({trips.length})
        </h2>
        <span className="text-xs text-slate-400">카드를 클릭하여 상세 페이지로 이동합니다</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trips.map((trip) => {
          const tripTotal = trip.items.reduce((s, i) => s + (i.expense || 0), 0)
          const mapPointsCount = trip.items.filter((i) => i.showOnMap).length
          const packingChecked = trip.packingList ? trip.packingList.filter((p) => p.checked).length : 0
          const packingTotal = trip.packingList ? trip.packingList.length : 0
          const tripPeriodInfo = getTripPeriod(trip.startDate, trip.dayCount)

          return (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip.id)}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/90 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:ring-indigo-300"
            >
              {/* 상단: 이모지 & 삭제 버튼 */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                      {trip.coverEmoji || '✈️'}
                    </span>
                    <span
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-black shrink-0 ${
                        trip.tripType === 'overseas'
                          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}
                    >
                      {trip.tripType === 'overseas' ? '해외여행' : '국내여행'}
                    </span>

                    {/* [요청사항] 여행 라이프사이클 상태 뱃지 (계획 -> 준비완료 -> 여행중 -> 여행완료 -> 정산완료) */}
                    {(() => {
                      const status = getTripStatus(trip)
                      const StatusIcon = status.icon
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] shadow-2xs shrink-0 ${status.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          <span>{status.label}</span>
                        </span>
                      )
                    })()}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`'${trip.title}' 여행 플랜을 삭제하시겠습니까?`)) {
                        onDeleteTrip(trip.id)
                      }
                    }}
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                    title="플랜 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* 제목 위에 시작날짜와 끝 날짜 뱃지 */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-indigo-700 bg-indigo-50/90 px-2.5 py-1.5 rounded-xl ring-1 ring-indigo-200/70 w-fit">
                  <CalendarDays className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>{tripPeriodInfo.fullPeriod}</span>
                  <span className="text-[10px] font-black text-indigo-900 bg-white px-1.5 py-0.5 rounded-md shadow-xs ring-1 ring-indigo-100">
                    {tripPeriodInfo.nightDay}
                  </span>
                </div>

                {/* 플랜 제목 & 설명 */}
                <h3 className="mt-2 text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {trip.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                  {trip.description || '여행 코스를 계획하고 준비해보세요.'}
                </p>

                {/* 일정 & 인원 요약 뱃지 */}
                <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1">
                    <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                    {tripPeriodInfo.nightDay}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1">
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    {trip.headcount}명
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    지도 {mapPointsCount}곳
                  </span>
                </div>
              </div>

              {/* 하단: 준비물 & 총 경비 & 화살표 */}
              <div className="mt-5 border-t border-slate-100 pt-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Luggage className="h-3.5 w-3.5" />
                    준비물 {packingChecked}/{packingTotal}개
                  </span>
                  <span className="font-extrabold text-slate-900 tabular-nums">
                    총 {won(tripTotal)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between font-bold text-xs text-indigo-600 group-hover:text-indigo-700">
                  <span>플랜 열기 (일정·지도·준비물·정산)</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== 새 여행 만들기 모달 ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <form
            onSubmit={handleCreateSubmit}
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">새 여행 플랜 만들기</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              {/* 여행 유형 (국내 / 해외) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  여행 유형 (지도 연동) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTripType('domestic')}
                    className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-extrabold transition ${
                      newTripType === 'domestic'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    국내여행 (네이버 지도)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTripType('overseas')}
                    className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-extrabold transition ${
                      newTripType === 'overseas'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ✈️ 해외여행 (구글 지도)
                  </button>
                </div>
              </div>

              {/* 해외여행 시 기본 통화(돈 단위) 선택 */}
              {newTripType === 'overseas' && (
                <div className="rounded-2xl bg-indigo-50/70 p-3.5 ring-1 ring-indigo-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-indigo-600" />
                      해외여행 기본 돈 단위(통화) 선택 *
                    </label>
                    <span className="text-[11px] font-semibold text-indigo-600">
                      일정 등록 시 기본 적용
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {[
                      { code: 'JPY', label: '일본 엔', symbol: '¥ (엔)' },
                      { code: 'USD', label: '미국 달러', symbol: '$ (달러)' },
                      { code: 'EUR', label: '유럽 유로', symbol: '€ (유로)' },
                      { code: 'TWD', label: '대만 달러', symbol: 'NT$' },
                      { code: 'THB', label: '태국 바트', symbol: '฿ (바트)' },
                      { code: 'VND', label: '베트남 동', symbol: '₫ (동)' },
                      { code: 'CNY', label: '중국 위안', symbol: '¥ (위안)' },
                      { code: 'GBP', label: '영국 파운드', symbol: '£' },
                    ].map((cur) => (
                      <button
                        type="button"
                        key={cur.code}
                        onClick={() => setNewCurrency(cur.code)}
                        className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition active:scale-95 ${
                          newCurrency === cur.code
                            ? 'bg-indigo-600 text-white font-black shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white text-slate-700 hover:bg-indigo-50/50 ring-1 ring-slate-200'
                        }`}
                      >
                        <span className="text-[10px] opacity-80">{cur.label}</span>
                        <span className="text-xs font-extrabold">{cur.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  대표 이모지
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => setNewEmoji(em)}
                      className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition active:scale-90 ${
                        newEmoji === em
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  여행 제목 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예) 제주도 힐링 여행, 경주 벚꽃 여행"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-2.5 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  여행 한 줄 설명
                </label>
                <input
                  type="text"
                  placeholder="예) 애월 오션뷰 카페와 흑돼지 맛집 탐방"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-2.5 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* 여행 일정: 시작일 & 마지막일 입력 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-indigo-500" /> 시작일 *
                  </label>
                  <DateInput
                    required
                    value={newStartDate}
                    onChange={handleStartDateChange}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-indigo-500" /> 마지막일(종료일) *
                  </label>
                  <DateInput
                    required
                    min={newStartDate}
                    value={newEndDate}
                    onChange={handleEndDateChange}
                  />
                </div>
              </div>

              {/* 자동 계산된 몇박몇일 안내 카드 */}
              <div className="rounded-2xl bg-indigo-50/80 p-3 ring-1 ring-indigo-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-600">📅 자동 계산된 여행 일정:</span>
                  <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-xs">
                    {calculatedPeriod.nightDay} ({calculatedDayCount}일간)
                  </span>
                </div>
                <p className="mt-1 text-xs font-extrabold text-indigo-950">
                  {calculatedPeriod.fullPeriod}
                </p>
              </div>

              {/* 동행 인원 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  <Users className="inline h-3.5 w-3.5 mr-1 text-indigo-500" /> 동행 인원 (명) *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewHeadcount((h) => Math.max(1, Number(h) - 1))}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 font-extrabold hover:bg-slate-200 active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newHeadcount}
                    onChange={(e) => setNewHeadcount(Math.max(1, Number(e.target.value)))}
                    className="w-20 text-center rounded-xl border-0 bg-slate-50 py-2 text-sm font-extrabold ring-1 ring-slate-200 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNewHeadcount((h) => Number(h) + 1)}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 font-extrabold hover:bg-slate-200 active:scale-95"
                  >
                    +
                  </button>
                  <span className="text-xs font-semibold text-slate-500 ml-1">명</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> 생성하기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
