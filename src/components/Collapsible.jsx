import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/** 헤더 클릭으로 접고 펼치는 섹션 패널 */
export default function Collapsible({ id, title, icon: Icon, summary, actions, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2 pr-3">
        <button
          id={`${id}-toggle`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/80">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-slate-900">{title}</span>
            {summary && <span className="block truncate text-xs text-slate-500">{summary}</span>}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
        {actions}
      </div>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  )
}
