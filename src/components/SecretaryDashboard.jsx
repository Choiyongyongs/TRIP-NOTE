import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  CloudSun,
  CloudRain,
  Sun,
  Cloud,
  Snowflake,
  Wind,
  Shirt,
  Utensils,
  Upload,
  CalendarDays,
  Plus,
  Trash2,
  Check,
  TrendingUp,
  ExternalLink,
  Baby,
  Briefcase,
  Home,
  PackageCheck,
  PartyPopper,
  AlertCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import DateInput, { formatDateWithDay } from './DateInput'
import {
  getTodayKstString,
  fetchCachedBriefing,
  generateBriefingViaEdge,
  fetchSchedulesByDate,
  fetchUpcomingSchedules,
  addScheduleItem,
  toggleScheduleDone,
  deleteScheduleItem,
  fetchMealByDate,
  fetchMealsByMonth,
  uploadAndParseMealFile,
  uploadAndParseDaycareScheduleFile,
} from '../services/secretaryService'

const DAYCARE_CATEGORY_KEYS = ['daycare', 'supplies', 'event']
const PERSONAL_FAMILY_CATEGORY_KEYS = ['personal', 'family']

const ALL_CATEGORIES = [
  {
    key: 'daycare',
    label: '어린이집',
    icon: Baby,
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    active: 'bg-amber-500 text-white ring-amber-500',
  },
  {
    key: 'supplies',
    label: '준비물',
    icon: PackageCheck,
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    active: 'bg-emerald-600 text-white ring-emerald-600',
  },
  {
    key: 'event',
    label: '행사',
    icon: PartyPopper,
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    active: 'bg-rose-600 text-white ring-rose-600',
  },
  {
    key: 'personal',
    label: '개인 일정',
    icon: Briefcase,
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    active: 'bg-indigo-600 text-white ring-indigo-600',
  },
  {
    key: 'family',
    label: '가족 일정',
    icon: Home,
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    active: 'bg-sky-600 text-white ring-sky-600',
  },
]

const DAYCARE_CATEGORIES = ALL_CATEGORIES.filter((c) => DAYCARE_CATEGORY_KEYS.includes(c.key))
const PERSONAL_FAMILY_CATEGORIES = ALL_CATEGORIES.filter((c) =>
  PERSONAL_FAMILY_CATEGORY_KEYS.includes(c.key)
)

function getCategoryMeta(key) {
  return ALL_CATEGORIES.find((c) => c.key === key) || ALL_CATEGORIES[3]
}

function getAirBadgeStyle(grade) {
  if (grade === '좋음' || grade === '낮음') return 'bg-emerald-100 text-emerald-800'
  if (grade === '보통') return 'bg-sky-100 text-sky-800'
  if (grade === '나쁨' || grade === '높음') return 'bg-amber-100 text-amber-900'
  if (grade === '매우나쁨' || grade === '매우높음' || grade === '위험')
    return 'bg-rose-100 text-rose-800'
  return 'bg-slate-100 text-slate-500'
}

function WeatherIcon({ code, className = 'h-8 w-8' }) {
  if (code === 'Rain' || code === 'Drizzle' || code === 'Thunderstorm') {
    return <CloudRain className={`${className} text-sky-600`} />
  }
  if (code === 'Snow') {
    return <Snowflake className={`${className} text-cyan-500`} />
  }
  if (code === 'Clouds' || code === 'Mist') {
    return <Cloud className={`${className} text-slate-500`} />
  }
  if (code === 'Clear') {
    return <Sun className={`${className} text-amber-500`} />
  }
  return <CloudSun className={`${className} text-indigo-500`} />
}

