import { useState } from 'react'
import {
  GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Pencil, StickyNote, Clock, MapPin, MapPinOff, ExternalLink,
} from 'lucide-react'
import { CATEGORIES, formatMoney, getCurrency } from '../data'

export function CategoryBadge({ category, className = '' }) {
  const c = CATEGORIES[category] ?? CATEGORIES.etc
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${c.badge} ${className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}

/**
 * 세로 타임라인의 일정 카드
 * - 시간 옆에 카테고리
 * - 밑에 일정제목, 아래에 메모
 * - 오른쪽 맨 위: 실제 지출액 (클릭 시 바로 입력), 바로 아래: 예상 지출액
 * - 하단 툴바: 지도표시 옆 상세보기 버튼, [편집하기] 버튼
 */
export default function ScheduleCard({
  item,
  mapIndex,
  selected,
  isFirst,
  isLast,
  isDragOver,
  isDragging,
  onSelect,
  onUpdate,
  onDelete,
  onMove,
  onToggleMap,
  dragHandlers,
  tripCurrency = 'KRW',
  onEdit,
  stayInfo = null, // 다음 일정과 이동시간 기반 자동 계산된 체류 가능 정보
}) {
  const [isEditingActual, setIsEditingActual] = useState(false)
  const [actualDraft, setActualDraft] = useState('')

  const saveActual = () => {
    const val = actualDraft.trim() === '' ? null : Math.max(0, Number(actualDraft) || 0)
    onUpdate(item.id, { actualExpense: val })
    setIsEditingActual(false)
  }

  const iconBtn =
    'grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 disabled:opacity-30 disabled:pointer-events-none'

  return (
    <li
      className={`relative flex gap-3 transition-opacity ${isDragging ? 'opacity-40' : ''}`}
      draggable
      {...dragHandlers}
    >
      {/* 타임라인 거터 */}
      <div className="relative flex w-8 shrink-0 flex-col items-center">
        {!isFirst && <span className="absolute top-0 h-4 w-0.5 bg-slate-200" />}
        {!isLast && <span className="absolute bottom-0 top-4 w-0.5 bg-slate-200" />}
        {item.showOnMap ? (
          <span
            className={`relative z-[1] mt-3 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white shadow-sm ring-4 ring-white transition-all ${
              selected ? 'scale-110 bg-rose-600 shadow-rose-500/30' : 'bg-indigo-600'
            }`}
          >
            {mapIndex}
          </span>
        ) : (
          <span className="relative z-[1] mt-3 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-400 ring-4 ring-white" title="지도 미표시 일정">
            <MapPinOff className="h-4 w-4" />
          </span>
        )}
      </div>

      {/* 카드 */}
      <div
        className={`mb-3 min-w-0 flex-1 overflow-hidden rounded-2xl bg-white ring-1 transition-all ${
          selected ? 'shadow-lg shadow-rose-500/10 ring-2 ring-rose-400' : 'shadow-sm ring-slate-200 hover:ring-slate-300'
        } ${isDragOver ? 'translate-y-1 outline-2 outline-offset-2 outline-dashed outline-indigo-400' : ''} ${!item.showOnMap ? 'bg-slate-50/70' : ''}`}
      >
        <div className="flex">
          {/* 왼쪽: 일정 정보 */}
          <div
            id={`card-select-${item.id}`}
            onClick={() => onSelect(item.id)}
            className="min-w-0 flex-1 p-3 text-left cursor-pointer active:bg-slate-50/80 transition"
          >
            {/* 1) 시간 옆에 물결(~)로 체류 가능 시간 연결 및 카테고리 띄워주고 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                {stayInfo ? (
                  <span className="inline-flex items-center gap-1">
                    <strong className="text-slate-900">{item.time || '--:--'}</strong>
                    <span className="text-indigo-400 font-black">~</span>
                    <strong className="text-indigo-600">{stayInfo.untilTime}</strong>
                    <span className="text-[11px] text-indigo-500 font-semibold">
                      ({stayInfo.stayDurationText} 체류)
                    </span>
                  </span>
                ) : (
                  <span>{item.time || '--:--'}</span>
                )}
              </span>
              <CategoryBadge category={item.category} />
              {!item.showOnMap && (
                <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  지도 미표시
                </span>
              )}
            </div>

            {/* 2) 밑에 일정제목 띄워주고 */}
            <p className={`mt-1.5 text-[15px] font-bold leading-snug ${item.showOnMap ? 'text-slate-900' : 'text-slate-600'}`}>
              {item.title}
            </p>
            {item.placeName && item.placeName !== item.title && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                <MapPin className="h-3 w-3 shrink-0 text-indigo-500" />
                <span className="truncate">{item.placeName}</span>
              </p>
            )}

            {/* 3) 아래에 메모 띄워주고 */}
            {item.memo ? (
              <p className="mt-1.5 flex items-start gap-1 text-xs leading-relaxed text-slate-500">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="line-clamp-2">{item.memo}</span>
              </p>
            ) : null}
          </div>

          {/* 오른쪽: 맨위에 실제 지출액(클릭 시 바로 입력), 그 바로 아래 예상 지출액 */}
          <div className="w-[130px] sm:w-[145px] shrink-0 border-l border-dashed border-slate-200 p-2.5 sm:p-3 flex flex-col justify-between text-right bg-slate-50/40">
            {/* 맨 위: 실제 지출액 (클릭 시 바로 입력) */}
            <div>
              <span className="text-[10px] font-bold text-indigo-600 block">실제 지출액</span>
              {isEditingActual ? (
                <div className="mt-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={actualDraft}
                    onChange={(e) => setActualDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveActual()
                      if (e.key === 'Escape') setIsEditingActual(false)
                    }}
                    onBlur={saveActual}
                    placeholder="0"
                    className="w-20 rounded-lg border-0 bg-white px-2 py-1 text-right text-xs font-extrabold text-indigo-700 ring-2 ring-indigo-500 focus:outline-none shadow-sm"
                  />
                  <span className="text-xs font-bold text-indigo-600">
                    {getCurrency(item.currency || tripCurrency).unit}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActualDraft(item.actualExpense !== undefined && item.actualExpense !== null && item.actualExpense !== '' ? String(item.actualExpense) : '')
                    setIsEditingActual(true)
                  }}
                  className="group mt-0.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition hover:bg-indigo-100/70 active:scale-95"
                  title="클릭하여 실제 지출액 바로 입력"
                >
                  <span
                    className={`text-sm tabular-nums ${
                      item.actualExpense !== undefined && item.actualExpense !== null && item.actualExpense !== ''
                        ? 'font-extrabold text-indigo-600'
                        : 'text-slate-400 font-medium underline decoration-dashed underline-offset-2'
                    }`}
                  >
                    {item.actualExpense !== undefined && item.actualExpense !== null && item.actualExpense !== ''
                      ? formatMoney(Number(item.actualExpense), item.currency || tripCurrency)
                      : '입력하기'}
                  </span>
                  <Pencil className="h-2.5 w-2.5 text-slate-300 group-hover:text-indigo-500" />
                </button>
              )}
            </div>

            {/* 그 바로 아래: 예상 지출액 */}
            <div className="mt-2 pt-2 border-t border-slate-200/70">
              <span className="text-[10px] font-medium text-slate-400 block">예상 지출액</span>
              <p className="text-xs font-bold text-slate-600 tabular-nums">
                {formatMoney(item.expense || 0, item.currency || tripCurrency)}
              </p>
            </div>
          </div>
        </div>

        {/* 하단 툴바: 지도표시 옆 네이버지도/구글맵 링크 옆에 편집하기 배치 (카테고리 제거됨) */}
        <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1.5 bg-slate-50/50">
          <span className="grid h-8 w-7 cursor-grab place-items-center text-slate-300 active:cursor-grabbing" title="드래그하여 순서 변경">
            <GripVertical className="h-4 w-4" />
          </span>
          <button
            id={`card-map-toggle-${item.id}`}
            onClick={() => onToggleMap(item.id)}
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition active:scale-95 ${
              item.showOnMap ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={item.showOnMap ? '지도에서 숨기기' : '지도에 표시하기'}
          >
            {item.showOnMap ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {item.showOnMap ? '지도 표시' : '숨김'}
          </button>

          {/* 등록된 사용자 지정 링크 버튼들 (최대 3개) */}
          {(() => {
            const userLinks =
              Array.isArray(item.links) && item.links.length > 0
                ? item.links.filter((l) => l && l.url && l.url.trim())
                : item.customNaverUrl
                ? [{ name: '상세보기', url: item.customNaverUrl }]
                : []

            if (userLinks.length === 0) return null

            return (
              <div className="flex flex-wrap items-center gap-1">
                {userLinks.map((link, lIdx) => (
                  <button
                    key={lIdx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(link.url.trim(), '_blank', 'noopener,noreferrer')
                    }}
                    className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition active:scale-95 shadow-xs"
                    title={`${link.name || '링크'} 새창 열기`}
                  >
                    <ExternalLink className="h-3 w-3 text-slate-500" />
                    <span className="max-w-[100px] truncate">{link.name || `링크 ${lIdx + 1}`}</span>
                  </button>
                ))}
              </div>
            )
          })()}

          {/* 편집하기 버튼 */}
          <button
            type="button"
            onClick={() => onEdit?.(item)}
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 hover:text-indigo-700 transition active:scale-95 shadow-xs"
            title="일정 상세 편집"
          >
            <Pencil className="h-3 w-3 text-indigo-500" />
            <span>편집하기</span>
          </button>

          <div className="ml-auto flex items-center">
            <button aria-label="위로 이동" className={iconBtn} disabled={isFirst} onClick={() => onMove(item.id, -1)}>
              <ChevronUp className="h-4 w-4" />
            </button>
            <button aria-label="아래로 이동" className={iconBtn} disabled={isLast} onClick={() => onMove(item.id, 1)}>
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              aria-label="삭제"
              className={`${iconBtn} hover:!bg-rose-50 hover:!text-rose-600`}
              onClick={() => confirm(`'${item.title}' 일정을 삭제할까요?`) && onDelete(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
