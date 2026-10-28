import { useRef } from 'react'
import { CalendarDays } from 'lucide-react'

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 날짜 문자열(YYYY-MM-DD)을 'YYYY.MM.DD (요일)' 형태로 포맷
 */
export const formatDateWithDay = (dateStr) => {
  if (!dateStr) return ''
  const dt = new Date(`${dateStr}T00:00:00`)
  if (isNaN(dt)) return dateStr
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const day = WEEK_DAYS[dt.getDay()]
  return `${y}.${m}.${d} (${day})`
}

/**
 * 브라우저의 날짜() 빈 괄호 버그를 방지하고 클릭 시 달력 팝업을 띄우며
 * 항상 '날짜 (요일)'로 예쁘게 표시해주는 커스텀 날짜 선택 컴포넌트
 */
export default function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  required = false,
  className = '',
  placeholder = '날짜 선택 (요일)',
}) {
  const inputRef = useRef(null)

  const formattedDisplay = value ? formatDateWithDay(value) : ''

  const handleClick = () => {
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker()
        } catch {
          inputRef.current.focus()
        }
      } else {
        inputRef.current.focus()
      }
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-center justify-between cursor-pointer rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100/80 hover:ring-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition select-none ${className}`}
    >
      {/* 화면에 표시되는 포맷된 날짜와 괄호 안 요일 */}
      <span className={formattedDisplay ? 'text-slate-900 font-extrabold text-[13px]' : 'text-slate-400 font-normal'}>
        {formattedDisplay || placeholder}
      </span>

      <CalendarDays className="h-4 w-4 text-indigo-500 shrink-0 ml-1.5" />

      {/* 실제 브라우저 달력 팝업을 띄우는 투명 네이티브 date input */}
      <input
        ref={inputRef}
        id={id}
        type="date"
        required={required}
        min={min}
        max={max}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
        tabIndex={0}
      />
    </div>
  )
}
