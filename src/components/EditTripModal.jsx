import { useState, useEffect, useMemo } from 'react'
import { X, CalendarDays, Users, Check, Coins } from 'lucide-react'
import { getTripPeriod, calculateDayCount } from '../data'
import DateInput from './DateInput'

const EMOJI_OPTIONS = ['🍊', '🌸', '🌊', '✈️', '🏔️', '🏕️', '🎡', '🍣', '🏙️', '🚂']

export default function EditTripModal({
  open,
  onClose,
  trip,
  onSave,
}) {
  const [title, setTitle] = useState(trip?.title || '')
  const [tripType, setTripType] = useState(trip?.tripType || 'domestic')
  const [currency, setCurrency] = useState(trip?.currency || 'JPY')
  const [startDate, setStartDate] = useState(trip?.startDate || '')
  const [endDate, setEndDate] = useState('')
  const [headcount, setHeadcount] = useState(trip?.headcount || 2)
  const [coverEmoji, setCoverEmoji] = useState(trip?.coverEmoji || '✈️')

  useEffect(() => {
    if (open && trip) {
      const s = trip.startDate || new Date().toISOString().split('T')[0]
      const period = getTripPeriod(s, trip.dayCount || 3)
      setTitle(trip.title || '')
      setTripType(trip.tripType || 'domestic')
      setCurrency(trip.currency || (trip.tripType === 'overseas' ? 'JPY' : 'KRW'))
      setStartDate(s)
      setEndDate(period.endDateIso || s)
      setHeadcount(trip.headcount || 2)
      setCoverEmoji(trip.coverEmoji || '✈️')
    }
  }, [open, trip])

  const calculatedDayCount = useMemo(
    () => calculateDayCount(startDate, endDate),
    [startDate, endDate]
  )
  const calculatedPeriod = useMemo(
    () => getTripPeriod(startDate, calculatedDayCount),
    [startDate, calculatedDayCount]
  )

  const handleStartDateChange = (val) => {
    setStartDate(val)
    if (endDate < val) {
      setEndDate(val)
    }
  }

  const handleEndDateChange = (val) => {
    if (val < startDate) {
      setEndDate(startDate)
    } else {
      setEndDate(val)
    }
  }

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return

    onSave({
      title: title.trim(),
      tripType,
      currency: tripType === 'overseas' ? (currency || 'JPY') : 'KRW',
      startDate,
      dayCount: Number(calculatedDayCount),
      headcount: Math.max(1, Number(headcount)),
      coverEmoji,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto animate-fade rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 font-black">
              ✎
            </span>
            <h3 className="text-lg font-extrabold text-slate-900">여행 정보 수정</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                onClick={() => setTripType('domestic')}
                className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-extrabold transition ${
                  tripType === 'domestic'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                국내여행 (네이버 지도)
              </button>
              <button
                type="button"
                onClick={() => setTripType('overseas')}
                className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-extrabold transition ${
                  tripType === 'overseas'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✈️ 해외여행 (구글 지도)
              </button>
            </div>
          </div>

          {/* 해외여행 시 기본 통화(돈 단위) 선택 */}
          {tripType === 'overseas' && (
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
                    onClick={() => setCurrency(cur.code)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition active:scale-95 ${
                      currency === cur.code
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

          {/* 대표 이모지 */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">대표 이모지</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setCoverEmoji(em)}
                  className={`grid h-9 w-9 place-items-center rounded-xl text-lg transition active:scale-90 ${
                    coverEmoji === em
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* 여행 제목 */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">여행 플랜 제목 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-2.5 text-sm font-bold ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* 여행 일정: 시작일 & 마지막일 입력 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-indigo-500" /> 시작일 *
              </label>
              <DateInput
                required
                value={startDate}
                onChange={handleStartDateChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-indigo-500" /> 마지막일(종료일) *
              </label>
              <DateInput
                required
                min={startDate}
                value={endDate}
                onChange={handleEndDateChange}
              />
            </div>
          </div>

          {/* 계산된 여행 일정 미리보기 카드 */}
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
              <Users className="inline h-3.5 w-3.5 mr-1 text-indigo-500" /> 총 동행 인원 (명)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHeadcount((h) => Math.max(1, Number(h) - 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="50"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="w-24 text-center rounded-2xl border-0 bg-slate-50 py-2 text-base font-black ring-1 ring-slate-200 focus:bg-white focus:outline-none tabular-nums"
              />
              <button
                type="button"
                onClick={() => setHeadcount((h) => Math.min(50, Number(h) + 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 active:scale-95"
              >
                +
              </button>
              <span className="text-xs text-slate-500 font-medium">명 (1/N 정산에 반영)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-700 active:scale-95"
          >
            <Check className="h-4 w-4" /> 저장하기
          </button>
        </div>
      </form>
    </div>
  )
}