export default function SecretaryDashboard({ onBackToTrips }) {
  const [selectedDate, setSelectedDate] = useState(() => getTodayKstString())

  // 브리핑 캐시 상태
  const [briefing, setBriefing] = useState(null)
  const [briefingCached, setBriefingCached] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [refreshingBriefing, setRefreshingBriefing] = useState(false)
  const [briefingError, setBriefingError] = useState('')

  // 어린이집 식단 상태
  const [todayMeal, setTodayMeal] = useState(null)
  const [monthMeals, setMonthMeals] = useState([])
  const [showMonthMeals, setShowMonthMeals] = useState(false)
  const [uploadingMeal, setUploadingMeal] = useState(false)
  const [mealStatusMsg, setMealStatusMsg] = useState('')
  const mealFileInputRef = useRef(null)

  // 전체 일정 원본 상태
  const [schedules, setSchedules] = useState([])
  const [upcomingSchedules, setUpcomingSchedules] = useState([])
  const [dbError, setDbError] = useState('')

  // 어린이집 스케줄 섹션 상태 (업로드 + 수동추가 토글)
  const [daycareScope, setDaycareScope] = useState('upcoming') // 'selected' | 'upcoming'
  const [showDaycareAddForm, setShowDaycareAddForm] = useState(false)
  const [dcDate, setDcDate] = useState(() => getTodayKstString())
  const [dcTime, setDcTime] = useState('')
  const [dcCategory, setDcCategory] = useState('daycare')
  const [dcTitle, setDcTitle] = useState('')
  const [dcMemo, setDcMemo] = useState('')
  const [savingDc, setSavingDc] = useState(false)
  const [uploadingDcSchedule, setUploadingDcSchedule] = useState(false)
  const [dcStatusMsg, setDcStatusMsg] = useState('')
  const daycareScheduleInputRef = useRef(null)

  // 개인 · 가족 일정 섹션 상태
  const [familyScope, setFamilyScope] = useState('upcoming') // 'selected' | 'upcoming'
  const [pfDate, setPfDate] = useState(() => getTodayKstString())
  const [pfTime, setPfTime] = useState('')
  const [pfCategory, setPfCategory] = useState('family')
  const [pfTitle, setPfTitle] = useState('')
  const [pfMemo, setPfMemo] = useState('')
  const [savingPf, setSavingPf] = useState(false)

  const selectedYearMonth = useMemo(() => selectedDate.slice(0, 7), [selectedDate])

  const handleChangeDate = (nextDate) => {
    if (!nextDate) return
    setSelectedDate(nextDate)
    setDcDate(nextDate)
    setPfDate(nextDate)
  }

  // DB에서 캐시된 데이터만 빠르게 로드 (Edge Function 미호출 -> 429 방어)
  const loadDashboardFromDb = useCallback(async (dateStr) => {
    setLoadingInitial(true)
    setDbError('')
    setBriefingError('')
    try {
      const ym = dateStr.slice(0, 7)
      const [cachedBrief, mealRow, monthList, dayScheds, upcoming] = await Promise.all([
        fetchCachedBriefing(dateStr),
        fetchMealByDate(dateStr),
        fetchMealsByMonth(ym),
        fetchSchedulesByDate(dateStr),
        fetchUpcomingSchedules(dateStr, 40),
      ])
      setBriefing(cachedBrief)
      setBriefingCached(Boolean(cachedBrief))
      setTodayMeal(mealRow)
      setMonthMeals(monthList)
      setSchedules(dayScheds)
      setUpcomingSchedules(upcoming)
    } catch (err) {
      console.error('일상 비서 DB 로드 오류:', err)
      setDbError(
        err instanceof Error
          ? err.message
          : 'Supabase DB 조회 중 오류가 발생했습니다. secretary_* 테이블 생성 여부를 확인해주세요.'
      )
    } finally {
      setLoadingInitial(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardFromDb(selectedDate)
  }, [selectedDate, loadDashboardFromDb])

  const reloadSchedules = async () => {
    const [dayScheds, upcoming] = await Promise.all([
      fetchSchedulesByDate(selectedDate),
      fetchUpcomingSchedules(selectedDate, 40),
    ])
    setSchedules(dayScheds)
    setUpcomingSchedules(upcoming)
  }

  // Edge Function 호출 (브리핑 최초 생성 또는 수동 새로고침)
  const handleRefreshBriefing = async (force = true) => {
    if (refreshingBriefing) return
    setRefreshingBriefing(true)
    setBriefingError('')
    try {
      const res = await generateBriefingViaEdge(selectedDate, { force })
      if (res?.data) {
        setBriefing(res.data)
        setBriefingCached(Boolean(res.cached))
      }
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : '브리핑 생성 중 오류가 발생했습니다.')
    } finally {
      setRefreshingBriefing(false)
    }
  }

  // 어린이집 일정 수동 등록
  const handleAddDaycareSchedule = async (e) => {
    e.preventDefault()
    if (!dcTitle.trim() || savingDc) return
    setSavingDc(true)
    setDbError('')
    try {
      await addScheduleItem({
        schedule_date: dcDate || selectedDate,
        schedule_time: dcTime,
        category: dcCategory,
        title: dcTitle,
        memo: dcMemo,
      })
      setDcTitle('')
      setDcMemo('')
      setDcTime('')
      setShowDaycareAddForm(false)
      await reloadSchedules()
    } catch (err) {
      setDbError(err instanceof Error ? err.message : '어린이집 일정 등록에 실패했습니다.')
    } finally {
      setSavingDc(false)
    }
  }

  // 개인 · 가족 일정 수동 등록
  const handleAddPersonalFamilySchedule = async (e) => {
    e.preventDefault()
    if (!pfTitle.trim() || savingPf) return
    setSavingPf(true)
    setDbError('')
    try {
      await addScheduleItem({
        schedule_date: pfDate || selectedDate,
        schedule_time: pfTime,
        category: pfCategory,
        title: pfTitle,
        memo: pfMemo,
      })
      setPfTitle('')
      setPfMemo('')
      setPfTime('')
      await reloadSchedules()
    } catch (err) {
      setDbError(err instanceof Error ? err.message : '일정 등록에 실패했습니다.')
    } finally {
      setSavingPf(false)
    }
  }

  // 일정 완료 토글
  const handleToggleSchedule = async (item) => {
    try {
      const updated = await toggleScheduleDone(item.id, !item.is_done)
      if (updated) {
        setSchedules((prev) => prev.map((s) => (s.id === item.id ? updated : s)))
        setUpcomingSchedules((prev) => prev.map((s) => (s.id === item.id ? updated : s)))
      }
    } catch (err) {
      setDbError(err instanceof Error ? err.message : '일정 상태 변경에 실패했습니다.')
    }
  }

  // 일정 삭제
  const handleDeleteSchedule = async (item) => {
    if (!confirm(`'${item.title}' 일정을 삭제할까요?`)) return
    try {
      await deleteScheduleItem(item.id)
      setSchedules((prev) => prev.filter((s) => s.id !== item.id))
      setUpcomingSchedules((prev) => prev.filter((s) => s.id !== item.id))
    } catch (err) {
      setDbError(err instanceof Error ? err.message : '일정 삭제에 실패했습니다.')
    }
  }

  // 어린이집 식단표 업로드 및 AI 분석
  const handleMealFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadingMeal(true)
    setMealStatusMsg('식단표를 업로드하고 Gemini 3.8 Flash로 날짜별 메뉴를 분석 중입니다...')
    try {
      const result = await uploadAndParseMealFile(file, selectedYearMonth)
      const count = result?.count || 0
      setMealStatusMsg(`✅ 총 ${count}일 치 어린이집 식단표가 자동 분석되어 DB에 저장되었습니다.`)
      const [mealRow, monthList] = await Promise.all([
        fetchMealByDate(selectedDate),
        fetchMealsByMonth(selectedYearMonth),
      ])
      setTodayMeal(mealRow)
      setMonthMeals(monthList)
    } catch (err) {
      setMealStatusMsg(
        `❌ ${err instanceof Error ? err.message : '식단표 분석 중 오류가 발생했습니다.'}`
      )
    } finally {
      setUploadingMeal(false)
    }
  }

  // 어린이집 주간/격주 스케줄표 업로드 및 AI 분석
  const handleDaycareScheduleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadingDcSchedule(true)
    setDcStatusMsg('어린이집 스케줄표를 업로드하고 날짜별 일정·준비물을 분석 중입니다...')
    try {
      const result = await uploadAndParseDaycareScheduleFile(file, selectedYearMonth)
      const count = result?.count || 0
      setDcStatusMsg(`✅ 총 ${count}건의 어린이집 일정/준비물이 자동 등록되었습니다.`)
      await reloadSchedules()
    } catch (err) {
      setDcStatusMsg(
        `❌ ${err instanceof Error ? err.message : '스케줄표 분석 중 오류가 발생했습니다.'}`
      )
    } finally {
      setUploadingDcSchedule(false)
    }
  }

  // 카테고리별 일정 분리
  const daycareSelected = useMemo(
    () => schedules.filter((s) => DAYCARE_CATEGORY_KEYS.includes(s.category)),
    [schedules]
  )
  const daycareUpcoming = useMemo(
    () => upcomingSchedules.filter((s) => DAYCARE_CATEGORY_KEYS.includes(s.category)),
    [upcomingSchedules]
  )
  const displayedDaycareSchedules =
    daycareScope === 'upcoming' ? daycareUpcoming : daycareSelected

  const familySelected = useMemo(
    () => schedules.filter((s) => !DAYCARE_CATEGORY_KEYS.includes(s.category)),
    [schedules]
  )
  const familyUpcoming = useMemo(
    () => upcomingSchedules.filter((s) => !DAYCARE_CATEGORY_KEYS.includes(s.category)),
    [upcomingSchedules]
  )
  const displayedFamilySchedules =
    familyScope === 'upcoming' ? familyUpcoming : familySelected

  const weather = briefing?.weather_json || null
  const ai = briefing?.ai_briefing_json || null
  const economy = briefing?.economy_json || null

  const updatedTimeLabel = useMemo(() => {
    if (!briefing?.updated_at) return null
    const d = new Date(briefing.updated_at)
    if (isNaN(d.getTime())) return null
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }, [briefing?.updated_at])

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-16">
      {/* ===== 상단 고정 헤더 ===== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 좌측: 최가네 허브 뒤로가기 + 타이틀 */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onBackToTrips}
                className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 px-3 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200/80 transition active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>최가네 허브</span>
              </button>

              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
                <Sparkles className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600">
                    일상
                  </span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                    gemini-3.8-flash
                  </span>
                </div>
                <h1 className="truncate text-base sm:text-lg font-black text-slate-900 leading-tight">
                  일상 비서 종합 대시보드
                </h1>
              </div>
            </div>

            {/* 우측: 날짜 선택기 + 브리핑 새로고침 버튼 */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44 sm:w-48">
                <DateInput
                  id="secretary-date-picker"
                  value={selectedDate}
                  onChange={handleChangeDate}
                />
              </div>

              <button
                type="button"
                onClick={() => handleRefreshBriefing(true)}
                disabled={refreshingBriefing}
                className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm shadow-indigo-500/20 transition active:scale-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingBriefing ? 'animate-spin' : ''}`} />
                <span>{refreshingBriefing ? 'AI 브리핑 생성 중...' : '브리핑 새로고침'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== 메인 대시보드 인라인 그리드 ===== */}
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-5 space-y-5">
        {/* DB / Edge Function 에러 안내 배너 */}
        {(dbError || briefingError) && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 p-4 text-xs text-rose-700 ring-1 ring-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="space-y-1">
              <p className="font-extrabold">연동 확인이 필요합니다</p>
              <p className="leading-relaxed">{briefingError || dbError}</p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ROW 1: 오늘의 날씨 (좌 4칸: 최저/최고 + 미세먼지/초미세먼지/자외선) + AI 종합 브리핑 (우 8칸) */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* 1. 오늘의 날씨 카드 (충남 아산시) */}
          <section className="lg:col-span-4 rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                    <CloudSun className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">오늘의 날씨</h2>
                    <p className="text-[11px] font-semibold text-slate-400">
                      충남 아산시 · {formatDateWithDay(selectedDate)}
                    </p>
                  </div>
                </div>
                {weather?.source && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    {weather.source}
                  </span>
                )}
              </div>

              {weather && weather.temp_min !== null && weather.temp_max !== null ? (
                <div className="mt-4 space-y-3.5">
                  {/* 최저 / 최고 기온 + 날씨 상태 (현재 기온 제외) */}
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200/70">
                      <WeatherIcon code={weather.weather_code} className="h-8 w-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-500 mb-0.5">
                        {weather.condition}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-sky-600 tabular-nums">
                          최저 {weather.temp_min}°
                        </span>
                        <span className="text-slate-300 font-bold">/</span>
                        <span className="text-2xl font-black text-rose-500 tabular-nums">
                          최고 {weather.temp_max}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 강수확률 · 미세먼지 · 초미세먼지 · 자외선지수 4칸 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-sky-50/70 p-2.5 ring-1 ring-sky-200/70">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-sky-700">
                        <CloudRain className="h-3 w-3 text-sky-600" /> 강수확률
                      </span>
                      <p className="mt-1 text-sm font-black text-sky-800 tabular-nums">
                        {weather.rain_prob ?? 0}%
                      </p>
                    </div>

                    <div className="rounded-2xl bg-amber-50/60 p-2.5 ring-1 ring-amber-200/70">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-800">
                          <Sun className="h-3 w-3 text-amber-600" /> 자외선지수
                        </span>
                        {weather.uv_grade && weather.uv_grade !== '-' && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${getAirBadgeStyle(
                              weather.uv_grade
                            )}`}
                          >
                            {weather.uv_grade}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-900 tabular-nums">
                        {weather.uv_index !== null && weather.uv_index !== undefined
                          ? weather.uv_index
                          : '-'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                          <Wind className="h-3 w-3 text-slate-500" /> 미세먼지
                        </span>
                        {weather.pm10_grade && weather.pm10_grade !== '-' && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${getAirBadgeStyle(
                              weather.pm10_grade
                            )}`}
                          >
                            {weather.pm10_grade}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-900 tabular-nums">
                        {weather.pm10 !== null && weather.pm10 !== undefined
                          ? `${weather.pm10} ㎍/㎥`
                          : '-'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                          <Wind className="h-3 w-3 text-indigo-500" /> 초미세먼지
                        </span>
                        {weather.pm2_5_grade && weather.pm2_5_grade !== '-' && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${getAirBadgeStyle(
                              weather.pm2_5_grade
                            )}`}
                          >
                            {weather.pm2_5_grade}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-900 tabular-nums">
                        {weather.pm2_5 !== null && weather.pm2_5 !== undefined
                          ? `${weather.pm2_5} ㎍/㎥`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
                  <p className="text-xs font-bold text-slate-500">
                    저장된 날씨 데이터가 없습니다.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    상단 &lsquo;브리핑 새로고침&rsquo;을 누르면 아산시 최저/최고 기온, 미세먼지, 자외선지수가 수집됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* 옷차림 & 우산 안내 */}
            {ai?.outfit_tip && (
              <div className="mt-4 rounded-2xl bg-indigo-50/70 p-3.5 ring-1 ring-indigo-200/70">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900 mb-1">
                  <Shirt className="h-3.5 w-3.5 text-indigo-600" />
                  오늘의 옷차림 · 외출 안내
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">{ai.outfit_tip}</p>
              </div>
            )}
          </section>

          {/* 2. AI 종합 브리핑 카드 (유지) */}
          <section className="lg:col-span-8 rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                    <Sparkles className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">오늘의 AI 종합 브리핑</h2>
                    <p className="text-[11px] font-semibold text-slate-400">
                      날씨 · 아이 식단 · 일정 · 경제 시황을 1회 통합 요약 (DB 캐시 저장)
                    </p>
                  </div>
                </div>

                {briefing && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${
                      briefingCached
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                    }`}
                  >
                    {briefingCached ? 'DB 캐시 로드' : '방금 생성됨'}
                    {updatedTimeLabel ? ` · ${updatedTimeLabel}` : ''}
                  </span>
                )}
              </div>

              {loadingInitial ? (
                <div className="py-14 text-center text-xs font-semibold text-slate-400">
                  저장된 브리핑과 일정을 불러오는 중입니다...
                </div>
              ) : ai ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                    <p className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                      {ai.greeting || '오늘도 활기차고 건강한 하루 되세요!'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-200/70 space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                        <CalendarDays className="h-4 w-4 text-amber-600" />
                        오늘 주요 일정 리마인드
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {ai.schedule_summary || '등록된 오늘 일정이 없습니다.'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-200/70 space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                        <Utensils className="h-4 w-4 text-emerald-600" />
                        아이 영양 균형 체크
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {ai.nutrition_analysis || '어린이집 식단표를 업로드하면 맞춤 영양 분석을 제공합니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-10 px-4 text-center space-y-3">
                  <p className="text-sm font-extrabold text-slate-700">
                    {formatDateWithDay(selectedDate)} 브리핑이 아직 생성되지 않았습니다
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    무료 API 한도 보호를 위해 자동 호출하지 않습니다. 아래 버튼을 누르면 오늘의 날씨, 시황, 어린이집 식단, 일정을 모아 1회 생성 후 DB에 캐싱합니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRefreshBriefing(false)}
                    disabled={refreshingBriefing}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-5 py-2.5 text-xs font-black text-white shadow-sm transition active:scale-95"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{refreshingBriefing ? '브리핑 생성 중...' : '오늘의 AI 브리핑 생성하기'}</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ============================================================ */}
        {/* ROW 2: 어린이집 전용 영역 (좌: 식단 & 저녁 영양 추천 / 우: 어린이집 스케줄 정리) */}
        {/* ============================================================ */}
        <section className="rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/90 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/80">
              <Baby className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">어린이집</h2>
              <p className="text-[11px] font-semibold text-slate-400">
                왼쪽에서 식단 및 저녁 영양 추천을, 오른쪽에서 주간/격주 어린이집 스케줄을 관리합니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* 왼쪽 (6칸): 어린이집 식단 & 저녁 영양 추천 */}
            <div className="lg:col-span-6 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">식단 &amp; 저녁 영양 추천</h3>
                </div>
                <div>
                  <input
                    ref={mealFileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleMealFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => mealFileInputRef.current?.click()}
                    disabled={uploadingMeal}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition active:scale-95"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingMeal ? 'AI 분석 중...' : '식단표 업로드'}</span>
                  </button>
                </div>
              </div>

              {mealStatusMsg && (
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {mealStatusMsg}
                </div>
              )}

              {/* 선택일 어린이집 점심 & 간식 */}
              <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">
                    🍱 {formatDateWithDay(selectedDate)} 식단
                  </span>
                  {monthMeals.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMonthMeals((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      <span>{selectedYearMonth} 식단 ({monthMeals.length}일)</span>
                      {showMonthMeals ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {todayMeal ? (
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-1.5">점심 식단</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(todayMeal.lunch_menu || []).map((menu, i) => (
                          <span
                            key={i}
                            className="rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 ring-1 ring-slate-200"
                          >
                            {menu}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="rounded-xl bg-amber-50/50 p-2.5 ring-1 ring-amber-200/60">
                        <span className="text-[10px] font-bold text-amber-700 block">오전 간식</span>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                          {todayMeal.morning_snack || '정보 없음'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-amber-50/50 p-2.5 ring-1 ring-amber-200/60">
                        <span className="text-[10px] font-bold text-amber-700 block">오후 간식</span>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                          {todayMeal.afternoon_snack || '정보 없음'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-medium py-1">
                    해당 날짜에 등록된 식단이 없습니다. 우측 상단 &lsquo;식단표 업로드&rsquo;로 월간 식단표를 올려주세요.
                  </p>
                )}

                {showMonthMeals && monthMeals.length > 0 && (
                  <div className="mt-2 pt-2.5 border-t border-slate-100 max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {monthMeals.map((m) => (
                      <button
                        key={m.meal_date}
                        type="button"
                        onClick={() => handleChangeDate(m.meal_date)}
                        className={`w-full text-left rounded-xl px-2.5 py-1.5 text-xs transition ${
                          m.meal_date === selectedDate
                            ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="font-extrabold mr-2">{m.meal_date}</span>
                        <span className="text-slate-600">{(m.lunch_menu || []).join(', ')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 저녁 보충 영양소 & 추천 식재료 & 추천 저녁 메뉴 */}
              {ai && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-2xl bg-emerald-50/70 p-3 ring-1 ring-emerald-200/70">
                      <span className="text-[11px] font-extrabold text-emerald-800 block mb-1.5">
                        저녁에 보충할 영양소
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(ai.recommended_nutrients || []).map((n, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-amber-50/70 p-3 ring-1 ring-amber-200/70">
                      <span className="text-[11px] font-extrabold text-amber-900 block mb-1.5">
                        저녁 추천 식재료
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(ai.recommended_ingredients || []).map((ing, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(ai.recommended_dinner_menus) && ai.recommended_dinner_menus.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-extrabold text-slate-800 block">
                        🍽️ AI 추천 저녁 메뉴
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ai.recommended_dinner_menus.map((menu, idx) => (
                          <div
                            key={idx}
                            className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 space-y-0.5"
                          >
                            <p className="text-xs font-black text-indigo-700">{menu.name}</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{menu.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 오른쪽 (6칸): 어린이집 스케줄 정리 (1~2주 스케줄표 업로드 + 일정 수동추가) */}
            <div className="lg:col-span-6 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/80 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">어린이집 스케줄 정리</h3>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={daycareScheduleInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleDaycareScheduleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => daycareScheduleInputRef.current?.click()}
                    disabled={uploadingDcSchedule}
                    className="flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition active:scale-95"
                    title="1~2주 가정통신문/주간계획안 이미지 또는 PDF 업로드"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingDcSchedule ? 'AI 분석 중...' : '스케줄표 업로드'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDaycareAddForm((v) => !v)}
                    className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold shadow-xs transition active:scale-95 ${
                      showDaycareAddForm
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {showDaycareAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>{showDaycareAddForm ? '닫기' : '일정 수동추가'}</span>
                  </button>
                </div>
              </div>

              {dcStatusMsg && (
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {dcStatusMsg}
                </div>
              )}

              {/* 수동 추가 폼 (토글) */}
              {showDaycareAddForm && (
                <form
                  onSubmit={handleAddDaycareSchedule}
                  className="rounded-2xl bg-white p-3.5 ring-1 ring-amber-200 space-y-2.5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DAYCARE_CATEGORIES.map((cat) => {
                      const Icon = cat.icon
                      const isActive = dcCategory === cat.key
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setDcCategory(cat.key)}
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold ring-1 transition active:scale-95 ${
                            isActive
                              ? cat.active
                              : 'bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <DateInput id="dc-schedule-date" value={dcDate} onChange={setDcDate} />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="time"
                        value={dcTime}
                        onChange={(e) => setDcTime(e.target.value)}
                        className="w-full h-full rounded-2xl border-0 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={dcMemo}
                        onChange={(e) => setDcMemo(e.target.value)}
                        placeholder="준비물/세부안내"
                        className="w-full h-full rounded-2xl border-0 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dcTitle}
                      onChange={(e) => setDcTitle(e.target.value)}
                      placeholder="어린이집 일정 제목 (예: 숲체험 현장학습, 여벌옷·물티슈 보내기)"
                      className="flex-1 rounded-2xl border-0 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!dcTitle.trim() || savingDc}
                      className="flex shrink-0 items-center gap-1 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 px-4 py-2 text-xs font-black text-white shadow-xs transition active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                      <span>추가</span>
                    </button>
                  </div>
                </form>
              )}

              {/* 선택일 / 다가오는 일정 탭 */}
              <div className="flex items-center justify-between">
                <div className="inline-flex rounded-xl bg-white p-1 text-[11px] font-bold ring-1 ring-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setDaycareScope('selected')}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      daycareScope === 'selected'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    선택일 ({daycareSelected.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaycareScope('upcoming')}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      daycareScope === 'upcoming'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    다가오는 일정 ({daycareUpcoming.length})
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  1~2주 주간계획안 이미지/PDF 자동 추출 지원
                </span>
              </div>

              {/* 어린이집 일정 목록 */}
              {displayedDaycareSchedules.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-white/70 text-xs font-semibold text-slate-400">
                  {daycareScope === 'upcoming'
                    ? '등록된 어린이집 예정 일정이 없습니다. 스케줄표를 업로드하거나 수동 추가해 보세요.'
                    : `${formatDateWithDay(selectedDate)}에 등록된 어린이집 일정이 없습니다.`}
                </div>
              ) : (
                <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
                  {displayedDaycareSchedules.map((item) => {
                    const cat = getCategoryMeta(item.category)
                    const CatIcon = cat.icon
                    return (
                      <li
                        key={item.id}
                        className={`flex items-start gap-2.5 rounded-2xl p-3 ring-1 transition ${
                          item.is_done
                            ? 'bg-slate-100/70 ring-slate-200/70 opacity-65'
                            : 'bg-white ring-slate-200 hover:ring-amber-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSchedule(item)}
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition ${
                            item.is_done
                              ? 'border-amber-500 bg-amber-500 text-white'
                              : 'border-slate-300 bg-white hover:border-amber-500'
                          }`}
                          aria-label="완료 체크"
                        >
                          {item.is_done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ${cat.badge}`}
                            >
                              <CatIcon className="h-2.5 w-2.5" />
                              {cat.label}
                            </span>
                            {daycareScope === 'upcoming' && (
                              <span className="text-[11px] font-extrabold text-amber-700">
                                {formatDateWithDay(item.schedule_date)}
                              </span>
                            )}
                            {item.schedule_time && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500">
                                <Clock className="h-3 w-3" />
                                {item.schedule_time}
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-1 text-sm font-bold leading-snug ${
                              item.is_done ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.memo && <p className="mt-0.5 text-xs text-slate-500">{item.memo}</p>}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(item)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                          aria-label="일정 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* ROW 3: 개인 · 가족 일정표 */}
        {/* ============================================================ */}
        <section className="rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/90 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Home className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">개인 · 가족 일정표</h2>
                <p className="text-[11px] font-semibold text-slate-400">
                  개인 업무, 병원 예약, 가족 행사 및 기념일을 관리합니다.
                </p>
              </div>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFamilyScope('selected')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  familyScope === 'selected'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                선택일 ({familySelected.length})
              </button>
              <button
                type="button"
                onClick={() => setFamilyScope('upcoming')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  familyScope === 'upcoming'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                다가오는 일정 ({familyUpcoming.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* 좌측 5칸: 개인 · 가족 일정 등록 폼 */}
            <form
              onSubmit={handleAddPersonalFamilySchedule}
              className="lg:col-span-5 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/80 space-y-3"
            >
              <div className="flex items-center gap-1.5">
                {PERSONAL_FAMILY_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isActive = pfCategory === cat.key
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setPfCategory(cat.key)}
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 transition active:scale-95 ${
                        isActive
                          ? cat.active
                          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <DateInput id="pf-schedule-date" value={pfDate} onChange={setPfDate} />
                <input
                  type="time"
                  value={pfTime}
                  onChange={(e) => setPfTime(e.target.value)}
                  className="w-full rounded-2xl border-0 bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <input
                type="text"
                value={pfTitle}
                onChange={(e) => setPfTitle(e.target.value)}
                placeholder="일정 제목 (예: 가족 외식, 치과 정기검진, 자동차 점검)"
                className="w-full rounded-2xl border-0 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={pfMemo}
                  onChange={(e) => setPfMemo(e.target.value)}
                  placeholder="메모 (선택)"
                  className="flex-1 rounded-2xl border-0 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!pfTitle.trim() || savingPf}
                  className="flex shrink-0 items-center gap-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 py-2 text-xs font-black text-white shadow-xs transition active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>일정 등록</span>
                </button>
              </div>
            </form>

            {/* 우측 7칸: 개인 · 가족 일정 목록 */}
            <div className="lg:col-span-7">
              {displayedFamilySchedules.length === 0 ? (
                <div className="h-full min-h-[160px] flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-400">
                  {familyScope === 'upcoming'
                    ? '다가오는 개인 · 가족 일정이 없습니다.'
                    : `${formatDateWithDay(selectedDate)}에 등록된 개인 · 가족 일정이 없습니다.`}
                </div>
              ) : (
                <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
                  {displayedFamilySchedules.map((item) => {
                    const cat = getCategoryMeta(item.category)
                    const CatIcon = cat.icon
                    return (
                      <li
                        key={item.id}
                        className={`flex items-start gap-2.5 rounded-2xl p-3 ring-1 transition ${
                          item.is_done
                            ? 'bg-slate-50/70 ring-slate-200/70 opacity-65'
                            : 'bg-white ring-slate-200 hover:ring-indigo-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSchedule(item)}
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition ${
                            item.is_done
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white hover:border-indigo-500'
                          }`}
                          aria-label="완료 체크"
                        >
                          {item.is_done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ${cat.badge}`}
                            >
                              <CatIcon className="h-2.5 w-2.5" />
                              {cat.label}
                            </span>
                            {familyScope === 'upcoming' && (
                              <span className="text-[11px] font-extrabold text-indigo-600">
                                {formatDateWithDay(item.schedule_date)}
                              </span>
                            )}
                            {item.schedule_time && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500">
                                <Clock className="h-3 w-3" />
                                {item.schedule_time}
                              </span>
                            )}
                          </div>
                          <p
                            className={`mt-1 text-sm font-bold leading-snug ${
                              item.is_done ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.memo && <p className="mt-0.5 text-xs text-slate-500">{item.memo}</p>}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(item)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                          aria-label="일정 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* ROW 4: 국내외 시황 & 경제 리서치 요약 */}
        {/* ============================================================ */}
        <section className="rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/90 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <TrendingUp className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  국내외 시황 &amp; 경제 리서치 요약
                </h2>
                <p className="text-[11px] font-semibold text-slate-400">
                  무료 경제 뉴스 RSS 수집 + Gemini 3.8 Flash 핵심 포인트 정리
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* 좌측 7칸: AI 3~5줄 핵심 시황 요약 */}
            <div className="lg:col-span-7 space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-700">AI 핵심 시황 포인트</h3>
              {Array.isArray(economy?.summary_bullets) && economy.summary_bullets.length > 0 ? (
                <ul className="space-y-2">
                  {economy.summary_bullets.map((line, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 rounded-2xl bg-violet-50/50 p-3 ring-1 ring-violet-200/60 text-xs text-slate-800 leading-relaxed"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-violet-600 text-[10px] font-black text-white">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-400">
                  &lsquo;브리핑 새로고침&rsquo;을 누르면 국내외 증시·금리·환율 핵심 요약이 여기에 표시됩니다.
                </div>
              )}
            </div>

            {/* 우측 5칸: 수집된 원본 경제 RSS 헤드라인 */}
            <div className="lg:col-span-5 space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-700">
                수집된 주요 경제 헤드라인 ({economy?.headlines?.length || 0})
              </h3>
              {Array.isArray(economy?.headlines) && economy.headlines.length > 0 ? (
                <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-0.5">
                  {economy.headlines.map((h, idx) => (
                    <a
                      key={idx}
                      href={h.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start justify-between gap-2 rounded-xl bg-slate-50 hover:bg-indigo-50/70 p-2.5 ring-1 ring-slate-200/70 hover:ring-indigo-200 transition"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold text-indigo-600">
                          {h.source || '경제뉴스'}
                        </span>
                        <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-900 line-clamp-2 leading-snug mt-0.5">
                          {h.title}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-600 mt-0.5" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-400">
                  수집된 뉴스 헤드라인이 없습니다.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
