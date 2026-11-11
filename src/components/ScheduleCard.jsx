import { useState } from 'react'
import {
  GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Pencil, StickyNote, Clock, MapPin, MapPinOff, ExternalLink, Ban, Check,
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

  const handleToggleDeductFrom = (targetType, e) => {
    e.stopPropagation()
    const nextDeduct = item.deductFrom === targetType ? null : targetType
    if (isEditingActual) {
      const val = actualDraft.trim() === '' ? null : Math.max(0, Number(actualDraft) || 0)
      onUpdate(item.id, { deductFrom: nextDeduct, actualExpense: val })
    } else {
      onUpdate(item.id, { deductFrom: nextDeduct })
    }
  }

  const iconBtn =
    'grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 disabled:opacity-30 disabled:pointer-events-none'

  return (
    <li
      className="relative flex gap-3"
      draggable
      {...dragHandlers}
    >
      {/* 타임라인 거터 */}
      <div className={`relative flex w-8 shrink-0 flex-col items-center ${item.isSkipped ? 'opacity-45' : ''}`}>
        {!isFirst && <span className="absolute top-0 h-4 w-0.5 bg-slate-200" />}
        {!isLast && <span className="absolute bottom-0 top-4 w-0.5 bg-slate-200" />}
        {item.showOnMap ? (
          <span
            className={`relative z-[1] mt-3 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white shadow-sm ring-4 ring-white transition-all ${
              item.isSkipped ? 'bg-slate-400' : selected ? 'scale-110 bg-rose-600 shadow-rose-500/30' : 'bg-indigo-600'
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
        } ${isDragOver ? 'ring-2 ring-indigo-500 bg-indigo-50/30 shadow-md' : ''} ${
          !item.showOnMap ? 'bg-slate-50/70' : ''
        } ${item.isSkipped ? 'opacity-55 bg-slate-50/90' : ''}`}
      >
        {isDragOver && (
          <div className="bg-indigo-600 py-1 text-center text-[11px] font-black text-white shadow-xs">
            ⇄ 마우스를 놓으면 이 장소와 순서를 맞바꿉니다
          </div>
        )}
        <div className="flex">
          {/* 왼쪽: 일정 정보 */}
          <div
            id={`card-select-${item.id}`}
            onClick={() => onSelect(item.id)}
            className="min-w-0 flex-1 p-3 text-left cursor-pointer active:bg-slate-50/80 transition"
          >
            {/* 1) 시간 옆에 물결(~)로 체류 가능 시간 연결 및 카테고리 띄워주고 (모바일 최적화 배치) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                {stayInfo ? (
                  <span className="inline-flex items-center gap-1">
                    <strong className="text-slate-900">{item.time || '--:--'}</strong>
                    <span className="text-indigo-400 font-black">~</span>
                    <strong className="text-indigo-600">{stayInfo.untilTime}</strong>
                    {/* PC에서는 시간 바로 옆에 체류/부족 안내 표시 */}
                    <span
                      className={`hidden sm:inline text-[11px] font-semibold ${
                        stayInfo.isShort ? 'text-rose-500 font-bold' : 'text-indigo-500'
                      }`}
                    >
                      ({stayInfo.isShort ? stayInfo.stayDurationText : `${stayInfo.stayDurationText} 체류`})
                    </span>
                  </span>
                ) : (
                  <span>{item.time || '--:--'}</span>
                )}
              </span>

              {/* 카테고리 뱃지: 모바일에서는 시간 바로 옆(기존 부족자리)에 배치 */}
              <CategoryBadge category={item.category} />

              {item.isSkipped && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 ring-1 ring-rose-200">
                  건너뜀
                </span>
              )}
              {!item.showOnMap && (
                <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  지도 미표시
                </span>
              )}
            </div>

            {/* 모바일 전용: 시간 아래 줄에 체류/이동시간부족 안내 독립 배치 */}
            {stayInfo && (
              <div className="sm:hidden mt-0.5">
                <span
                  className={`inline-block text-[10px] font-bold ${
                    stayInfo.isShort
                      ? 'text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded ring-1 ring-rose-200'
                      : 'text-indigo-500'
                  }`}
                >
                  {stayInfo.isShort ? stayInfo.stayDurationText : `${stayInfo.stayDurationText} 체류 가능`}
                </span>
              </div>
            )}

            {/* 2) 밑에 일정제목 띄워주고 (건너뜀 시 취소선 처리) */}
            <p
              className={`mt-1.5 text-[15px] font-bold leading-snug ${
                item.isSkipped
                  ? 'line-through decoration-slate-500 decoration-2 text-slate-400'
                  : item.showOnMap
                  ? 'text-slate-900'
                  : 'text-slate-600'
              }`}
            >
              {item.title}
            </p>
            {item.placeName && item.placeName !== item.title && (
              <p
                className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${
                  item.isSkipped ? 'line-through text-slate-400' : 'text-indigo-600'
                }`}
              >
                <MapPin className={`h-3 w-3 shrink-0 ${item.isSkipped ? 'text-slate-400' : 'text-indigo-500'}`} />
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

          {/* 오른쪽: 맨위에 실제 지출액(클릭 시 바로 입력), 그 바로 아래 예상 지출액 + 회비/환전 차감 체크 */}
          <div className="w-[106px] sm:w-[144px] shrink-0 border-l border-dashed border-slate-200 px-2 py-2 sm:p-3 flex flex-col justify-between text-right bg-slate-50/40">
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
                    className="w-14 sm:w-20 rounded-lg border-0 bg-white px-1.5 sm:px-2 py-1 text-right text-xs font-extrabold text-indigo-700 ring-2 ring-indigo-500 focus:outline-none shadow-sm"
                  />
                  <span className="text-[11px] sm:text-xs font-bold text-indigo-600">
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
                  className="group mt-0.5 inline-flex items-center gap-0.5 sm:gap-1 rounded-md px-0.5 sm:px-1 py-0.5 transition hover:bg-indigo-100/70 active:scale-95"
                  title="클릭하여 실제 지출액 바로 입력"
                >
                  <span
                    className={`text-xs sm:text-sm tabular-nums ${
                      item.actualExpense !== undefined && item.actualExpense !== null && item.actualExpense !== ''
                        ? 'font-extrabold text-indigo-600'
                        : 'text-slate-400 font-medium underline decoration-dashed underline-offset-2'
                    }`}
                  >
                    {item.actualExpense !== undefined && item.actualExpense !== null && item.actualExpense !== ''
                      ? formatMoney(Number(item.actualExpense), item.currency || tripCurrency)
                      : '입력하기'}
                  </span>
                  <Pencil className="h-2.5 w-2.5 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                </button>
              )}
            </div>

            {/* 그 바로 아래: 예상 지출액 */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-200/70">
              <span className="text-[10px] font-medium text-slate-400 block">예상 지출액</span>
              <p className="text-[11px] sm:text-xs font-bold text-slate-600 tabular-nums truncate">
                {formatMoney(item.expense || 0, item.currency || tripCurrency)}
              </p>
            </div>

            {/* 회비 / 환전 차감 선택 체크 버튼 (미체크 시 일반 지출) */}
            <div
              className="mt-1.5 pt-1.5 border-t border-slate-200/70 grid grid-cols-2 gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleToggleDeductFrom('fee', e)}
                className={`flex items-center justify-center gap-0.5 rounded-md py-1 px-1 text-[10px] sm:text-[11px] font-extrabold transition active:scale-95 ${
                  item.deductFrom === 'fee'
                    ? 'bg-emerald-600 text-white ring-1 ring-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
                title="체크 시 가계부 탭의 회비 잔액에서 이 지출을 차감합니다 (다시 누르면 해제)"
              >
                {item.deductFrom === 'fee' && <Check className="h-2.5 w-2.5 shrink-0 stroke-[3]" />}
                <span className=" whitespace-nowrap">회비</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleToggleDeductFrom('exchange', e)}
                className={`flex items-center justify-center gap-0.5 rounded-md py-1 px-1 text-[10px] sm:text-[11px] font-extrabold transition active:scale-95 ${
                  item.deductFrom === 'exchange'
                    ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-500 shadow-2xs'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-amber-50 hover:text-amber-700'
                }`}
                title="체크 시 가계부 탭의 환전한 금액에서 이 지출을 차감합니다 (다시 누르면 해제)"
              >
                {item.deductFrom === 'exchange' && <Check className="h-2.5 w-2.5 shrink-0 stroke-[3]" />}
                <span className="whitespace-nowrap">환전</span>
              </button>
            </div>
          </div>
        </div>

        {/* 하단 툴바:
            - 1열: 지도표시, (PC: 링크), 편집하기, 건너뜀, 화살표(▲▼), 삭제버튼
            - 2열(모바일 전용): 등록된 링크 버튼들 */}
        {(() => {
          const userLinks =
            Array.isArray(item.links) && item.links.length > 0
              ? item.links.filter((l) => l && l.url && l.url.trim())
              : item.customNaverUrl
              ? [{ name: '상세보기', url: item.customNaverUrl }]
              : []

          return (
            <div className="border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5">
                <span
                  className="hidden sm:grid h-8 w-7 cursor-grab place-items-center text-slate-300 active:cursor-grabbing"
                  title="드래그하여 순서 변경"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <button
                  id={`card-map-toggle-${item.id}`}
                  onClick={() => onToggleMap(item.id)}
                  className={`flex h-7 sm:h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition active:scale-95 ${
                    item.showOnMap ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title={item.showOnMap ? '지도에서 숨기기' : '지도에 표시하기'}
                >
                  {item.showOnMap ? <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  {item.showOnMap ? '지도 표시' : '숨김'}
                </button>

                {/* PC 화면(sm 이상)에서만 1열에 링크 표시 */}
                {userLinks.length > 0 && (
                  <div className="hidden sm:flex flex-wrap items-center gap-1">
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
                )}

                {/* 편집하기 버튼 */}
                <button
                  type="button"
                  onClick={() => onEdit?.(item)}
                  className="flex h-7 sm:h-8 shrink-0 items-center gap-1 rounded-lg px-2 sm:px-2.5 text-[11px] font-bold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 hover:text-indigo-700 transition active:scale-95 shadow-xs"
                  title="일정 상세 편집"
                >
                  <Pencil className="h-3 w-3 text-indigo-500" />
                  <span>편집하기</span>
                </button>

                {/* 실행하지 않은 일정 체크용 '건너뜀' 버튼 */}
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { isSkipped: !item.isSkipped })}
                  className={`flex h-7 sm:h-8 shrink-0 items-center gap-1 rounded-lg px-2 sm:px-2.5 text-[11px] font-bold transition active:scale-95 shadow-xs ${
                    item.isSkipped
                      ? 'bg-rose-600 text-white hover:bg-rose-700 ring-1 ring-rose-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                  title={item.isSkipped ? '건너뜀 취소 (다시 방문 일정으로 변경)' : '실행하지 않은 일정(건너뜀)으로 체크'}
                >
                  <Ban className="h-3 w-3 shrink-0" />
                  <span>{item.isSkipped ? '건너뜀 ✓' : '건너뜀'}</span>
                </button>

                <div className="ml-auto flex shrink-0 items-center">
                  <button
                    aria-label="위로 이동"
                    className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                    disabled={isFirst}
                    onClick={() => onMove(item.id, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="아래로 이동"
                    className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                    disabled={isLast}
                    onClick={() => onMove(item.id, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="삭제"
                    className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg text-slate-400 transition hover:!bg-rose-50 hover:!text-rose-600 active:scale-90"
                    onClick={() => confirm(`'${item.title}' 일정을 삭제할까요?`) && onDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 모바일 전용(sm 미만): 2열에 링크 버튼들 표시 */}
              {userLinks.length > 0 && (
                <div className="flex sm:hidden flex-wrap items-center gap-1.5 border-t border-slate-100 px-2.5 py-1.5 bg-white/60">
                  {userLinks.map((link, lIdx) => (
                    <button
                      key={lIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(link.url.trim(), '_blank', 'noopener,noreferrer')
                      }}
                      className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-indigo-700 bg-indigo-50/80 ring-1 ring-indigo-200/70 hover:bg-indigo-100 transition active:scale-95"
                      title={`${link.name || '링크'} 새창 열기`}
                    >
                      <ExternalLink className="h-3 w-3 text-indigo-500" />
                      <span className="max-w-[140px] truncate">{link.name || `링크 ${lIdx + 1}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </li>
  )
}
