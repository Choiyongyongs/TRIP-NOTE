import { useState, useMemo, Fragment } from 'react'
import {
  CalendarDays,
  Plus,
  MapPin,
  Wallet,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { won } from '../data'
import ScheduleCard from './ScheduleCard'
import TransitConnector from './TransitConnector'

export default function ScheduleListView({
  items,
  dayCount,
  dayLabel,
  dayTotals,
  total,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onMove,
  onToggleMap,
  onOpenAdd,
  onResetSample,
  onGoToMap,
  onEdit,
  tripType = 'domestic',
}) {
  // 'all' 또는 특정 Day 번호 (1, 2, 3...)
  const [filterDay, setFilterDay] = useState('all')
  const [drag, setDrag] = useState({ id: null, over: null })

  // 필터링 적용된 목록
  const displayedDays = useMemo(() => {
    if (filterDay === 'all') {
      return Array.from({ length: dayCount }, (_, i) => i + 1)
    }
    return [Number(filterDay)]
  }, [filterDay, dayCount])

  // 전체 지도 포인트 매핑 (전체 인덱스 부여)
  const mapPoints = useMemo(() => items.filter((i) => i.showOnMap), [items])
  const mapIndex = useMemo(() => Object.fromEntries(mapPoints.map((p, i) => [p.id, i + 1])), [mapPoints])

  // 드래그 앤 드롭 핸들러
  const dragHandlers = (id, targetDay, index) => ({
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
      const fromId = e.dataTransfer.getData('text/plain') || drag.id
      onMove(fromId, index, targetDay)
      setDrag({ id: null, over: null })
    },
    onDragEnd: () => setDrag({ id: null, over: null }),
  })

  return (
    <div className="space-y-4">
      {/* ===== 상단 통계 & 요약 카드 ===== */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CalendarDays className="h-4 w-4 text-indigo-500" /> 총 여행 기간
          </p>
          <p className="mt-1 text-lg font-black text-slate-800">
            {dayCount - 1 > 0 ? `${dayCount - 1}박 ${dayCount}일` : `당일치기 (${dayCount}일)`}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 총 일정 개수
          </p>
          <p className="mt-1 text-lg font-black text-slate-800">{items.length}개 장소/일정</p>
        </div>

        <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <MapPin className="h-4 w-4 text-rose-500" /> 코스 지도 방문지
          </p>
          <p className="mt-1 text-lg font-black text-slate-800">{mapPoints.length}곳 방문</p>
        </div>

        <div className="rounded-2xl bg-indigo-50/80 p-3.5 shadow-xs ring-1 ring-indigo-200/70">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
            <Wallet className="h-4 w-4 text-indigo-600" /> 전체 예산/지출
          </p>
          <p className="mt-1 text-lg font-black text-indigo-950 tabular-nums">{won(total)}</p>
        </div>
      </section>

      {/* ===== 일차별 필터 바 & 일정 추가 버튼 ===== */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            onClick={() => setFilterDay('all')}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
              filterDay === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 일정 보기
          </button>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDay(d)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterDay === d
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Day {d} <span className="text-[10px] font-medium opacity-80">({dayLabel(d)})</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onOpenAdd(typeof filterDay === 'number' ? filterDay : 1)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> 새 일정 추가
        </button>
      </div>

      {/* ===== 일차별 일정 목록 섹션들 ===== */}
      <div className="space-y-6">
        {displayedDays.map((d) => {
          const currentDayItems = items.filter((i) => i.day === d)
          const dayExpense = dayTotals[d] || 0

          return (
            <div key={d} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/90 sm:p-5">
              {/* 일차 헤더 */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-xs">
                    D{d}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900">Day {d} 일정</h2>
                      <span className="text-xs font-semibold text-indigo-600">{dayLabel(d)}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      총 {currentDayItems.length}개 일정 · 지출 합계{' '}
                      <span className="font-bold text-slate-700">{won(dayExpense)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onGoToMap(d)}
                    className="flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Day {d} 지도 코스 보기
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => onOpenAdd(d)}
                    className="flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" /> 일정 추가
                  </button>
                </div>
              </div>

              {/* 일정 목록 */}
              {currentDayItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-slate-400">등록된 일정이 없습니다.</p>
                  <button
                    onClick={() => onOpenAdd(d)}
                    className="mt-2 text-xs font-bold text-indigo-600 underline hover:text-indigo-700"
                  >
                    + Day {d}의 첫 일정을 추가해보세요
                  </button>
                </div>
              ) : (
                <ol className="pt-1">
                  {currentDayItems.map((item, idx) => (
                    <Fragment key={item.id}>
                      {idx > 0 && (() => {
                        const prevWithCoord = [...currentDayItems.slice(0, idx)].reverse().find((x) => x.lat && x.lng)
                        const effectiveFrom = {
                          ...currentDayItems[idx - 1],
                          lat: currentDayItems[idx - 1].lat || prevWithCoord?.lat || 0,
                          lng: currentDayItems[idx - 1].lng || prevWithCoord?.lng || 0,
                        }
                        const nextWithCoord = currentDayItems.slice(idx).find((x) => x.lat && x.lng)
                        const effectiveTo = {
                          ...item,
                          lat: item.lat || nextWithCoord?.lat || 0,
                          lng: item.lng || nextWithCoord?.lng || 0,
                        }
                        return (
                          <TransitConnector
                            fromItem={effectiveFrom}
                            toItem={effectiveTo}
                            tripType={tripType}
                            onUpdateTransit={(transitMethod, transitDuration, isCustomDuration = false) => {
                              onUpdate(item.id, { transitMethod, transitDuration, isCustomDuration })
                            }}
                          />
                        )
                      })()}
                      <ScheduleCard
                        item={item}
                        mapIndex={mapIndex[item.id]}
                        selected={item.id === selectedId}
                        isFirst={idx === 0}
                        isLast={idx === currentDayItems.length - 1}
                        isDragging={drag.id === item.id}
                        isDragOver={drag.over === item.id && drag.id !== item.id}
                        onSelect={(id) => onSelect(id)}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onMove={(id, dir) => {
                          const curIdx = currentDayItems.findIndex((x) => x.id === id)
                          onMove(id, curIdx + dir, d)
                        }}
                        onToggleMap={onToggleMap}
                        dragHandlers={dragHandlers(item.id, d, idx)}
                        onEdit={onEdit}
                      />
                    </Fragment>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
      </div>

      {/* 하단 툴바 / 초기화 안내 */}
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-xs text-slate-400 shadow-sm ring-1 ring-slate-200">
        <span>💡 일정 카드를 드래그하거나 ▲▼ 버튼을 눌러 순서를 자유롭게 조정할 수 있습니다.</span>
        <button
          onClick={onResetSample}
          className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 hover:text-slate-600"
        >
          <RotateCcw className="h-3.5 w-3.5" /> 샘플 데이터 초기화
        </button>
      </div>
    </div>
  )
}
