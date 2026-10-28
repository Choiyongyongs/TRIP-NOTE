import { useMemo, useState } from 'react'
import {
  Wallet,
  Clock,
  ReceiptText,
  CalendarDays,
  Check,
  TrendingUp,
  Calculator,
  WalletCards,
  Filter,
  CheckSquare,
  Square,
  Coins,
} from 'lucide-react'
import { CATEGORIES, CATEGORY_KEYS, won, formatMoney, getCurrency } from '../data'
import { CategoryBadge } from './ScheduleCard'
import SplitSettlementModal from './SplitSettlementModal'

const pct = (v, t) => (t > 0 ? (v / t) * 100 : 0)

// 만원/천단위 축약 포맷터
const formatShortMoney = (n, currencyCode = 'KRW') => {
  if (!n) return `0${currencyCode === 'KRW' ? '원' : ''}`
  if (currencyCode === 'KRW') {
    const man = n / 10000
    if (Math.abs(n) >= 10000) {
      const formatted = Number.isInteger(man) ? man : Number(man.toFixed(1))
      return `${formatted.toLocaleString()}만원`
    }
    return `${n.toLocaleString()}원`
  }
  return formatMoney(n, currencyCode)
}

export default function BudgetView({
  items,
  dayCount,
  headcount,
  dayLabel,
  tripTitle = '여행',
  tripType = 'domestic',
  tripCurrency = 'KRW',
  exchangedAmount = 0,
  onUpdateTrip,
  isSettled = false,
  settlementData = null,
  onSaveSettlement,
  onClearSettlement,
  isCollected = false,
  collectionData = null,
  onSaveCollection,
  onClearCollection,
}) {
  const isOverseas = tripType === 'overseas' && tripCurrency !== 'KRW'
  const currencyInfo = getCurrency(tripCurrency)

  // 모달 모드: 'settle' (실제 지출 기준 정산) | 'collection' (예상 지출 기준 회비 걷기) | null
  const [splitModalMode, setSplitModalMode] = useState(null)
  // 일차 필터: ['all'] 또는 [1], [1, 2] 등 중복 선택 배열
  const [selectedDays, setSelectedDays] = useState(['all'])
  // 표시 금액 필터: 'all' (전체 - 실제+예상) | 'actual' (실제 지출액) | 'expected' (예상 지출액)
  const [amountFilter, setAmountFilter] = useState('all')

  // 카테고리 다중 선택 (토글): 빈 배열([])이면 전체 선택, 특정 카테고리들이 담기면 해당 카테고리들만 중복 필터링
  const [selectedCats, setSelectedCats] = useState([])

  // 상세내역 개별 선택 상태 (아이템 ID Set)
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set())

  // 환전한 돈 로컬 입력 상태 관리 (부모 onUpdateTrip 동기화)
  const [localExchanged, setLocalExchanged] = useState(
    exchangedAmount !== undefined && exchangedAmount !== null ? String(exchangedAmount) : ''
  )

  // 지출 추출 헬퍼 (실제 지출액 vs 예상 지출액)
  const getActual = (i) =>
    i.actualExpense !== undefined && i.actualExpense !== null && i.actualExpense !== ''
      ? Number(i.actualExpense)
      : 0
  const getExpected = (i) => Number(i.expense || 0)

  // 실제 지출액 입력 여부 판별
  const hasActual = (i) =>
    i.actualExpense !== undefined && i.actualExpense !== null && i.actualExpense !== ''

  // 통화 판별 헬퍼 (해외 통화 vs 원화)
  const isForeignItem = (i) => Boolean(i.currency && i.currency !== 'KRW')
  const isKrwItem = (i) => !i.currency || i.currency === 'KRW'

  // ========================================================
  // 1. 전체 여행 기준 총 지출액 계산 (전체 / 외화 / 원화 분리)
  // ========================================================
  const actualTotal = useMemo(() => items.reduce((s, i) => s + getActual(i), 0), [items])
  const expectedTotal = useMemo(() => items.reduce((s, i) => s + getExpected(i), 0), [items])

  // 실제 지출액이 입력된 항목들만 추출 (차이 계산용)
  const itemsWithActual = useMemo(() => items.filter(hasActual), [items])
  const actualSumForDiff = useMemo(
    () => itemsWithActual.reduce((s, i) => s + Number(i.actualExpense), 0),
    [itemsWithActual]
  )
  const expectedSumForDiff = useMemo(
    () => itemsWithActual.reduce((s, i) => s + (Number(i.expense) || 0), 0),
    [itemsWithActual]
  )
  const diffTotal = actualSumForDiff - expectedSumForDiff
  const hasActualCount = itemsWithActual.length

  // [해외여행 화폐단위 분리 집계]
  // 1) 외화 집계 (원화 제외)
  const foreignItems = useMemo(() => items.filter(isForeignItem), [items])
  const foreignActualTotal = useMemo(
    () => foreignItems.reduce((s, i) => s + getActual(i), 0),
    [foreignItems]
  )
  const foreignExpectedTotal = useMemo(
    () => foreignItems.reduce((s, i) => s + getExpected(i), 0),
    [foreignItems]
  )
  const foreignItemsWithActual = useMemo(
    () => foreignItems.filter(hasActual),
    [foreignItems]
  )
  const foreignActualSumForDiff = useMemo(
    () => foreignItemsWithActual.reduce((s, i) => s + Number(i.actualExpense), 0),
    [foreignItemsWithActual]
  )
  const foreignExpectedSumForDiff = useMemo(
    () => foreignItemsWithActual.reduce((s, i) => s + (Number(i.expense) || 0), 0),
    [foreignItemsWithActual]
  )
  const foreignDiffTotal = foreignActualSumForDiff - foreignExpectedSumForDiff
  const foreignHasActualCount = foreignItemsWithActual.length

  // 2) 원화 집계 (국내 결제 / 항공권 등)
  const krwItems = useMemo(() => items.filter(isKrwItem), [items])
  const krwActualTotal = useMemo(
    () => krwItems.reduce((s, i) => s + getActual(i), 0),
    [krwItems]
  )
  const krwExpectedTotal = useMemo(
    () => krwItems.reduce((s, i) => s + getExpected(i), 0),
    [krwItems]
  )
  const krwItemsWithActual = useMemo(() => krwItems.filter(hasActual), [krwItems])
  const krwActualSumForDiff = useMemo(
    () => krwItemsWithActual.reduce((s, i) => s + Number(i.actualExpense), 0),
    [krwItemsWithActual]
  )
  const krwExpectedSumForDiff = useMemo(
    () => krwItemsWithActual.reduce((s, i) => s + (Number(i.expense) || 0), 0),
    [krwItemsWithActual]
  )
  const krwDiffTotal = krwActualSumForDiff - krwExpectedSumForDiff
  const krwHasActualCount = krwItemsWithActual.length

  // ========================================================
  // [환전한 돈 대시보드 계산] (원화 제외, 순수 외화 기준)
  // 환전액 - 실제 지출(외화) = 잔액
  // 잔액 - 남은 일정 예상 지출(외화, 아직 실제 지출 미입력건) = 차이 (부족/여유)
  // ========================================================
  const currentExchangedNum = Number(localExchanged) || 0
  const foreignBalance = currentExchangedNum - foreignActualTotal
  const upcomingForeignItems = useMemo(
    () => foreignItems.filter((i) => !hasActual(i)),
    [foreignItems]
  )
  const upcomingForeignExpected = useMemo(
    () => upcomingForeignItems.reduce((s, i) => s + getExpected(i), 0),
    [upcomingForeignItems]
  )
  const foreignRemainingDiff = foreignBalance - upcomingForeignExpected

  const handleExchangedBlur = () => {
    const val = Number(localExchanged) || 0
    onUpdateTrip?.({ exchangedAmount: val })
  }

  // ========================================================
  // [요청사항] 회비 잔액 대시보드 계산
  // 국내: 단일 원화 회비 잔액
  // 해외: 현지 외화 회비 잔액 & 국내/사전 원화 회비 잔액 둘 다 동시 계산/지원
  // ========================================================
  const isDualCollection = Boolean(
    isOverseas &&
      collectionData &&
      collectionData.isDual !== false &&
      (collectionData.isDual ||
        collectionData.foreignCollected !== undefined ||
        collectionData.krwCollected !== undefined)
  )

  const dualForeignCollected = Number(collectionData?.foreignCollected) || 0
  const dualKrwCollected = Number(collectionData?.krwCollected) || 0

  const dualForeignBalance = dualForeignCollected - foreignActualTotal
  const dualForeignDiff = dualForeignBalance - upcomingForeignExpected

  const upcomingKrwItems = useMemo(
    () => krwItems.filter((i) => !hasActual(i)),
    [krwItems]
  )
  const upcomingKrwExpected = useMemo(
    () => upcomingKrwItems.reduce((s, i) => s + getExpected(i), 0),
    [upcomingKrwItems]
  )
  const dualKrwBalance = dualKrwCollected - krwActualTotal
  const dualKrwDiff = dualKrwBalance - upcomingKrwExpected

  // 단일 통화 (국내여행 또는 해외 단일 회비 fallback)
  const collectedTotalAmount = Number(collectionData?.totalCollected) || 0
  const collectedCurrency = collectionData?.currency || (isOverseas ? tripCurrency : 'KRW')
  const isCollectedForeign = Boolean(isOverseas && collectedCurrency !== 'KRW')

  const collectedActualSpent = useMemo(() => {
    if (!collectionData) return 0
    if (isCollectedForeign) {
      return foreignActualTotal
    }
    return krwActualTotal
  }, [collectionData, isCollectedForeign, foreignActualTotal, krwActualTotal])

  const collectedBalance = collectedTotalAmount - collectedActualSpent

  const upcomingCollectedItems = useMemo(() => {
    if (!collectionData) return []
    const targetSet = isCollectedForeign ? foreignItems : krwItems
    return targetSet.filter((i) => !hasActual(i))
  }, [collectionData, isCollectedForeign, foreignItems, krwItems])

  const upcomingCollectedExpected = useMemo(() => {
    return upcomingCollectedItems.reduce((s, i) => s + getExpected(i), 0)
  }, [upcomingCollectedItems])

  const collectedRemainingDiff = collectedBalance - upcomingCollectedExpected

  // ========================================================
  // 일차 필터 및 아이템 필터링
  // ========================================================
  const handleToggleDay = (dayNum) => {
    if (dayNum === 'all') {
      setSelectedDays(['all'])
      return
    }
    const next = selectedDays.filter((d) => d !== 'all')
    const exists = next.includes(dayNum)
    let updated
    if (exists) {
      updated = next.filter((d) => d !== dayNum)
    } else {
      updated = [...next, dayNum].sort((a, b) => a - b)
    }
    if (updated.length === 0) {
      setSelectedDays(['all'])
    } else {
      setSelectedDays(updated)
    }
  }

  const dayFilteredItems = useMemo(() => {
    if (selectedDays.includes('all')) {
      return items
    }
    return items.filter((i) => selectedDays.includes(i.day))
  }, [items, selectedDays])

  const dayFilteredActualTotal = useMemo(
    () => dayFilteredItems.reduce((s, i) => s + getActual(i), 0),
    [dayFilteredItems]
  )
  const dayFilteredExpectedTotal = useMemo(
    () => dayFilteredItems.reduce((s, i) => s + getExpected(i), 0),
    [dayFilteredItems]
  )

  // 해외여행용: 선택된 일차 기준 외화 / 원화 총계 (ALL 카드용)
  const dayFilteredForeignActualTotal = useMemo(
    () => dayFilteredItems.filter(isForeignItem).reduce((s, i) => s + getActual(i), 0),
    [dayFilteredItems]
  )
  const dayFilteredForeignExpectedTotal = useMemo(
    () => dayFilteredItems.filter(isForeignItem).reduce((s, i) => s + getExpected(i), 0),
    [dayFilteredItems]
  )
  const dayFilteredKrwActualTotal = useMemo(
    () => dayFilteredItems.filter(isKrwItem).reduce((s, i) => s + getActual(i), 0),
    [dayFilteredItems]
  )
  const dayFilteredKrwExpectedTotal = useMemo(
    () => dayFilteredItems.filter(isKrwItem).reduce((s, i) => s + getExpected(i), 0),
    [dayFilteredItems]
  )

  // 선택된 일차 기준 카테고리별 합계 및 건수 (전체)
  const catSumsForSelectedDays = useMemo(() => {
    const m = Object.fromEntries(
      CATEGORY_KEYS.map((k) => [
        k,
        { actualSum: 0, expectedSum: 0, actualCount: 0, expectedCount: 0 },
      ])
    )
    dayFilteredItems.forEach((i) => {
      const act = getActual(i)
      const exp = getExpected(i)
      if (m[i.category]) {
        m[i.category].actualSum += act
        m[i.category].expectedSum += exp
        if (act > 0) m[i.category].actualCount += 1
        if (exp > 0) m[i.category].expectedCount += 1
      }
    })
    return m
  }, [dayFilteredItems])

  // [해외여행용] 카테고리별 외화/원화 각각 합계 (카테고리 카드 내부 분할 표시용)
  const catSumsForeignForSelectedDays = useMemo(() => {
    const m = Object.fromEntries(
      CATEGORY_KEYS.map((k) => [
        k,
        { actualSum: 0, expectedSum: 0, count: 0 },
      ])
    )
    dayFilteredItems.filter(isForeignItem).forEach((i) => {
      const act = getActual(i)
      const exp = getExpected(i)
      if (m[i.category]) {
        m[i.category].actualSum += act
        m[i.category].expectedSum += exp
        if (act > 0 || exp > 0) m[i.category].count += 1
      }
    })
    return m
  }, [dayFilteredItems])

  const catSumsKrwForSelectedDays = useMemo(() => {
    const m = Object.fromEntries(
      CATEGORY_KEYS.map((k) => [
        k,
        { actualSum: 0, expectedSum: 0, count: 0 },
      ])
    )
    dayFilteredItems.filter(isKrwItem).forEach((i) => {
      const act = getActual(i)
      const exp = getExpected(i)
      if (m[i.category]) {
        m[i.category].actualSum += act
        m[i.category].expectedSum += exp
        if (act > 0 || exp > 0) m[i.category].count += 1
      }
    })
    return m
  }, [dayFilteredItems])

  // 카테고리 다중 토글 핸들러
  const handleToggleCategory = (catKey) => {
    if (catKey === 'all') {
      setSelectedCats([]) // 전체 선택으로 리셋
      return
    }
    setSelectedCats((prev) => {
      if (prev.includes(catKey)) {
        return prev.filter((k) => k !== catKey)
      } else {
        return [...prev, catKey]
      }
    })
  }

  // 최종 표시되는 상세 내역 목록 (일차 필터 + 카테고리 다중 필터 + 금액 필터)
  const finalExpenses = useMemo(() => {
    return dayFilteredItems
      .filter((i) => {
        const act = getActual(i)
        const exp = getExpected(i)
        if (amountFilter === 'actual') return act > 0
        if (amountFilter === 'expected') return exp > 0
        return act > 0 || exp > 0
      })
      .filter((i) => {
        if (selectedCats.length === 0) return true
        return selectedCats.includes(i.category)
      })
      .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  }, [dayFilteredItems, selectedCats, amountFilter])

  const finalActualSum = useMemo(
    () => finalExpenses.reduce((s, i) => s + getActual(i), 0),
    [finalExpenses]
  )
  const finalExpectedSum = useMemo(
    () => finalExpenses.reduce((s, i) => s + getExpected(i), 0),
    [finalExpenses]
  )

  // [요청사항] 지출 상세내역 소계용 외화 및 원화 분리 합계
  const finalForeignActualSum = useMemo(
    () => finalExpenses.filter(isForeignItem).reduce((s, i) => s + getActual(i), 0),
    [finalExpenses]
  )
  const finalForeignExpectedSum = useMemo(
    () => finalExpenses.filter(isForeignItem).reduce((s, i) => s + getExpected(i), 0),
    [finalExpenses]
  )
  const finalKrwActualSum = useMemo(
    () => finalExpenses.filter(isKrwItem).reduce((s, i) => s + getActual(i), 0),
    [finalExpenses]
  )
  const finalKrwExpectedSum = useMemo(
    () => finalExpenses.filter(isKrwItem).reduce((s, i) => s + getExpected(i), 0),
    [finalExpenses]
  )

  // 상세내역 개별 선택 로직
  const handleToggleItemCheck = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllVisible = () => {
    if (finalExpenses.length === 0) return
    const allVisibleIds = finalExpenses.map((i) => i.id)
    const allChecked = allVisibleIds.every((id) => selectedItemIds.has(id))

    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        allVisibleIds.forEach((id) => next.delete(id))
      } else {
        allVisibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const userCheckedItems = useMemo(() => {
    return items.filter((i) => selectedItemIds.has(i.id))
  }, [items, selectedItemIds])

  const hasUserSelection = selectedItemIds.size > 0
  const targetItemsForSettlement = hasUserSelection ? userCheckedItems : items

  const targetActualTotal = useMemo(
    () => targetItemsForSettlement.reduce((s, i) => s + getActual(i), 0),
    [targetItemsForSettlement]
  )
  const targetExpectedTotal = useMemo(
    () => targetItemsForSettlement.reduce((s, i) => s + getExpected(i), 0),
    [targetItemsForSettlement]
  )

  // [해외여행 정산 요약용] 선택된 일정 기준 외화 / 원화 분리 합계
  const targetForeignActual = useMemo(
    () => targetItemsForSettlement.filter(isForeignItem).reduce((s, i) => s + getActual(i), 0),
    [targetItemsForSettlement]
  )
  const targetForeignExpected = useMemo(
    () => targetItemsForSettlement.filter(isForeignItem).reduce((s, i) => s + getExpected(i), 0),
    [targetItemsForSettlement]
  )
  const targetKrwActual = useMemo(
    () => targetItemsForSettlement.filter(isKrwItem).reduce((s, i) => s + getActual(i), 0),
    [targetItemsForSettlement]
  )
  const targetKrwExpected = useMemo(
    () => targetItemsForSettlement.filter(isKrwItem).reduce((s, i) => s + getExpected(i), 0),
    [targetItemsForSettlement]
  )

  // ========================================================
  // 프로그레스 바 데이터 (국내: 단일 / 해외: 현지외화 바 + 원화 바 2개)
  // ========================================================
  const isActualStarted = actualTotal > 0
  const allCategoryActualSums = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
    items.forEach((i) => {
      const act = getActual(i)
      if (act > 0 && m[i.category] !== undefined) m[i.category] += act
    })
    return m
  }, [items])

  const allCategoryExpectedSums = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
    items.forEach((i) => {
      const exp = getExpected(i)
      if (exp > 0 && m[i.category] !== undefined) m[i.category] += exp
    })
    return m
  }, [items])

  const baseTotalForBar = isActualStarted ? actualTotal : expectedTotal
  const baseSumsForBar = isActualStarted ? allCategoryActualSums : allCategoryExpectedSums
  const sortedAllCats = useMemo(
    () =>
      CATEGORY_KEYS.filter((k) => baseSumsForBar[k] > 0).sort(
        (a, b) => baseSumsForBar[b] - baseSumsForBar[a]
      ),
    [baseSumsForBar]
  )

  // 해외여행 외화 바 전용 데이터
  const isForeignActualStarted = foreignActualTotal > 0
  const foreignCategoryActualSums = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
    foreignItems.forEach((i) => {
      const act = getActual(i)
      if (act > 0 && m[i.category] !== undefined) m[i.category] += act
    })
    return m
  }, [foreignItems])

  const foreignCategoryExpectedSums = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
    foreignItems.forEach((i) => {
      const exp = getExpected(i)
      if (exp > 0 && m[i.category] !== undefined) m[i.category] += exp
    })
    return m
  }, [foreignItems])

  const baseForeignTotalForBar = isForeignActualStarted ? foreignActualTotal : foreignExpectedTotal
  const baseForeignSumsForBar = isForeignActualStarted
    ? foreignCategoryActualSums
    : foreignCategoryExpectedSums
  const sortedForeignCats = useMemo(
    () =>
      CATEGORY_KEYS.filter((k) => baseForeignSumsForBar[k] > 0).sort(
        (a, b) => baseForeignSumsForBar[b] - baseForeignSumsForBar[a]
      ),
    [baseForeignSumsForBar]
  )

  // 해외여행 원화 바 전용 데이터
  const isKrwActualStarted = krwActualTotal > 0
  const krwCategoryActualSums = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
    krwItems.forEach((i) => {
      const act = getActual(i)
      if (act > 0 && m[i.category] !== undefined) m[i.category] += act
    })
    return m
  }, [krwItems])

  const krwCategoryExpectedSums = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
    krwItems.forEach((i) => {
      const exp = getExpected(i)
      if (exp > 0 && m[i.category] !== undefined) m[i.category] += exp
    })
    return m
  }, [krwItems])

  const baseKrwTotalForBar = isKrwActualStarted ? krwActualTotal : krwExpectedTotal
  const baseKrwSumsForBar = isKrwActualStarted ? krwCategoryActualSums : krwCategoryExpectedSums
  const sortedKrwCats = useMemo(
    () =>
      CATEGORY_KEYS.filter((k) => baseKrwSumsForBar[k] > 0).sort(
        (a, b) => baseKrwSumsForBar[b] - baseKrwSumsForBar[a]
      ),
    [baseKrwSumsForBar]
  )

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* 1. 상단 총지출 요약 */}
      {/* 국내: 단일 총지출 요약 | 해외: [선택 외화 요약] + [원화 요약] 분리 계산 */}
      {/* ======================================================== */}
      {isOverseas ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* A. 해외 현지 외화 총지출 요약 카드 */}
          <section className="relative overflow-hidden rounded-3xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200/90 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
                  <Coins className="h-4 w-4 text-indigo-600" /> 현지 외화 지출 ({currencyInfo.name} {currencyInfo.symbol})
                </p>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-600 ring-1 ring-indigo-200">
                  외화 {foreignItems.length}건
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl tabular-nums">
                  {formatMoney(foreignActualTotal, tripCurrency)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    <span className="text-slate-400 font-medium">예상:</span>
                    <span className="font-extrabold text-amber-600">
                      {formatMoney(foreignExpectedTotal, tripCurrency)}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black ring-1 ${
                      foreignHasActualCount === 0
                        ? 'bg-slate-100 text-slate-500 ring-slate-200'
                        : foreignDiffTotal > 0
                        ? 'bg-rose-50 text-rose-700 ring-rose-200'
                        : foreignDiffTotal < 0
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-slate-100 text-slate-700 ring-slate-200'
                    }`}
                  >
                    <span className="font-medium opacity-80">차이:</span>
                    <span>
                      {foreignHasActualCount === 0
                        ? '0 (미입력)'
                        : foreignDiffTotal > 0
                        ? `+${formatMoney(foreignDiffTotal, tripCurrency)} 초과`
                        : foreignDiffTotal < 0
                        ? `-${formatMoney(Math.abs(foreignDiffTotal), tripCurrency)} 절약`
                        : '0 (일치)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>1인당 현지 외화 ({headcount}명 기준)</span>
              <span className="font-extrabold text-indigo-600 text-sm tabular-nums">
                {formatMoney(Math.round(foreignActualTotal / (headcount || 1)), tripCurrency)}
              </span>
            </div>
          </section>

          {/* B. 국내 사전 결제 등 원화(KRW) 총지출 요약 카드 */}
          <section className="relative overflow-hidden rounded-3xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200/90 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Wallet className="h-4 w-4 text-slate-600" /> 사전결제 등 원화 지출 (KRW ₩)
                </p>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-600 ring-1 ring-slate-200">
                  원화 {krwItems.length}건
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl tabular-nums">
                  {won(krwActualTotal)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    <span className="text-slate-400 font-medium">예상:</span>
                    <span className="font-extrabold text-amber-600">{won(krwExpectedTotal)}</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black ring-1 ${
                      krwHasActualCount === 0
                        ? 'bg-slate-100 text-slate-500 ring-slate-200'
                        : krwDiffTotal > 0
                        ? 'bg-rose-50 text-rose-700 ring-rose-200'
                        : krwDiffTotal < 0
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-slate-100 text-slate-700 ring-slate-200'
                    }`}
                  >
                    <span className="font-medium opacity-80">차이:</span>
                    <span>
                      {krwHasActualCount === 0
                        ? '0원 (미입력)'
                        : krwDiffTotal > 0
                        ? `+${won(krwDiffTotal)} 초과`
                        : krwDiffTotal < 0
                        ? `-${won(Math.abs(krwDiffTotal))} 절약`
                        : '0원 (일치)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>1인당 원화 ({headcount}명 기준)</span>
              <span className="font-extrabold text-slate-800 text-sm tabular-nums">
                {won(Math.round(krwActualTotal / (headcount || 1)))}
              </span>
            </div>
          </section>
        </div>
      ) : (
        /* 국내여행: 단일 총지출 요약 카드 */
        <section className="relative overflow-hidden rounded-3xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200/90 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
                <Wallet className="h-4 w-4 text-indigo-600" /> 여행 총지출 요약 (실제 지출 기준)
              </p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl tabular-nums">
                  {won(actualTotal)}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    <span className="text-slate-400 font-medium">예상:</span>
                    <span className="font-extrabold text-amber-600">{won(expectedTotal)}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-black ring-1 ${
                      hasActualCount === 0
                        ? 'bg-slate-100 text-slate-500 ring-slate-200'
                        : diffTotal > 0
                        ? 'bg-rose-50 text-rose-700 ring-rose-200'
                        : diffTotal < 0
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-slate-100 text-slate-700 ring-slate-200'
                    }`}
                  >
                    <span className="font-medium opacity-80">차이:</span>
                    <span>
                      {hasActualCount === 0
                        ? '0원 (실제 미입력)'
                        : diffTotal > 0
                        ? `+${won(diffTotal)} 초과`
                        : diffTotal < 0
                        ? `-${won(Math.abs(diffTotal))} 절약`
                        : '0원 (일치)'}
                    </span>
                    {hasActualCount > 0 && (
                      <span className="text-[10px] opacity-75 font-normal">
                        ({hasActualCount}건 기준)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                실제 지출 {items.filter((i) => getActual(i) > 0).length}건 / 예상{' '}
                {items.filter((i) => getExpected(i) > 0).length}건
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2. 카테고리별 지출 비율 바 & 범례 */}
      {/* 국내: 단일 바 | 해외: 현지 외화 바 + 원화 바 각각 분리 표시 */}
      {/* (카테고리 바로 밑에 있던 인당금액, 회비걷기, 정산하기는 삭제 완료) */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/90 sm:p-6 space-y-5">
        {isOverseas ? (
          <>
            {/* A. 현지 외화 카테고리별 지출 비율 바 */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span className="flex items-center gap-1 font-bold text-indigo-700">
                  <Coins className="h-3.5 w-3.5" />
                  현지 외화 ({currencyInfo.symbol}) 지출 비율 ({isForeignActualStarted ? '실제 외화 기준' : '예상 외화 기준'})
                </span>
                <span>{sortedForeignCats.length}개 카테고리</span>
              </div>

              <div
                className="flex h-10 w-full overflow-hidden rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 shadow-inner"
                title="현지 외화 카테고리별 지출 비율"
              >
                {sortedForeignCats.map((k) => {
                  const catObj = CATEGORIES[k]
                  const p = pct(baseForeignSumsForBar[k], baseForeignTotalForBar)
                  if (p <= 0) return null
                  const isSelected = selectedCats.includes(k)

                  return (
                    <div
                      key={k}
                      className={`${catObj.bar} relative flex h-full items-center justify-center transition-all duration-300 first:rounded-l-xl last:rounded-r-xl group cursor-pointer hover:brightness-110 ${
                        selectedCats.length > 0 && !isSelected ? 'opacity-40 saturate-50' : ''
                      }`}
                      style={{ width: `${p}%`, minWidth: p > 2 ? '14px' : '4px' }}
                      onClick={() => handleToggleCategory(k)}
                      title={`${catObj.label}: 실제 ${formatMoney(
                        foreignCategoryActualSums[k],
                        tripCurrency
                      )} (예상 ${formatMoney(foreignCategoryExpectedSums[k], tripCurrency)}) · ${p.toFixed(1)}%`}
                    >
                      {p >= 5 && (
                        <span className="truncate px-1 text-[11px] font-extrabold text-white drop-shadow-sm select-none">
                          {catObj.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 외화 범례 칩 */}
              <div className="no-scrollbar mt-2.5 flex flex-wrap items-center gap-2 overflow-x-auto">
                {sortedForeignCats.map((k) => {
                  const catObj = CATEGORIES[k]
                  const val = isForeignActualStarted
                    ? foreignCategoryActualSums[k]
                    : foreignCategoryExpectedSums[k]
                  const p = pct(val, baseForeignTotalForBar)
                  const isSelected = selectedCats.includes(k)

                  return (
                    <button
                      key={k}
                      onClick={() => handleToggleCategory(k)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 ring-1 ring-slate-200/60'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${catObj.bar}`} />
                      <span>{catObj.label}</span>
                      <span
                        className={`font-bold tabular-nums ${
                          isSelected ? 'text-amber-200' : 'text-slate-900'
                        }`}
                      >
                        {formatMoney(val, tripCurrency)}
                      </span>
                      <span className="text-[10px] opacity-75">({p.toFixed(1)}%)</span>
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* B. 원화(KRW) 카테고리별 지출 비율 바 */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <Wallet className="h-3.5 w-3.5 text-slate-600" />
                  원화 (₩) 지출 비율 ({isKrwActualStarted ? '실제 원화 기준' : '예상 원화 기준'})
                </span>
                <span>{sortedKrwCats.length}개 카테고리</span>
              </div>

              <div
                className="flex h-10 w-full overflow-hidden rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 shadow-inner"
                title="원화 카테고리별 지출 비율"
              >
                {sortedKrwCats.map((k) => {
                  const catObj = CATEGORIES[k]
                  const p = pct(baseKrwSumsForBar[k], baseKrwTotalForBar)
                  if (p <= 0) return null
                  const isSelected = selectedCats.includes(k)

                  return (
                    <div
                      key={k}
                      className={`${catObj.bar} relative flex h-full items-center justify-center transition-all duration-300 first:rounded-l-xl last:rounded-r-xl group cursor-pointer hover:brightness-110 ${
                        selectedCats.length > 0 && !isSelected ? 'opacity-40 saturate-50' : ''
                      }`}
                      style={{ width: `${p}%`, minWidth: p > 2 ? '14px' : '4px' }}
                      onClick={() => handleToggleCategory(k)}
                      title={`${catObj.label}: 실제 ${won(krwCategoryActualSums[k])} (예상 ${won(
                        krwCategoryExpectedSums[k]
                      )}) · ${p.toFixed(1)}%`}
                    >
                      {p >= 5 && (
                        <span className="truncate px-1 text-[11px] font-extrabold text-white drop-shadow-sm select-none">
                          {catObj.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 원화 범례 칩 */}
              <div className="no-scrollbar mt-2.5 flex flex-wrap items-center gap-2 overflow-x-auto">
                {sortedKrwCats.map((k) => {
                  const catObj = CATEGORIES[k]
                  const val = isKrwActualStarted
                    ? krwCategoryActualSums[k]
                    : krwCategoryExpectedSums[k]
                  const p = pct(val, baseKrwTotalForBar)
                  const isSelected = selectedCats.includes(k)

                  return (
                    <button
                      key={k}
                      onClick={() => handleToggleCategory(k)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 ring-1 ring-slate-200/60'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${catObj.bar}`} />
                      <span>{catObj.label}</span>
                      <span
                        className={`font-bold tabular-nums ${
                          isSelected ? 'text-amber-200' : 'text-slate-900'
                        }`}
                      >
                        {formatShortMoney(val, 'KRW')}
                      </span>
                      <span className="text-[10px] opacity-75">({p.toFixed(1)}%)</span>
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          /* 국내여행: 단일 지출 비율 바 */
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
              <span className="flex items-center gap-1">
                카테고리별 지출 비율 ({isActualStarted ? '실제 지출액 기준' : '예상 지출액 기준'})
              </span>
              <span>{sortedAllCats.length}개 카테고리</span>
            </div>

            <div
              className="flex h-11 w-full overflow-hidden rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 shadow-inner"
              title="카테고리별 지출 비율"
            >
              {sortedAllCats.map((k) => {
                const catObj = CATEGORIES[k]
                const p = pct(baseSumsForBar[k], baseTotalForBar)
                if (p <= 0) return null

                const isSelected = selectedCats.includes(k)

                return (
                  <div
                    key={k}
                    className={`${catObj.bar} relative flex h-full items-center justify-center transition-all duration-300 first:rounded-l-xl last:rounded-r-xl group cursor-pointer hover:brightness-110 ${
                      selectedCats.length > 0 && !isSelected ? 'opacity-40 saturate-50' : ''
                    }`}
                    style={{ width: `${p}%`, minWidth: p > 2 ? '14px' : '4px' }}
                    onClick={() => handleToggleCategory(k)}
                    title={`${catObj.label}: 실제 ${won(allCategoryActualSums[k])} (예상 ${won(
                      allCategoryExpectedSums[k]
                    )}) · ${p.toFixed(1)}%`}
                  >
                    {p >= 4 && (
                      <span className="truncate px-1 text-[11px] font-extrabold text-white drop-shadow-sm select-none">
                        {catObj.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 범례 태그들 */}
            <div className="no-scrollbar mt-3 flex flex-wrap items-center gap-2 overflow-x-auto">
              {sortedAllCats.map((k) => {
                const catObj = CATEGORIES[k]
                const val = isActualStarted ? allCategoryActualSums[k] : allCategoryExpectedSums[k]
                const p = pct(val, baseTotalForBar)
                const isSelected = selectedCats.includes(k)

                return (
                  <button
                    key={k}
                    onClick={() => handleToggleCategory(k)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 ring-1 ring-slate-200/60'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${catObj.bar}`} />
                    <span>{catObj.label}</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isSelected ? 'text-amber-200' : 'text-slate-900'
                      }`}
                    >
                      {formatShortMoney(allCategoryActualSums[k] || allCategoryExpectedSums[k])}
                    </span>
                    <span className="text-[10px] opacity-75">({p.toFixed(1)}%)</span>
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 3. [요청사항 3] 해외여행 환전 잔액(원화제외) & 우측 상단 환전한돈 입력칸 */}
      {/* ======================================================== */}
      {isOverseas && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
                <Coins className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  환전 잔액(원화제외)
                </h2>
                <p className="text-[11px] text-slate-400">
                  환전한 외화에서 실제 지출을 차감한 잔액과 남은 일정 예상액을 비교합니다.
                </p>
              </div>
            </div>

            {/* 이름 있는 줄 오른쪽 끝에 환전한 돈 입력칸 */}
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200 shadow-inner">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                환전한 돈 ({currencyInfo.symbol}):
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={localExchanged}
                onChange={(e) => setLocalExchanged(e.target.value)}
                onBlur={handleExchangedBlur}
                placeholder="0"
                className="w-28 text-sm font-black text-slate-900 outline-none bg-transparent tabular-nums placeholder:text-slate-300 text-right"
                title="얼마 환전해갔는지 입력하시면 잔액과 향후 필요 금액이 자동 계산됩니다"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* 1) 외화 잔액: 환전한돈 - 실제 지출(외화) */}
            <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
              <p className="text-[11px] font-semibold text-slate-500">
                현재 외화 잔액
                <span className="ml-1 text-[10px] text-slate-400">(환전액 - 실제지출)</span>
              </p>
              <p
                className={`mt-1 text-xl font-black tabular-nums ${
                  foreignBalance < 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {formatMoney(foreignBalance, tripCurrency)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                실제 지출 외화: {formatMoney(foreignActualTotal, tripCurrency)}
              </p>
            </div>

            {/* 2) 남은일정 외화 예상지출금액 (실제 미입력건) */}
            <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
              <p className="text-[11px] font-semibold text-slate-500">
                남은일정 외화 예상지출금액
                <span className="ml-1 text-[10px] text-slate-400">({upcomingForeignItems.length}건 미입력)</span>
              </p>
              <p className="mt-1 text-xl font-black text-amber-600 tabular-nums">
                {formatMoney(upcomingForeignExpected, tripCurrency)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                앞으로 지출 예정인 외화 합계
              </p>
            </div>

            {/* 3) 잔액과 남은일정 예상액의 차이 (부족 vs 여유) */}
            <div
              className={`rounded-2xl p-3.5 ring-1 ${
                foreignRemainingDiff < 0
                  ? 'bg-rose-50/70 ring-rose-200'
                  : 'bg-emerald-50/70 ring-emerald-200'
              }`}
            >
              <p className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                <span>차이 분석 (잔액 - 남은예상)</span>
                <span
                  className={`rounded-md px-1.5 py-0.2 text-[10px] font-black ${
                    foreignRemainingDiff < 0
                      ? 'bg-rose-200 text-rose-800'
                      : 'bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {foreignRemainingDiff < 0 ? '추가 필요' : '여유 남음'}
                </span>
              </p>
              <p
                className={`mt-1 text-xl font-black tabular-nums ${
                  foreignRemainingDiff < 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {foreignRemainingDiff < 0
                  ? `-${formatMoney(Math.abs(foreignRemainingDiff), tripCurrency)} 부족`
                  : `+${formatMoney(foreignRemainingDiff, tripCurrency)} 남음`}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {foreignRemainingDiff < 0
                  ? `현지에서 약 ${formatMoney(Math.abs(foreignRemainingDiff), tripCurrency)} 추가 환전이나 카드 결제가 필요합니다.`
                  : '예상 지출을 모두 쓰고도 현지 외화가 여유있게 남습니다.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* [요청사항] 회비 걷었을 시 환전잔액처럼 표시되는 회비 잔액 카드 */}
      {/* ======================================================== */}
      {isCollected && collectionData && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-200 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                <WalletCards className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    {isDualCollection
                      ? `회비 잔액 (${currencyInfo.code} 외화 & KRW 원화)`
                      : `회비 잔액 (${isCollectedForeign ? currencyInfo.code : '원화'})`}
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                    ✓ 회비 걷기 완료
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  걷은 총 회비에서 실제 지출을 차감한 잔액과 남은 일정 예상지출금액을 비교합니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {isDualCollection ? (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">외화:</span>
                  <span className="font-extrabold text-emerald-700 text-sm tabular-nums">
                    {formatMoney(dualForeignCollected, tripCurrency)}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 font-medium">원화:</span>
                  <span className="font-extrabold text-teal-700 text-sm tabular-nums">
                    {won(dualKrwCollected)}
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-slate-500 font-medium">걷은 총 회비:</span>
                  <span className="font-extrabold text-emerald-700 text-sm tabular-nums">
                    {formatMoney(collectedTotalAmount, collectedCurrency)}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => setSplitModalMode('collection')}
                className="ml-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition"
              >
                회비 수정
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('저장된 회비 걷기 내역을 해제하시겠습니까?')) {
                    onClearCollection?.()
                  }
                }}
                className="rounded-xl px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
              >
                해제
              </button>
            </div>
          </div>

          {isDualCollection ? (
            /* 해외여행 외화+원화 둘 다 걷었을 시 좌우 2분할 대시보드 */
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 1) 현지 외화 회비 */}
              <div className="rounded-2xl bg-indigo-50/50 p-4 ring-1 ring-indigo-100 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2.5 border-b border-indigo-100">
                  <span className="text-xs font-black text-indigo-700 flex items-center gap-1.5">
                    <Coins className="h-4 w-4" /> 현지 외화 회비 ({currencyInfo.name} {currencyInfo.symbol})
                  </span>
                  <span className="text-xs font-extrabold text-indigo-900 tabular-nums">
                    걷은 총액: {formatMoney(dualForeignCollected, tripCurrency)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-indigo-100">
                    <p className="text-[10px] font-bold text-slate-500">
                      현재 외화 잔액
                      <span className="ml-1 text-[9px] text-slate-400">(외화회비 - 실제지출)</span>
                    </p>
                    <p className={`mt-1 text-base font-black tabular-nums ${dualForeignBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatMoney(dualForeignBalance, tripCurrency)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      실제 지출: {formatMoney(foreignActualTotal, tripCurrency)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-indigo-100">
                    <p className="text-[10px] font-bold text-slate-500">
                      남은일정 외화 예상지출
                      <span className="ml-1 text-[9px] text-slate-400">({upcomingForeignItems.length}건 미입력)</span>
                    </p>
                    <p className="mt-1 text-base font-black text-amber-600 tabular-nums">
                      {formatMoney(upcomingForeignExpected, tripCurrency)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">앞으로 지출 예정 외화</p>
                  </div>
                  <div className={`rounded-xl p-3 ring-1 ${dualForeignDiff < 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
                    <p className="text-[10px] font-bold">차이 분석</p>
                    <p className="mt-1 text-base font-black tabular-nums">
                      {dualForeignDiff < 0
                        ? `-${formatMoney(Math.abs(dualForeignDiff), tripCurrency)} 부족`
                        : `+${formatMoney(dualForeignDiff, tripCurrency)} 남음`}
                    </p>
                    <p className="mt-0.5 text-[10px] opacity-80">
                      {dualForeignDiff < 0 ? '추가 외화 필요' : '외화 여유 남음'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2) 국내/사전 원화 회비 */}
              <div className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/70 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <WalletCards className="h-4 w-4 text-slate-600" /> 국내/사전 원화 회비 (KRW ₩)
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                    걷은 총액: {won(dualKrwCollected)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">
                      현재 원화 잔액
                      <span className="ml-1 text-[9px] text-slate-400">(원화회비 - 실제지출)</span>
                    </p>
                    <p className={`mt-1 text-base font-black tabular-nums ${dualKrwBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {won(dualKrwBalance)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      실제 지출: {won(krwActualTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold text-slate-500">
                      남은일정 원화 예상지출
                      <span className="ml-1 text-[9px] text-slate-400">({upcomingKrwItems.length}건 미입력)</span>
                    </p>
                    <p className="mt-1 text-base font-black text-amber-600 tabular-nums">
                      {won(upcomingKrwExpected)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">앞으로 지출 예정 원화</p>
                  </div>
                  <div className={`rounded-xl p-3 ring-1 ${dualKrwDiff < 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
                    <p className="text-[10px] font-bold">차이 분석</p>
                    <p className="mt-1 text-base font-black tabular-nums">
                      {dualKrwDiff < 0
                        ? `-${won(Math.abs(dualKrwDiff))} 부족`
                        : `+${won(dualKrwDiff)} 남음`}
                    </p>
                    <p className="mt-0.5 text-[10px] opacity-80">
                      {dualKrwDiff < 0 ? '추가 원화 필요' : '원화 여유 남음'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 1) 현재 회비 잔액: 걷은 회비 - 실제 지출 */}
              <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
                <p className="text-[11px] font-semibold text-slate-500">
                  현재 회비 잔액
                  <span className="ml-1 text-[10px] text-slate-400">(걷은회비 - 실제지출)</span>
                </p>
                <p
                  className={`mt-1 text-xl font-black tabular-nums ${
                    collectedBalance < 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatMoney(collectedBalance, collectedCurrency)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  실제 지출: {formatMoney(collectedActualSpent, collectedCurrency)}
                </p>
              </div>

              {/* 2) 남은 일정 예상지출금액 (실제 미입력건) */}
              <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
                <p className="text-[11px] font-semibold text-slate-500">
                  남은일정 예상지출금액
                  <span className="ml-1 text-[10px] text-slate-400">
                    ({upcomingCollectedItems.length}건 미입력)
                  </span>
                </p>
                <p className="mt-1 text-xl font-black text-amber-600 tabular-nums">
                  {formatMoney(upcomingCollectedExpected, collectedCurrency)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  앞으로 지출 예정인 회비 대상 경비
                </p>
              </div>

              {/* 3) 차이 분석 (회비 잔액 - 남은예상) */}
              <div
                className={`rounded-2xl p-3.5 ring-1 ${
                  collectedRemainingDiff < 0
                    ? 'bg-rose-50/70 ring-rose-200'
                    : 'bg-emerald-50/70 ring-emerald-200'
                }`}
              >
                <p className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                  <span>차이 분석 (잔액 - 남은예상)</span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-black ${
                      collectedRemainingDiff < 0
                        ? 'bg-rose-200 text-rose-800'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}
                  >
                    {collectedRemainingDiff < 0 ? '추가 회비 필요' : '여유 남음'}
                  </span>
                </p>
                <p
                  className={`mt-1 text-xl font-black tabular-nums ${
                    collectedRemainingDiff < 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {collectedRemainingDiff < 0
                    ? `-${formatMoney(Math.abs(collectedRemainingDiff), collectedCurrency)} 부족`
                    : `+${formatMoney(collectedRemainingDiff, collectedCurrency)} 남음`}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {collectedRemainingDiff < 0
                    ? `예상 경비 지출 시 약 ${formatMoney(
                        Math.abs(collectedRemainingDiff),
                        collectedCurrency
                      )}의 추가 회비 걷기가 필요합니다.`
                    : '예상 지출을 모두 쓰고도 회비가 여유있게 남아 여행 후 환급 가능합니다.'}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* 4. [요청사항 4] 일차별 필터 위 '선택된 일정 기준 정산 요약' */}
      {/* 해외여행일 시 금액칸을 좌우로 반 나누어 [현지외화] / [원화] 둘 다 표시 */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-indigo-50/70 p-4 ring-1 ring-indigo-200/80 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm shrink-0">
              <CheckSquare className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">
                  {hasUserSelection
                    ? `선택된 ${selectedItemIds.size}개 일정 기준 정산 요약`
                    : '전체 일정 기준 정산 요약'}
                </h3>
                {hasUserSelection && (
                  <button
                    onClick={() => setSelectedItemIds(new Set())}
                    className="rounded-lg bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700 transition"
                  >
                    선택 초기화
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {hasUserSelection
                  ? '상세내역에서 개별 선택된 일정들의 합계로 회비 걷기 및 1/N 정산이 진행됩니다.'
                  : '하단 상세내역의 체크박스를 눌러 원하는 일정만 골라서 정산할 수 있습니다.'}
              </p>
            </div>
          </div>

          {/* 회비 걷기 / 정산하기 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSplitModalMode('collection')}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
            >
              <WalletCards className="h-3.5 w-3.5" />
              <span>{hasUserSelection ? '선택건 회비걷기' : '회비걷기'}</span>
            </button>
            <button
              onClick={() => setSplitModalMode('settle')}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>{hasUserSelection ? '선택건 정산하기' : '정산하기'}</span>
            </button>
          </div>
        </div>

        {/* 금액 카드 2개: 해외여행 시 [외화 묶음 (실제/예상)] / [원화 묶음 (실제/예상)]
                          국내여행 시 [선택 일정 실제 총액] / [선택 일정 예상 총액] */}
        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {isOverseas ? (
            <>
              {/* 1) 왼쪽 칸: 선택일정 실제 총액 (외화) + 선택일정 예상 총액 (외화) */}
              <div className="rounded-2xl bg-white p-3 ring-1 ring-indigo-100">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs sm:text-sm font-black text-indigo-700 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-indigo-600" />
                    <span>외화 ({currencyInfo.symbol})</span>
                  </p>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 ring-1 ring-indigo-200">
                    현지 지출
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100 pt-0.5">
                  <div className="pr-2">
                    <span className="text-[10px] font-bold text-indigo-500 block truncate">선택 일정 실제 총액</span>
                    <p className="text-sm sm:text-base font-black text-indigo-700 tabular-nums truncate">
                      {formatMoney(targetForeignActual, tripCurrency)}
                    </p>
                  </div>
                  <div className="pl-2">
                    <span className="text-[10px] font-bold text-slate-700 block truncate">선택 일정 예상 총액</span>
                    <p className="text-sm sm:text-base font-black text-slate-900 tabular-nums truncate">
                      {formatMoney(targetForeignExpected, tripCurrency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2) 오른쪽 칸: 선택일정 실제 총액 (원화) + 선택일정 예상 총액 (원화) */}
              <div className="rounded-2xl bg-white p-3 ring-1 ring-emerald-100">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs sm:text-sm font-black text-emerald-700 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>원화 (₩)</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100 pt-0.5">
                  <div className="pr-2">
                    <span className="text-[10px] font-bold text-emerald-600 block truncate">선택 일정 실제 총액</span>
                    <p className="text-sm sm:text-base font-black text-emerald-700 tabular-nums truncate">
                      {won(targetKrwActual)}
                    </p>
                  </div>
                  <div className="pl-2">
                    <span className="text-[10px] font-bold text-slate-700 block truncate">선택 일정 예상 총액</span>
                    <p className="text-sm sm:text-base font-black text-slate-900 tabular-nums truncate">
                      {won(targetKrwExpected)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 국내여행 1) 선택 일정 실제 총액 */}
              <div className="rounded-2xl bg-white p-3 ring-1 ring-indigo-100">
                <p className="text-xs sm:text-sm font-black text-slate-800 mb-1.5">선택 일정 실제 총액</p>
                <p className="text-base sm:text-lg font-black text-indigo-700 tabular-nums">
                  {won(targetActualTotal)}
                </p>
              </div>

              {/* 국내여행 2) 선택 일정 예상 총액 */}
              <div className="rounded-2xl bg-white p-3 ring-1 ring-indigo-100">
                <p className="text-xs sm:text-sm font-black text-slate-800 mb-1.5">선택 일정 예상 총액</p>
                <p className="text-base sm:text-lg font-black text-amber-600 tabular-nums">
                  {won(targetExpectedTotal)}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. 일차 선택 필터 & 표시금액 필터 (전체, 실제지출액, 예상지출액) */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">일차별 필터 선택</h2>
          </div>
          <p className="text-xs text-slate-400">
            {selectedDays.includes('all')
              ? '전체 일정 표시 중'
              : `${selectedDays.join(', ')}일차 선택 중 (중복 가능)`}
          </p>
        </div>

        <div className="no-scrollbar flex flex-wrap items-center gap-2">
          {/* 전체일정 버튼 */}
          <button
            onClick={() => handleToggleDay('all')}
            className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-extrabold transition active:scale-95 ${
              selectedDays.includes('all')
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체일정
          </button>

          {/* 1일차 ~ n일차 버튼들 */}
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
            const isSelected = selectedDays.includes(d)
            return (
              <button
                key={d}
                onClick={() => handleToggleDay(d)}
                className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
                <span>{d}일차</span>
                <span
                  className={`text-[10px] ${
                    isSelected ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  {dayLabel(d)}
                </span>
              </button>
            )
          })}
        </div>

        {/* 일차별 필터 밑에 표시금액 필터 (전체, 실제지출액, 예상지출액) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>표시 금액 필터</span>
          </div>

          <div className="inline-flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200/60">
            {[
              { id: 'all', label: '전체 (실제+예상)' },
              { id: 'actual', label: '실제 지출액' },
              { id: 'expected', label: '예상 지출액' },
            ].map(({ id, label }) => {
              const active = amountFilter === id
              return (
                <button
                  key={id}
                  type="button"
                  id={`filter-amount-${id}`}
                  onClick={() => setAmountFilter(id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition active:scale-95 ${
                    active
                      ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. [요청사항 5] 카테고리별 지출 금액 (다중 선택/해제 토글 가능) */}
      {/* 해외여행일 시 금액칸만 좌우 반 나눠서 원화 외화 둘 다 표시 */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">
              카테고리별 지출 금액{' '}
              <span className="text-xs font-normal text-slate-500">
                (클릭 시 선택/취소되며 중복 선택 가능합니다)
              </span>
            </h2>
          </div>
          <span className="text-xs font-bold tabular-nums">
            {isOverseas ? (
              <>
                <span className="text-indigo-600">
                  외화 {formatMoney(dayFilteredForeignActualTotal, tripCurrency)}
                </span>
                <span className="text-slate-300 mx-1.5">·</span>
                <span className="text-emerald-600">
                  원화 {won(dayFilteredKrwActualTotal)}
                </span>
              </>
            ) : (
              <span className="text-indigo-600">
                선택 일차 실제: {won(dayFilteredActualTotal)}{' '}
                <span className="text-slate-400 font-normal">(예상 {won(dayFilteredExpectedTotal)})</span>
              </span>
            )}
          </span>
        </div>

        {/* 카테고리 카드 8개 (다중 선택 토글 지원) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {/* 1) 전체(ALL) 금액 카드 */}
          <button
            onClick={() => handleToggleCategory('all')}
            className={`rounded-2xl p-2.5 text-left ring-1 transition hover:-translate-y-0.5 active:scale-95 sm:p-3 ${
              selectedCats.length === 0
                ? 'bg-indigo-50/90 ring-2 ring-indigo-500 shadow-md shadow-indigo-500/10'
                : 'bg-slate-50 ring-slate-200 hover:bg-white hover:ring-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-600 text-xs font-black text-white sm:h-7 sm:w-7 sm:rounded-xl">
                ALL
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {amountFilter === 'expected'
                  ? `${dayFilteredItems.filter((i) => getExpected(i) > 0).length}건`
                  : `${dayFilteredItems.filter((i) => getActual(i) > 0).length}건`}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-slate-600 sm:text-xs">
              {amountFilter === 'expected' ? '예상 전체' : '실제 전체'}
            </p>

            {/* 해외여행 시 금액칸 좌우 반 분할 (외화=파랑, 원화=초록) */}
            {isOverseas ? (
              <div className="mt-1 grid grid-cols-2 divide-x divide-slate-200 text-left">
                <div className="pr-1">
                  <span className="text-[9px] font-extrabold text-indigo-600 block">
                    {currencyInfo.code} ({currencyInfo.symbol})
                  </span>
                  <p className="text-[11px] sm:text-xs font-black tabular-nums text-indigo-700 truncate" title={formatMoney(amountFilter === 'expected' ? dayFilteredForeignExpectedTotal : dayFilteredForeignActualTotal, tripCurrency)}>
                    {formatMoney(
                      amountFilter === 'expected'
                        ? dayFilteredForeignExpectedTotal
                        : dayFilteredForeignActualTotal,
                      tripCurrency
                    )}
                  </p>
                </div>
                <div className="pl-1">
                  <span className="text-[9px] font-extrabold text-emerald-600 block">
                    KRW (₩)
                  </span>
                  <p className="text-[11px] sm:text-xs font-black tabular-nums text-emerald-700 truncate" title={won(amountFilter === 'expected' ? dayFilteredKrwExpectedTotal : dayFilteredKrwActualTotal)}>
                    {won(
                      amountFilter === 'expected'
                        ? dayFilteredKrwExpectedTotal
                        : dayFilteredKrwActualTotal
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p
                  className="text-xs font-black tabular-nums text-slate-900 truncate sm:text-[13px]"
                  title={
                    amountFilter === 'expected'
                      ? won(dayFilteredExpectedTotal)
                      : won(dayFilteredActualTotal)
                  }
                >
                  {amountFilter === 'expected'
                    ? won(dayFilteredExpectedTotal)
                    : won(dayFilteredActualTotal)}
                </p>
                {amountFilter === 'all' && (
                  <p className="text-[10px] text-slate-400 truncate">
                    예상 {won(dayFilteredExpectedTotal)}
                  </p>
                )}
              </>
            )}
          </button>

          {/* 2) 각 카테고리별 금액 카드 (클릭 시 토글 & 해외여행 시 좌우 분할) */}
          {CATEGORY_KEYS.map((k) => {
            const c = CATEGORIES[k]
            const Icon = c.icon
            const catInfo = catSumsForSelectedDays[k]
            const catForeign = catSumsForeignForSelectedDays[k]
            const catKrw = catSumsKrwForSelectedDays[k]
            const isOn = selectedCats.includes(k)

            const displayVal =
              amountFilter === 'expected' ? catInfo.expectedSum : catInfo.actualSum
            const totalForPct =
              amountFilter === 'expected' ? dayFilteredExpectedTotal : dayFilteredActualTotal
            const p = pct(displayVal, totalForPct)

            // 해외여행 분할 금액
            const foreignVal =
              amountFilter === 'expected' ? catForeign.expectedSum : catForeign.actualSum
            const krwVal =
              amountFilter === 'expected' ? catKrw.expectedSum : catKrw.actualSum

            return (
              <button
                key={k}
                id={`budget-cat-card-${k}`}
                onClick={() => handleToggleCategory(k)}
                className={`relative rounded-2xl p-2.5 text-left ring-1 transition hover:-translate-y-0.5 active:scale-95 sm:p-3 ${
                  isOn
                    ? 'bg-white ring-2 ring-indigo-500 shadow-md shadow-indigo-500/15'
                    : 'bg-slate-50/70 ring-slate-200 hover:bg-white hover:ring-slate-300'
                }`}
              >
                {isOn && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-lg sm:h-7 sm:w-7 sm:rounded-xl ${c.soft}`}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  {!isOn && (
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                      {p.toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600 sm:text-xs">{c.label}</p>
                  <span className="text-[10px] text-slate-400">
                    {amountFilter === 'expected' ? catInfo.expectedCount : catInfo.actualCount}건
                  </span>
                </div>

                {/* 해외여행 시 금액칸 좌우 반 나눠서 외화(파랑) / 원화(초록) 둘 다 표시 */}
                {isOverseas ? (
                  <div className="mt-1 grid grid-cols-2 divide-x divide-slate-200 text-left">
                    <div className="pr-1">
                      <span className="text-[9px] font-extrabold text-indigo-600 block">
                        {currencyInfo.code} ({currencyInfo.symbol})
                      </span>
                      <p className="text-[11px] sm:text-xs font-black tabular-nums text-indigo-700 truncate" title={formatMoney(foreignVal, tripCurrency)}>
                        {formatMoney(foreignVal, tripCurrency)}
                      </p>
                    </div>
                    <div className="pl-1">
                      <span className="text-[9px] font-extrabold text-emerald-600 block">
                        KRW (₩)
                      </span>
                      <p className="text-[11px] sm:text-xs font-black tabular-nums text-emerald-700 truncate" title={won(krwVal)}>
                        {won(krwVal)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p
                      className="text-xs font-black tabular-nums text-slate-900 truncate sm:text-[13px]"
                      title={won(displayVal)}
                    >
                      {won(displayVal)}
                    </p>
                    {amountFilter === 'all' && (
                      <p className="text-[10px] text-slate-400 truncate">
                        예상 {won(catInfo.expectedSum)}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${p}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. 지출 상세내역 (개별 체크박스 선택 & 합계 지원) */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">
              {selectedCats.length === 0
                ? '전체'
                : selectedCats.map((k) => CATEGORIES[k]?.label).join(', ')}{' '}
              지출 상세내역
            </h2>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-extrabold text-indigo-600">
              총 {finalExpenses.length}건
            </span>

            {/* 전체 선택 / 해제 토글 버튼 */}
            {finalExpenses.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="ml-2 flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 transition"
              >
                {finalExpenses.every((i) => selectedItemIds.has(i.id)) ? (
                  <>
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                    <span>전체 해제</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                    <span>모두 선택</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 mr-2">
              {amountFilter === 'expected'
                ? '예상 소계'
                : amountFilter === 'actual'
                ? '실제 소계'
                : '실제 소계'}
            </span>
            {isOverseas ? (
              <span className="text-sm sm:text-base font-black text-slate-900 tabular-nums">
                {amountFilter === 'expected' ? (
                  <>
                    <span className="text-indigo-600">
                      {formatMoney(finalForeignExpectedSum, tripCurrency)}
                    </span>
                    <span className="text-slate-400 font-medium text-xs mx-1">+</span>
                    <span className="text-emerald-600">{won(finalKrwExpectedSum)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-indigo-600">
                      {formatMoney(finalForeignActualSum, tripCurrency)}
                    </span>
                    <span className="text-slate-400 font-medium text-xs mx-1">+</span>
                    <span className="text-emerald-600">{won(finalKrwActualSum)}</span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-base font-black text-slate-900 tabular-nums">
                {amountFilter === 'expected' ? won(finalExpectedSum) : won(finalActualSum)}
              </span>
            )}
            {amountFilter === 'all' && (
              <div className="text-[11px] text-slate-400 font-semibold tabular-nums mt-0.5">
                {isOverseas ? (
                  <span>
                    (예상: {formatMoney(finalForeignExpectedSum, tripCurrency)} +{' '}
                    {won(finalKrwExpectedSum)})
                  </span>
                ) : (
                  <span>(예상: {won(finalExpectedSum)})</span>
                )}
              </div>
            )}
          </div>
        </div>

        {finalExpenses.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-slate-400">
              선택한 조건의 지출 내역이 없습니다.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              다른 일차나 카테고리, 금액 필터를 선택해보세요.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {finalExpenses.map((item) => {
              const act = getActual(item)
              const exp = getExpected(item)
              const isChecked = selectedItemIds.has(item.id)
              const itemCurrency = item.currency || (isOverseas ? tripCurrency : 'KRW')
              const isKrw = itemCurrency === 'KRW'

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleItemCheck(item.id)}
                  className={`flex items-start gap-3 py-3 transition rounded-xl px-2.5 -mx-2.5 cursor-pointer ${
                    isChecked
                      ? 'bg-indigo-50/70 hover:bg-indigo-50'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* 개별 체크박스 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleItemCheck(item.id)
                    }}
                    className="mt-1 text-slate-400 hover:text-indigo-600 transition shrink-0"
                    aria-label="일정 선택"
                  >
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300" />
                    )}
                  </button>

                  {/* 일차 뱃지 */}
                  <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-600">
                    D{item.day}
                  </span>

                  {/* 일정명 및 시간, 카테고리, 메모 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 leading-snug">{item.title}</p>
                      <CategoryBadge category={item.category} />
                      {/* 화폐 뱃지 (해외여행 시 외화=파랑, 원화=초록 통일) */}
                      {isOverseas && (
                        <span
                          className={`rounded-md px-1.5 py-0.2 text-[10px] font-extrabold ring-1 ${
                            isKrw
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                          }`}
                        >
                          {itemCurrency}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        {item.time || '--:--'}
                      </span>
                      {item.memo && (
                        <span className="line-clamp-1 text-slate-500">· {item.memo}</span>
                      )}
                    </div>
                  </div>

                  {/* 지출 금액: 실제 지출액 위(외화=파랑, 원화=초록) / 예상 지출액 아래(회색) */}
                  <div className="shrink-0 text-right">
                    {amountFilter === 'all' && (
                      <div>
                        {/* 실제 지출액 (위) */}
                        <p
                          className={`text-sm tabular-nums ${
                            act > 0
                              ? `font-black ${
                                  isOverseas && isKrw ? 'text-emerald-600' : 'text-indigo-600'
                                }`
                              : 'text-slate-400 font-medium'
                          }`}
                        >
                          {act > 0 ? formatMoney(act, itemCurrency) : '실제: 미입력'}
                        </p>
                        {/* 예상 지출액 (아래 - 국내여행과 동일하게 회색) */}
                        <p className="text-xs font-bold text-slate-400 tabular-nums">
                          예상: {formatMoney(exp, itemCurrency)}
                        </p>
                      </div>
                    )}

                    {amountFilter === 'actual' && (
                      <p
                        className={`text-sm font-black tabular-nums ${
                          isOverseas && isKrw ? 'text-emerald-600' : 'text-indigo-600'
                        }`}
                      >
                        {act > 0 ? formatMoney(act, itemCurrency) : '0원'}
                      </p>
                    )}

                    {amountFilter === 'expected' && (
                      <p className="text-sm font-black text-slate-400 tabular-nums">
                        {formatMoney(exp, itemCurrency)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 하단 요약 바 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white">
          <span className="text-xs font-medium text-slate-300">
            {selectedDays.includes('all') ? '전체일정' : `${selectedDays.join(', ')}일차`} ·{' '}
            {selectedCats.length === 0
              ? '전체 항목'
              : selectedCats.map((k) => CATEGORIES[k]?.label).join(', ')}{' '}
            합계
          </span>
          <div className="flex items-center gap-3">
            {isOverseas ? (
              <>
                <span className="text-sm font-semibold text-slate-300">
                  실제:{' '}
                  <strong className="text-indigo-300 text-base">
                    {formatMoney(finalForeignActualSum, tripCurrency)}
                  </strong>
                  <span className="text-xs text-slate-400 mx-1">+</span>
                  <strong className="text-emerald-300 text-base">
                    {won(finalKrwActualSum)}
                  </strong>
                </span>
                <span className="text-xs text-slate-400">
                  (예상: {formatMoney(finalForeignExpectedSum, tripCurrency)} +{' '}
                  {won(finalKrwExpectedSum)})
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-300">
                  실제: <strong className="text-amber-300 text-base">{won(finalActualSum)}</strong>
                </span>
                <span className="text-xs text-slate-400">(예상: {won(finalExpectedSum)})</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 정산하기 / 회비 걷기 공용 모달 */}
      <SplitSettlementModal
        open={Boolean(splitModalMode)}
        onClose={() => setSplitModalMode(null)}
        isCollection={splitModalMode === 'collection'}
        total={splitModalMode === 'collection' ? targetExpectedTotal : targetActualTotal}
        foreignTotal={splitModalMode === 'collection' ? targetForeignExpected : targetForeignActual}
        krwTotal={splitModalMode === 'collection' ? targetKrwExpected : targetKrwActual}
        defaultHeadcount={headcount}
        tripTitle={
          hasUserSelection
            ? `${tripTitle} (선택된 ${selectedItemIds.size}개 일정)`
            : tripTitle
        }
        isSettled={isSettled}
        initialData={splitModalMode === 'settle' ? settlementData : null}
        onSave={(data) => {
          if (splitModalMode === 'settle') {
            onSaveSettlement?.(data)
          }
          setSplitModalMode(null)
        }}
        onClear={() => {
          onClearSettlement?.()
          setSplitModalMode(null)
        }}
        tripType={tripType}
        tripCurrency={tripCurrency}
        collectionData={collectionData}
        onSaveCollection={(data) => {
          onSaveCollection?.(data)
          setSplitModalMode(null)
        }}
      />
    </div>
  )
}
