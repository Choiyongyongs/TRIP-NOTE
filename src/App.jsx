import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import {
  Calculator,
  Wallet,
  Route,
  ListTodo,
  Plus,
  CalendarDays,
  Layers,
  ArrowLeft,
  Luggage,
  Sparkles,
  Pencil,
  MapPin,
  Users,
  ArrowLeftRight,
  ArrowUpRight,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { INITIAL_TRIPS, uid, won, formatMoney, getDayColor, calculateStayInfo } from './data'
import Collapsible from './components/Collapsible'
import MapView from './components/MapView'
import ScheduleCard from './components/ScheduleCard'
import TransitConnector from './components/TransitConnector'
import AddScheduleModal from './components/AddScheduleModal'
import BudgetView from './components/BudgetView'
import PackingListView from './components/PackingListView'
import TripListView, { getTripStatus } from './components/TripListView'
import EditTripModal from './components/EditTripModal'
import {
  fetchTripsFromSupabase,
  upsertTripsToSupabase,
  deleteTripFromSupabase,
} from './services/supabaseService'

const STORAGE_KEY = 'tripnote-multi-v3'

// 여행 기간(시작일~종료일, 몇박몇일) 포맷터
const getTripPeriod = (start, days = 1) => {
  if (!start) return { fullPeriod: '', shortPeriod: '', nightDay: '' }
  const dt = new Date(`${start}T00:00:00`)
  if (isNaN(dt)) return { fullPeriod: start, shortPeriod: start, nightDay: `${days}일간` }
  
  const sStr = `${dt.getMonth() + 1}.${dt.getDate()}`
  const sFull = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`

  const endDt = new Date(dt)
  endDt.setDate(endDt.getDate() + days - 1)
  const eStr = `${endDt.getMonth() + 1}.${endDt.getDate()}`
  const eFull = `${endDt.getFullYear()}.${String(endDt.getMonth() + 1).padStart(2, '0')}.${String(endDt.getDate()).padStart(2, '0')}`

  const nightDay = days - 1 > 0 ? `${days - 1}박 ${days}일` : '당일치기'
  return {
    fullPeriod: `${sFull} ~ ${eFull}`,
    shortPeriod: `${sStr} ~ ${eStr}`,
    nightDay,
  }
}

const saved = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export default function App() {
  // 전체 여행 플랜 목록 상태
  const [trips, setTrips] = useState(saved?.trips ?? INITIAL_TRIPS)
  // 현재 선택된 여행 플랜 ID (null이면 첫 메인페이지인 '여행 플랜 목록' 화면)
  const [currentTripId, setCurrentTripId] = useState(null)
  // 상세 화면 탭: 'packing'(체크리스트) | 'schedule_map'(여행일정 & 지도) | 'budget'(가계부 & 정산)
  const [activeTab, setActiveTab] = useState('packing')

  // 지도 & 타임라인 관련 상태
  const [day, setDay] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [addDefaultDay, setAddDefaultDay] = useState(1)
  const [drag, setDrag] = useState({ id: null, over: null })
  const [mapMode, setMapMode] = useState(saved?.mapMode ?? 'naver')
  const [editTripModalOpen, setEditTripModalOpen] = useState(false)
  const mapRef = useRef(null)
  const isSupabaseHydratedRef = useRef(false)

  // 앱 최초 실행 시 Supabase 클라우드 DB에서 여행 플랜 동기화
  useEffect(() => {
    let cancelled = false
    fetchTripsFromSupabase().then((remoteTrips) => {
      if (cancelled) return
      if (Array.isArray(remoteTrips)) {
        if (remoteTrips.length > 0) {
          setTrips(remoteTrips)
        } else {
          // 클라우드 테이블이 비어 있으면 현재 로컬 플랜들을 최초 업로드
          upsertTripsToSupabase(saved?.trips ?? INITIAL_TRIPS)
        }
      }
      isSupabaseHydratedRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 상태 변경 시 로컬스토리지 저장 + Supabase 클라우드 자동 동기화 (디바운스)
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ trips, mapMode })
    )
    if (!isSupabaseHydratedRef.current) return
    const timer = setTimeout(() => {
      upsertTripsToSupabase(trips)
    }, 400)
    return () => clearTimeout(timer)
  }, [trips, mapMode])

  // 현재 선택된 여행 플랜 객체
  const currentTrip = useMemo(
    () => trips.find((t) => t.id === currentTripId) || null,
    [trips, currentTripId]
  )

  // ---------- 현재 플랜의 파생 데이터 ----------
  const items = useMemo(() => currentTrip?.items || [], [currentTrip?.items])
  const dayCount = currentTrip?.dayCount || 3
  const headcount = currentTrip?.headcount || 2
  const tripTitle = currentTrip?.title || '여행 플랜'
  const startDate = currentTrip?.startDate || '2026-10-25'
  const packingList = currentTrip?.packingList || []

  const tripPeriod = useMemo(
    () => getTripPeriod(startDate, dayCount),
    [startDate, dayCount]
  )
  const mapPointsCount = useMemo(
    () => items.filter((i) => i.showOnMap).length,
    [items]
  )

  // 여행 플랜 수정 헬퍼 (객체 또는 함수형 업데이터 모두 지원하여 동시 업데이트 손실 방지)
  const updateCurrentTrip = useCallback(
    (patchOrUpdater) => {
      if (!currentTripId) return
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== currentTripId) return t
          const patch =
            typeof patchOrUpdater === 'function' ? patchOrUpdater(t) : patchOrUpdater
          return { ...t, ...patch }
        })
      )
    },
    [currentTripId]
  )

  // 여행 생성 & 삭제
  const handleCreateTrip = (newTrip) => {
    setTrips((prev) => [newTrip, ...prev])
    setCurrentTripId(newTrip.id)
    setActiveTab('packing')
    setDay(1)
  }

  const handleDeleteTrip = (tripId) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId))
    deleteTripFromSupabase(tripId)
    if (currentTripId === tripId) {
      setCurrentTripId(null)
    }
  }

  const total = useMemo(
    () => items.filter((i) => !i.isAlternative).reduce((s, i) => s + (i.expense || 0), 0),
    [items]
  )

  const dayTotals = useMemo(() => {
    const t = Array(dayCount + 1).fill(0)
    items.forEach((i) => {
      if (i.day <= dayCount && !i.isAlternative) t[i.day] += i.expense || 0
    })
    return t
  }, [items, dayCount])

  // 본 일정들 (대체 일정이 아닌 정식 일정들)
  const dayItems = useMemo(
    () => items.filter((i) => i.day === day && !i.isAlternative),
    [items, day]
  )

  // 선택된 본 일정 (타임라인에서 선택된 일정 또는 첫 번째 본 일정)
  const selectedMainItem = useMemo(() => {
    if (selectedId) {
      const found = items.find((i) => i.id === selectedId)
      if (found && !found.isAlternative) return found
      if (found && found.isAlternative) {
        return items.find((i) => i.id === found.parentScheduleId) || null
      }
    }
    return dayItems[0] || null
  }, [items, selectedId, dayItems])

  // 선택된 본 일정의 순번 (1부터 시작)
  const selectedMainIndex = useMemo(() => {
    if (!selectedMainItem) return 1
    const idx = dayItems.findIndex((i) => i.id === selectedMainItem.id)
    return idx >= 0 ? idx + 1 : 1
  }, [dayItems, selectedMainItem])

  // 선택된 본 일정에 등록된 대체 일정들
  const currentAltSchedules = useMemo(() => {
    if (!selectedMainItem) return []
    return items.filter((i) => i.isAlternative && i.parentScheduleId === selectedMainItem.id)
  }, [items, selectedMainItem])

  // 대체 일정 영역 드래그 오버 상태
  const [altSectionDragOver, setAltSectionDragOver] = useState(false)
  const [altCardDragOverId, setAltCardDragOverId] = useState(null)

  // 지도 표시 일차 필터: ['current'] | ['all'] | [1, 2] 등 중복 선택 가능
  const [mapFilterDays, setMapFilterDays] = useState(['current'])

  // 지도 일차 필터 토글 핸들러
  const handleToggleMapDay = (dayTarget) => {
    if (dayTarget === 'current') {
      setMapFilterDays(['current'])
      return
    }
    if (dayTarget === 'all') {
      setMapFilterDays(['all'])
      return
    }

    const next = mapFilterDays.filter((d) => d !== 'current' && d !== 'all')
    const exists = next.includes(dayTarget)
    let updated
    if (exists) {
      updated = next.filter((d) => d !== dayTarget)
    } else {
      updated = [...next, dayTarget].sort((a, b) => a - b)
    }

    if (updated.length === 0) {
      setMapFilterDays(['current'])
    } else {
      setMapFilterDays(updated)
    }
  }

  // 지도에 표시될 포인트들 (본 일정 + 대체 일정 번호 1-1, 1-2 계산)
  const mapPoints = useMemo(() => {
    let targetItems = []
    if (mapFilterDays.includes('current')) {
      targetItems = items.filter((i) => i.day === day && i.showOnMap)
    } else if (mapFilterDays.includes('all')) {
      targetItems = items.filter((i) => i.showOnMap)
    } else {
      targetItems = items.filter((i) => mapFilterDays.includes(i.day) && i.showOnMap)
    }

    // 일차별 본 일정 목록 사전 산출
    const mainItemsByDay = {}
    items.forEach((i) => {
      if (!i.isAlternative) {
        if (!mainItemsByDay[i.day]) mainItemsByDay[i.day] = []
        mainItemsByDay[i.day].push(i)
      }
    })

    // 일차별 대체 일정 카운터
    const altCounters = {}

    return targetItems.map((item) => {
      const d = item.day || 1
      const dayMainList = mainItemsByDay[d] || []

      if (!item.isAlternative) {
        const mIdx = dayMainList.findIndex((m) => m.id === item.id) + 1
        return {
          ...item,
          dayIndex: mIdx > 0 ? mIdx : 1,
          isAlternative: false,
        }
      } else {
        // 대체 일정인 경우
        const parentIdx = dayMainList.findIndex((m) => m.id === item.parentScheduleId) + 1
        const pNum = parentIdx > 0 ? parentIdx : 1
        const key = `${d}-${item.parentScheduleId}`
        altCounters[key] = (altCounters[key] || 0) + 1
        const altIdx = altCounters[key]

        return {
          ...item,
          dayIndex: pNum,
          altNumber: `${pNum}-${altIdx}`,
          isAlternative: true,
        }
      }
    })
  }, [items, day, mapFilterDays])

  const mapIndex = useMemo(
    () => Object.fromEntries(mapPoints.map((p, i) => [p.id, p.altNumber || p.dayIndex || i + 1])),
    [mapPoints]
  )

  // 본 일정과 대체 일정 자리 맞바꾸기 (스왑)
  const swapMainAndAlt = (mainItemId, altItemId) => {
    const mainItem = items.find((i) => i.id === mainItemId)
    const altItem = items.find((i) => i.id === altItemId)
    if (!mainItem || !altItem) return

    const updated = items.map((i) => {
      if (i.id === mainItemId) {
        return {
          ...i,
          isAlternative: true,
          parentScheduleId: altItemId,
        }
      }
      if (i.id === altItemId) {
        return {
          ...i,
          isAlternative: false,
          parentScheduleId: undefined,
          time: mainItem.time || i.time,
        }
      }
      if (i.isAlternative && i.parentScheduleId === mainItemId) {
        return {
          ...i,
          parentScheduleId: altItemId,
        }
      }
      return i
    })

    updateCurrentTrip({ items: updated })
    setSelectedId(altItemId)
  }

  // 대체 일정을 본 일정으로 승격하여 타임라인 특정 위치에 삽입
  const promoteAltToMain = (altItemId, targetIndex) => {
    const altItem = items.find((i) => i.id === altItemId)
    if (!altItem) return

    const promoted = {
      ...altItem,
      isAlternative: false,
      parentScheduleId: undefined,
    }

    const otherItems = items.filter((i) => i.id !== altItemId && (i.day !== day || i.isAlternative))
    const curMainList = [...items.filter((i) => i.day === day && !i.isAlternative)]
    const insertIdx = targetIndex !== undefined ? targetIndex : curMainList.length
    curMainList.splice(insertIdx, 0, promoted)

    updateCurrentTrip({ items: [...otherItems, ...curMainList] })
    setSelectedId(altItemId)
  }

  // 본 일정을 다른 일정의 대체 일정으로 변경
  const demoteMainToAlt = (mainItemId, targetParentId) => {
    if (!mainItemId || !targetParentId || mainItemId === targetParentId) return
    const updated = items.map((i) => {
      if (i.id === mainItemId) {
        return {
          ...i,
          isAlternative: true,
          parentScheduleId: targetParentId,
        }
      }
      return i
    })
    updateCurrentTrip({ items: updated })
    setSelectedId(targetParentId)
  }

  // 실제 일정을 대체 일정 영역으로 드롭했을 때 처리
  const handleDropToAltSection = (fromId, targetAltId = null) => {
    setAltSectionDragOver(false)
    setAltCardDragOverId(null)
    if (!fromId || !selectedMainItem) return
    const fromItem = items.find((x) => x.id === fromId)
    if (!fromItem) return

    // 1) 대체 일정 간의 드롭인 경우
    if (fromItem.isAlternative) {
      if (targetAltId && targetAltId !== fromId) {
        const targetAlt = items.find((x) => x.id === targetAltId)
        if (targetAlt?.isAlternative) {
          const fromIdx = items.indexOf(fromItem)
          const targetIdx = items.indexOf(targetAlt)
          const newItems = [...items]
          newItems[fromIdx] = targetAlt
          newItems[targetIdx] = fromItem
          updateCurrentTrip({ items: newItems })
        }
      }
      return
    }

    // 2) 실제 일정을 대체 일정으로 드롭한 경우
    if (targetAltId) {
      // 특정 대체 일정 카드 위에 드롭: 해당 대체 일정과 본 일정을 맞바꿈(스왑)
      swapMainAndAlt(fromId, targetAltId)
    } else {
      // 대체 일정 빈 영역/목록에 드롭한 경우
      if (fromId === selectedMainItem.id) {
        // 현재 선택된 본 일정 자체를 드롭한 경우:
        // 대체 일정이 있으면 첫 번째 대체 일정과 맞바꿈
        if (currentAltSchedules.length > 0) {
          swapMainAndAlt(fromId, currentAltSchedules[0].id)
        }
      } else {
        // 다른 본 일정을 드롭한 경우: 해당 본 일정을 현재 선택된 일정의 대체 일정으로 전환
        demoteMainToAlt(fromId, selectedMainItem.id)
      }
    }
  }

  const dayLabel = useCallback(
    (d) => {
      const dt = new Date(`${startDate}T00:00:00`)
      if (isNaN(dt)) return ''
      dt.setDate(dt.getDate() + d - 1)
      return `${dt.getMonth() + 1}/${dt.getDate()} (${WEEK[dt.getDay()]})`
    },
    [startDate]
  )

  // ---------- 일정 조작 액션 ----------
  const select = useCallback((id) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }, [])

  const selectFromCard = (id) => {
    const item = items.find((i) => i.id === id)
    select(id)
    if (item?.showOnMap && mapRef.current && window.innerWidth < 1024) {
      const r = mapRef.current.getBoundingClientRect()
      if (r.bottom < 140 || r.top > window.innerHeight) {
        mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  const updateItem = useCallback(
    (id, patch) => {
      updateCurrentTrip((t) => ({
        items: (t.items || []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
      }))
    },
    [updateCurrentTrip]
  )

  const deleteItem = useCallback(
    (id) => {
      updateCurrentTrip((t) => ({
        items: (t.items || []).filter((i) => i.id !== id),
      }))
      if (selectedId === id) setSelectedId(null)
    },
    [updateCurrentTrip, selectedId]
  )

  const reorder = (fromId, toIndex, targetDay = day) => {
    const list = items.filter((i) => i.day === targetDay)
    const from = list.findIndex((i) => i.id === fromId)
    if (from < 0 || toIndex < 0 || toIndex >= list.length || from === toIndex) return

    // 각 순번 위치의 기존 시간 목록을 그대로 보존 (시간 고정)
    const originalTimes = list.map((item) => item.time)

    // 순서 재배치
    const [moved] = list.splice(from, 1)
    list.splice(toIndex, 0, moved)

    // 각 위치(순번)의 원래 시간(time)을 그대로 고정 유지하고 내용만 교체!
    const reorderedList = list.map((item, idx) => ({
      ...item,
      time: originalTimes[idx] !== undefined ? originalTimes[idx] : item.time,
    }))

    const updated = [...items.filter((i) => i.day !== targetDay), ...reorderedList]
    updateCurrentTrip({ items: updated })
  }

  const move = (id, dir, targetDay = day) => {
    const list = items.filter((i) => i.day === targetDay)
    const curIdx = list.findIndex((i) => i.id === id)
    reorder(id, curIdx + dir, targetDay)
  }

  const toggleMap = (id) => {
    const targetItem = items.find((x) => x.id === id)
    if (!targetItem) return
    const list = items.filter((i) => i.day === targetItem.day)

    const updated = items.map((i) => {
      if (i.id !== id) return i
      if (i.showOnMap) return { ...i, showOnMap: false }
      if (!i.lat || !i.lng) {
        const idx = list.findIndex((x) => x.id === id)
        const ref =
          [...list.slice(0, idx)].reverse().find((x) => x.showOnMap) ??
          list.find((x) => x.showOnMap)
        const base = ref ?? { lat: 33.38, lng: 126.55 }
        return {
          ...i,
          showOnMap: true,
          lat: +(base.lat + 0.012).toFixed(4),
          lng: +(base.lng + 0.012).toFixed(4),
        }
      }
      return { ...i, showOnMap: true }
    })
    updateCurrentTrip({ items: updated })
  }

  // 대체 일정 추가 모드 대상 부모 일정
  const [addingAltParent, setAddingAltParent] = useState(null)

  const addItem = (data) => {
    if (addingAltParent) {
      // [요청사항] 대체 일정으로 등록
      const item = {
        id: uid(),
        ...data,
        day: addingAltParent.day,
        isAlternative: true,
        parentScheduleId: addingAltParent.id,
      }
      setAddingAltParent(null)
      updateCurrentTrip({ items: [...items, item] })
      setSelectedId(addingAltParent.id)
    } else {
      const item = { id: uid(), ...data, isAlternative: false }
      const same = items.filter((i) => i.day === item.day && !i.isAlternative)
      const before = same.find((i) => i.time > item.time)
      let newItems
      if (!before) {
        newItems = [...items, item]
      } else {
        const at = items.indexOf(before)
        newItems = [...items.slice(0, at), item, ...items.slice(at)]
      }
      updateCurrentTrip({ items: newItems })
      setDay(item.day)
      if (item.showOnMap) setSelectedId(item.id)
    }
  }

  const defaultCoord = useMemo(() => {
    const last = mapPoints[mapPoints.length - 1]
    return last
      ? { lat: last.lat + 0.01, lng: last.lng + 0.01 }
      : { lat: 33.4996, lng: 126.5312 }
  }, [mapPoints])

  const changeDay = (d) => {
    setDay(d)
    setSelectedId(null)
  }

  const handleOpenAdd = (targetDay = day) => {
    setEditingItem(null)
    setAddingAltParent(null)
    setAddDefaultDay(targetDay)
    setAdding(true)
  }

  const handleOpenAddAlternative = (parentItem) => {
    if (!parentItem) return
    setEditingItem(null)
    setAddDefaultDay(parentItem.day)
    setAddingAltParent(parentItem)
    setAdding(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setAddingAltParent(null)
    setAddDefaultDay(item.day)
    setAdding(true)
  }

  // 준비물 업데이트
  const handleUpdatePackingList = (newPackingList) => {
    updateCurrentTrip({ packingList: newPackingList })
  }

  // 드래그 앤 드롭
  const dragHandlers = (id, index) => ({
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      setDrag({ id, over: null })
    },
    onDragOver: (e) => {
      e.preventDefault()
      if (drag.over !== id) setDrag((d) => ({ ...d, over: id }))
    },
    onDragLeave: () => setDrag((d) => (d.over === id ? { ...d, over: null } : d)),
    onDrop: (e) => {
      e.preventDefault()
      const from = e.dataTransfer.getData('text/plain') || drag.id
      setDrag({ id: null, over: null })
      if (!from) return

      const fromItem = items.find((x) => x.id === from)
      if (fromItem?.isAlternative) {
        promoteAltToMain(from, index)
      } else {
        reorder(from, index, day)
      }
    },
    onDragEnd: () => setDrag({ id: null, over: null }),
  })

  const selected = items.find((i) => i.id === selectedId)

  // ========================================================
  // 화면 1: 첫 메인페이지 — 여행 플랜 목록 (제주여행, 경주여행 등등)
  // ========================================================
  if (!currentTripId || !currentTrip) {
    return (
      <div className="min-h-dvh bg-slate-50/50">
        <TripListView
          trips={trips}
          onSelectTrip={(id) => {
            setCurrentTripId(id)
            const sel = trips.find((t) => t.id === id)
            if (sel?.tripType === 'overseas') {
              if (mapMode === 'naver') setMapMode('google')
            } else {
              if (mapMode === 'google') setMapMode('naver')
            }
            setActiveTab('packing') // 상세 클릭 시 첫번째 탭인 '체크리스트'
            setDay(1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onCreateTrip={handleCreateTrip}
          onDeleteTrip={handleDeleteTrip}
        />
      </div>
    )
  }

  // ========================================================
  // 화면 2: 여행 플랜 상세 페이지
  // 탭 구성: 1. 여행 준비물 / 2. 여행일정 & 지도 / 3. 가계부 & 정산
  // ========================================================
  return (
    <div className="min-h-dvh bg-slate-50/50 pb-24">
      {/* ===== 상단 네비게이션 헤더 (은은하고 깔끔한 모던 라이트 톤) ===== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md text-slate-800 border-b border-slate-200/80 shadow-xs">
        <div className="mx-auto max-w-[1700px] w-full px-4 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 여행 플랜 목록으로 돌아가기 버튼 */}
            <button
              onClick={() => setCurrentTripId(null)}
              className="flex shrink-0 items-center gap-1 rounded-2xl bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200/80 transition active:scale-95"
              title="여행 플랜 목록으로 이동"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">플랜 목록</span>
            </button>

            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 ring-1 ring-slate-200 text-lg shadow-xs">
              {currentTrip.coverEmoji || '✈️'}
            </span>

            <div className="min-w-[130px] max-w-[200px] sm:max-w-[260px] shrink">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  TRIP NOTE
                </p>
                {(() => {
                  const status = getTripStatus(currentTrip)
                  const StatusIcon = status.icon
                  return (
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-black shadow-xs ${status.className}`}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {status.label}
                    </span>
                  )
                })()}
              </div>
              <h1 className="truncate text-base sm:text-lg font-black leading-tight text-slate-900 select-none">
                {tripTitle}
              </h1>
            </div>

            {/* 여행 날짜(몇일부터 몇일까지, 몇박몇일), 총 몇명, 몇곳에 들리는지 (클릭 시 수정) */}
            <button
              type="button"
              onClick={() => setEditTripModalOpen(true)}
              className="group hidden lg:flex items-center gap-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 px-3.5 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200/70 transition active:scale-95 text-left mx-auto"
              title="클릭하여 여행 날짜, 기간, 인원 수정"
            >
              {/* 몇일부터 몇일까지 & 몇박몇일 */}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-indigo-900 leading-tight">
                    {tripPeriod.fullPeriod}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {tripPeriod.nightDay}
                  </p>
                </div>
              </div>

              <span className="h-6 w-px bg-slate-200" />

              {/* 총 몇명이 가는지 */}
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-sky-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-slate-800 leading-tight">
                    총 {headcount}명
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    동행인원
                  </p>
                </div>
              </div>

              <span className="h-6 w-px bg-slate-200" />

              {/* 몇곳에 들리는지 */}
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                <div>
                  <p className="font-extrabold text-slate-800 leading-tight">
                    방문지 {mapPointsCount}곳
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {items.length}개 일정
                  </p>
                </div>
              </div>

              <span className="ml-1 rounded-lg bg-slate-200/60 p-1 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800 transition">
                <Pencil className="h-3 w-3" />
              </span>
            </button>

            {/* 총 지출 뱃지 */}
            <div
              className="shrink-0 rounded-2xl bg-slate-50 px-3 py-1.5 text-right ring-1 ring-slate-200/70"
              aria-live="polite"
            >
              <p className="flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-500">
                <Wallet className="h-3 w-3 text-slate-400" /> 총 지출
              </p>
              <p key={total} className="animate-fade text-sm sm:text-[15px] font-black text-indigo-600 tabular-nums">
                {won(total)}
              </p>
            </div>
          </div>

          {/* lg 미만 화면용 여행 정보 요약 바 (클릭 시 수정) */}
          <button
            type="button"
            onClick={() => setEditTripModalOpen(true)}
            className="lg:hidden mt-2 flex w-full items-center justify-between gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 active:scale-[0.99] text-left transition"
            title="클릭하여 여행 정보 수정"
          >
            <div className="flex items-center gap-1 text-indigo-900 truncate">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">{tripPeriod.shortPeriod}</span>
              <span className="text-[11px] text-slate-500 font-semibold">({tripPeriod.nightDay})</span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 text-[11px]">
              <span className="flex items-center gap-1 text-sky-700">
                <Users className="h-3.5 w-3.5" /> {headcount}명
              </span>
              <span className="flex items-center gap-1 text-rose-600">
                <MapPin className="h-3.5 w-3.5" /> {mapPointsCount}곳
              </span>
              <Pencil className="h-3 w-3 text-slate-400" />
            </div>
          </button>

          {/* 탭 네비게이션: 1. 체크리스트 (첫번째 탭) / 2. 여행일정 & 지도 / 3. 가계부 & 정산 */}
          <nav className="mt-3 grid grid-cols-3 gap-1 rounded-t-2xl bg-slate-100/70 p-1 pb-0" aria-label="상세 탭 전환">
            {[
              { k: 'packing', label: '체크리스트', icon: Luggage },
              { k: 'schedule_map', label: '여행일정 & 지도', icon: Route },
              { k: 'budget', label: '가계부 & 정산', icon: Calculator },
            ].map(({ k, label, icon: Icon }) => (
              <button
                key={k}
                id={`tab-${k}`}
                onClick={() => setActiveTab(k)}
                aria-current={activeTab === k ? 'page' : undefined}
                className={`flex items-center justify-center gap-1.5 rounded-t-xl py-2.5 text-xs sm:text-sm font-bold transition ${
                  activeTab === k
                    ? 'bg-white text-indigo-600 shadow-xs border-b-2 border-indigo-600 font-black'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ===== 메인 컨텐츠 영역 ===== */}
      <main className="mx-auto max-w-[1700px] w-full px-3 pt-4 sm:px-6 lg:px-8">
        {/* ---------------------------------------------------- */}
        {/* 탭 1. 여행 준비물 (첫번째 탭: 체크박스 및 준비물 추가) */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'packing' && (
          <PackingListView
            packingList={packingList}
            onUpdatePackingList={handleUpdatePackingList}
          />
        )}

        {/* ---------------------------------------------------- */}
        {/* 탭 2. 여행일정 & 지도 (실시간 코스 지도 + 일정 타임라인) */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'schedule_map' && (
          <>
            {/* Day 선택 탭 바 */}
            <div className="mb-3 flex items-center gap-2">
              <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-1" role="tablist">
                {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
                  const on = d === day
                  return (
                    <button
                      key={d}
                      id={`day-tab-${d}`}
                      role="tab"
                      aria-selected={on}
                      onClick={() => changeDay(d)}
                      className={`shrink-0 rounded-2xl px-4 py-2 text-left transition-all active:scale-95 ${
                        on
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25 ring-2 ring-indigo-400/40'
                          : 'bg-white text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-sm font-extrabold">{d}일차</span>
                        <span className={`text-[10px] font-medium ${on ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {dayLabel(d)}
                        </span>
                      </span>
                      <span
                        className={`block text-xs font-bold tabular-nums ${
                          on ? 'text-amber-200' : 'text-slate-500'
                        }`}
                      >
                        {won(dayTotals[d])}
                      </span>
                    </button>
                  )
                })}

              </div>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr] xl:grid-cols-[1.55fr_1fr]">
              {/* 섹션 1: 지도 & 대체 일정(플랜 B) */}
              <div ref={mapRef} className="lg:sticky lg:top-[132px] space-y-4">
                <Collapsible
                  id="section-map"
                  title="실시간 코스 지도"
                  icon={Route}
                  summary={`지도 표시 ${mapPoints.length}곳${
                    selected?.showOnMap ? ` · #${mapIndex[selected.id]} ${selected.title}` : ''
                  }`}
                >
                  {/* [요청사항] 지도 표시 필터 (1일차만, 2일차 같이, 3일차 같이 선택 + 일차별 고유 색상) */}
                  <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2.5 sm:px-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-extrabold text-slate-600 mr-1 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-indigo-600" /> 지도 일차 표시:
                      </span>

                      {/* 오늘만 표시 */}
                      <button
                        type="button"
                        id="map-filter-current"
                        onClick={() => handleToggleMapDay('current')}
                        className={`rounded-xl px-2.5 py-1 text-xs font-extrabold transition active:scale-95 ${
                          mapFilterDays.includes('current')
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        오늘
                      </button>

                      {/* 전체 일차 한 번에 표시 */}
                      <button
                        type="button"
                        id="map-filter-all"
                        onClick={() => handleToggleMapDay('all')}
                        className={`rounded-xl px-2.5 py-1 text-xs font-extrabold transition active:scale-95 ${
                          mapFilterDays.includes('all')
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        전체 일차
                      </button>

                      <span className="h-3.5 w-px bg-slate-300 mx-1 hidden sm:inline-block" />

                      {/* 1일차 ~ n일차 개별 / 다중 선택 (일차별 색상 뱃지 탑재) */}
                      {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
                        const isSelected =
                          mapFilterDays.includes(d) ||
                          (mapFilterDays.includes('current') && d === day) ||
                          mapFilterDays.includes('all')
                        const isDirectChecked = mapFilterDays.includes(d)
                        const color = getDayColor(d)

                        return (
                          <button
                            key={d}
                            type="button"
                            id={`map-filter-day-${d}`}
                            onClick={() => handleToggleMapDay(d)}
                            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                              isDirectChecked
                                ? 'bg-white text-slate-900 shadow-sm ring-2 ring-indigo-500 font-black'
                                : isSelected
                                ? 'bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-200'
                                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                            }`}
                            title={`${d}일차 코스를 지도에 함께 표시합니다`}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            />
                            <span>{d}일차</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <MapView
                    points={mapPoints}
                    selectedId={selectedId}
                    onSelect={select}
                    tripType={currentTrip?.tripType || 'domestic'}
                  />
                </Collapsible>

                {/* [요청사항] 일정 타임라인에서 일정 클릭 시 지도 아래쪽에 대체 일정 등록/관리 */}
                <Collapsible
                  id="section-alternative-schedules"
                  title={
                    selectedMainItem
                      ? `대체 일정 (플랜 B) · #${selectedMainIndex} ${selectedMainItem.title}`
                      : '대체 일정 (플랜 B)'
                  }
                  icon={Sparkles}
                  summary={
                    selectedMainItem
                      ? `대체 후보 ${currentAltSchedules.length}곳`
                      : '일정을 클릭하여 플랜 B 등록'
                  }
                  actions={
                    selectedMainItem && (
                      <button
                        type="button"
                        id="open-add-alternative"
                        onClick={() => handleOpenAddAlternative(selectedMainItem)}
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>대체일정 등록</span>
                      </button>
                    )
                  }
                >
                  <div className="p-3.5 sm:p-4">
                    {!selectedMainItem ? (
                      <div className="rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">
                        👉 우측 일정 타임라인에서 일정을 클릭하면 해당 장소의 대체 후보(플랜 B)를 등록하고 관리할 수 있습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* 대체 일정 목록 및 드롭 존 */}
                        {currentAltSchedules.length === 0 ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              setAltSectionDragOver(true)
                            }}
                            onDragLeave={() => setAltSectionDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fromId = e.dataTransfer.getData('text/plain')
                              handleDropToAltSection(fromId)
                            }}
                            className={`rounded-2xl border-2 border-dashed p-6 text-center text-xs transition ${
                              altSectionDragOver
                                ? 'border-amber-500 bg-amber-50 text-amber-900 ring-4 ring-amber-300/40'
                                : 'border-slate-200 bg-slate-50/70 text-slate-500'
                            }`}
                          >
                            <p className="font-bold text-slate-700">등록된 대체 일정이 없습니다.</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              우측 일정표의 일정을 여기로 드래그하여 드롭하거나, 상단의 '+ 대체일정 등록' 버튼을 눌러 추가하세요.
                            </p>
                          </div>
                        ) : (
                          <div
                            className={`space-y-2 rounded-2xl p-1 transition ${
                              altSectionDragOver ? 'bg-amber-50/50 ring-2 ring-dashed ring-amber-400' : ''
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault()
                              setAltSectionDragOver(true)
                            }}
                            onDragLeave={() => setAltSectionDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fromId = e.dataTransfer.getData('text/plain')
                              handleDropToAltSection(fromId)
                            }}
                          >
                            {currentAltSchedules.map((alt, altIdx) => {
                              const altNum = `${selectedMainIndex}-${altIdx + 1}`
                              const isOverThisCard = altCardDragOverId === alt.id
                              return (
                                <div
                                  key={alt.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move'
                                    e.dataTransfer.setData('text/plain', alt.id)
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (altCardDragOverId !== alt.id) setAltCardDragOverId(alt.id)
                                  }}
                                  onDragLeave={(e) => {
                                    e.stopPropagation()
                                    if (altCardDragOverId === alt.id) setAltCardDragOverId(null)
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    const fromId = e.dataTransfer.getData('text/plain')
                                    handleDropToAltSection(fromId, alt.id)
                                  }}
                                  className={`group relative flex flex-col gap-2 rounded-2xl border-2 border-dashed bg-white p-3 shadow-xs transition cursor-grab active:cursor-grabbing ${
                                    isOverThisCard
                                      ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-300/60 scale-[1.01]'
                                      : 'border-amber-300 hover:border-amber-400 hover:shadow-md'
                                  }`}
                                >
                                  {isOverThisCard && (
                                    <div className="rounded-lg bg-amber-500 py-0.5 text-center text-[10px] font-black text-white shadow-xs">
                                      ⇄ 마우스를 놓으면 이 대체일정과 자리를 맞바꿉니다
                                    </div>
                                  )}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="shrink-0 rounded-xl bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800 ring-1 ring-amber-300">
                                        대체 {altNum}
                                      </span>
                                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                        {alt.category || '기타'}
                                      </span>
                                      <h4 className="truncate text-sm font-extrabold text-slate-900">
                                        {alt.title}
                                      </h4>
                                    </div>

                                    {/* 조작 버튼 그룹 */}
                                    <div className="flex shrink-0 items-center gap-1">
                                      {/* 원클릭 자리바꾸기(스왑) 버튼 */}
                                      <button
                                        type="button"
                                        onClick={() => swapMainAndAlt(selectedMainItem.id, alt.id)}
                                        className="flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition active:scale-95"
                                        title="본 일정과 자리를 맞바꿉니다 (시간과 순번 유지)"
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                        <span>본 일정과 맞바꾸기</span>
                                      </button>

                                      {/* 본 일정으로 승격(추가) 버튼 */}
                                      <button
                                        type="button"
                                        onClick={() => promoteAltToMain(alt.id)}
                                        className="flex items-center gap-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 transition active:scale-95"
                                        title="본 일정 목록에 정식 일정으로 등록합니다"
                                      >
                                        <ArrowUpRight className="h-3 w-3" />
                                        <span className="hidden sm:inline">본일정 등록</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(alt)}
                                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                                        title="수정"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => deleteItem(alt.id)}
                                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                        title="삭제"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* 메모 및 지출액 */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs text-slate-500">
                                    <div className="truncate max-w-[260px] text-[11px] text-slate-600">
                                      {alt.note || alt.address || '메모 없음'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {alt.expense > 0 && (
                                        <span className="font-extrabold text-slate-700">
                                          예상 {formatMoney(alt.expense, alt.currency || currentTrip?.currency || 'KRW')}
                                        </span>
                                      )}
                                      {/* 등록된 링크 버튼들 (최대 3개) */}
                                      {(() => {
                                        const altLinks = Array.isArray(alt.links) && alt.links.length > 0
                                          ? alt.links.filter((l) => l?.url)
                                          : alt.customNaverUrl
                                          ? [{ name: '상세보기', url: alt.customNaverUrl }]
                                          : []

                                        return altLinks.map((lk, lkIdx) => (
                                          <a
                                            key={lkIdx}
                                            href={lk.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 transition"
                                            title={lk.url}
                                          >
                                            <ExternalLink className="h-2.5 w-2.5" />
                                            {lk.name || `링크 ${lkIdx + 1}`}
                                          </a>
                                        ))
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* 드롭 가이드 영역 */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault()
                            setAltSectionDragOver(true)
                          }}
                          onDragLeave={() => setAltSectionDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault()
                            const fromId = e.dataTransfer.getData('text/plain')
                            handleDropToAltSection(fromId)
                          }}
                          className={`rounded-xl border border-dashed py-2 px-3 text-center text-[11px] transition ${
                            altSectionDragOver
                              ? 'border-amber-500 bg-amber-100/70 text-amber-900 font-bold'
                              : 'border-slate-200 bg-slate-50/50 text-slate-400'
                          }`}
                        >
                          {altSectionDragOver
                            ? '📥 마우스를 놓으면 이 일정의 대체일정으로 등록됩니다'
                            : '⇄ 실제 일정과 대체일정을 서로 자유롭게 드래그하여 이동하거나 맞바꿀 수 있습니다.'}
                        </div>
                      </div>
                    )}
                  </div>
                </Collapsible>
              </div>

              {/* 섹션 2: 타임라인 */}
              <Collapsible
                id="section-timeline"
                title="일정 타임라인 & 가계부"
                icon={ListTodo}
                summary={`${dayItems.length}개 일정 · 합계 ${won(dayTotals[day])}`}
                actions={
                  <button
                    id="open-add"
                    onClick={() => handleOpenAdd(day)}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-700 active:scale-95"
                  >
                    <Plus className="h-4 w-4" /> 추가
                  </button>
                }
              >
                <div className="px-3 pb-3 pt-1">
                  {dayItems.length === 0 ? (
                    <button
                      onClick={() => handleOpenAdd(day)}
                      className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-10 text-sm font-semibold text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
                    >
                      + {day}일차 첫 일정을 추가해보세요
                    </button>
                  ) : (
                    <ol>
                      {dayItems.map((item, idx) => {
                        const nextItem = dayItems[idx + 1]
                        // 1번 일정과 2번 일정(다음 일정) 및 이동 시간 기반 체류 가능 시간 계산
                        const stayInfo = calculateStayInfo(item, nextItem)

                        return (
                          <Fragment key={item.id}>
                            {idx > 0 && (() => {
                              const prevWithCoord = [...dayItems.slice(0, idx)].reverse().find((x) => x.lat && x.lng)
                              const effectiveFrom = {
                                ...dayItems[idx - 1],
                                lat: dayItems[idx - 1].lat || prevWithCoord?.lat || 0,
                                lng: dayItems[idx - 1].lng || prevWithCoord?.lng || 0,
                              }
                              const nextWithCoord = dayItems.slice(idx).find((x) => x.lat && x.lng)
                              const effectiveTo = {
                                ...item,
                                lat: item.lat || nextWithCoord?.lat || 0,
                                lng: item.lng || nextWithCoord?.lng || 0,
                              }
                              return (
                                <TransitConnector
                                  fromItem={effectiveFrom}
                                  toItem={effectiveTo}
                                  tripType={currentTrip?.tripType || 'domestic'}
                                  onUpdateTransit={(transitMethod, transitDuration, isCustomDuration = false) => {
                                    updateItem(item.id, { transitMethod, transitDuration, isCustomDuration })
                                  }}
                                />
                              )
                            })()}
                            <ScheduleCard
                              item={item}
                              mapIndex={mapIndex[item.id]}
                              selected={item.id === selectedId}
                              isFirst={idx === 0}
                              isLast={idx === dayItems.length - 1}
                              isDragging={drag.id === item.id}
                              isDragOver={drag.over === item.id && drag.id !== item.id}
                              onSelect={selectFromCard}
                              onUpdate={updateItem}
                              onDelete={deleteItem}
                              onMove={move}
                              onToggleMap={toggleMap}
                              dragHandlers={dragHandlers(item.id, idx)}
                              tripCurrency={currentTrip?.currency || 'KRW'}
                              onEdit={handleOpenEdit}
                              stayInfo={stayInfo}
                            />
                          </Fragment>
                        )
                      })}
                    </ol>
                  )}
                  <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-slate-400">
                    <span>☰ 드래그 또는 ▲▼ 버튼으로 순서 변경 · 지도 번호 자동 갱신</span>
                  </div>
                </div>
              </Collapsible>
            </div>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* 탭 3. 가계부 & 정산 (총지출 요약, 컬러바 금액, 1/N 정산, 일차 다중선택 필터, 상세내역) */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'budget' && (
          <BudgetView
            items={items.filter((i) => i.day <= dayCount && !i.isAlternative)}
            dayCount={dayCount}
            headcount={headcount}
            dayLabel={dayLabel}
            tripTitle={tripTitle}
            tripType={currentTrip?.tripType || 'domestic'}
            tripCurrency={currentTrip?.currency || 'KRW'}
            exchangedAmount={currentTrip?.exchangedAmount || 0}
            onUpdateTrip={(patch) => updateCurrentTrip(patch)}
            isSettled={Boolean(currentTrip?.isSettled)}
            settlementData={currentTrip?.settlementData}
            onSaveSettlement={(data) => updateCurrentTrip({ isSettled: true, settlementData: data })}
            onClearSettlement={() => updateCurrentTrip({ isSettled: false, settlementData: null })}
            isCollected={Boolean(currentTrip?.isCollected)}
            collectionData={currentTrip?.collectionData}
            onSaveCollection={(data) => updateCurrentTrip({ isCollected: true, collectionData: data })}
            onClearCollection={() => updateCurrentTrip({ isCollected: false, collectionData: null })}
          />
        )}

        {/* 모바일 FAB (일정 추가) - 일정&지도 탭에서만 표시 */}
        {activeTab === 'schedule_map' && (
          <button
            id="fab-add"
            onClick={() => handleOpenAdd(day)}
            aria-label="새 일정 추가"
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 transition hover:scale-105 active:scale-95 lg:hidden"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </main>

      {/* 일정 추가 / 편집 모달 */}
      <AddScheduleModal
        open={adding}
        onClose={() => {
          setAdding(false)
          setEditingItem(null)
        }}
        onAdd={addItem}
        onUpdate={updateItem}
        initialData={editingItem}
        defaultDay={addDefaultDay}
        dayCount={dayCount}
        defaultCoord={defaultCoord}
        dayLabel={dayLabel}
        tripType={currentTrip?.tripType || 'domestic'}
        tripCurrency={currentTrip?.currency || 'KRW'}
      />

      {/* 여행 정보 수정 모달 */}
      <EditTripModal
        open={editTripModalOpen}
        onClose={() => setEditTripModalOpen(false)}
        trip={currentTrip}
        onSave={(patch) => updateCurrentTrip(patch)}
      />
    </div>
  )
}
