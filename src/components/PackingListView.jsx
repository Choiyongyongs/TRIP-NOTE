import { useState, useMemo, useEffect } from 'react'
import {
  Check,
  Plus,
  Trash2,
  ListChecks,
  RotateCcw,
  Plane,
  MapPin,
  Sparkles,
  ShieldAlert,
  Shirt,
  Smartphone,
  Sparkle,
  Pill,
  Apple,
  Package,
  Compass,
  BookmarkPlus,
  FolderHeart,
  X,
  FileCheck,
} from 'lucide-react'
import {
  uid,
  PACKING_CATEGORIES,
  PACKING_CATEGORY_STYLES,
  DOMESTIC_PACKING_ITEMS,
  OVERSEAS_PACKING_ITEMS,
  OUTING_PACKING_ITEMS,
} from '../data'

// 카테고리별 아이콘 매핑
const CATEGORY_ICONS = {
  필수: ShieldAlert,
  의류: Shirt,
  전자기기: Smartphone,
  '세면/화장품': Sparkle,
  약: Pill,
  식품: Apple,
  기타: Package,
}

const CUSTOM_CHECKLISTS_KEY = 'tripnote_custom_checklists'

// 카테고리별 입력 가이드 예시 텍스트
const CATEGORY_PLACEHOLDERS = {
  필수: '신분증\n운전면허증\n지갑\n여권\n숙소 예약 확인증',
  의류: '외출복\n잠옷\n속옷\n양말\n외투\n모자',
  전자기기: '스마트폰 충전기\n보조배터리\n이어폰\n노트북/태블릿\n멀티탭',
  '세면/화장품': '칫솔\n치약\n스킨/로션\n선크림\n클렌징폼\n샴푸',
  약: '상비약\n소화제\n진통제\n대일밴드\n비타민',
  식품: '생수\n간식거리\n컵라면\n티백',
  기타: '우산\n물티슈\n비닐봉투\n선글라스\n목베개',
}

export default function PackingListView({ packingList = [], onUpdatePackingList }) {
  const [inputText, setInputText] = useState('')
  const [inputCategory, setInputCategory] = useState('필수')
  const [filter, setFilter] = useState('all') // 'all', 'active', 'completed'

  // 커스텀 체크리스트 상태
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_CHECKLISTS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // 커스텀 모달 상태
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createTemplateTitle, setCreateTemplateTitle] = useState('')
  const [createCategory, setCreateCategory] = useState('필수')
  // 카테고리별 각각의 항목 텍스트를 독립적으로 보관하는 상태
  const [categoryItems, setCategoryItems] = useState(() =>
    PACKING_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: '' }), {})
  )

  const openCreateModal = () => {
    setCreateTemplateTitle('')
    setCreateCategory('필수')
    setCategoryItems(PACKING_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: '' }), {}))
    setCreateModalOpen(true)
  }

  const handleCategoryTextChange = (cat, text) => {
    setCategoryItems((prev) => ({
      ...prev,
      [cat]: text,
    }))
  }

  const getCategoryCount = (cat) => {
    const text = categoryItems[cat] || ''
    return text.split('\n').map((l) => l.trim()).filter(Boolean).length
  }

  const totalCustomItemsCount = useMemo(() => {
    return PACKING_CATEGORIES.reduce((sum, cat) => sum + getCategoryCount(cat), 0)
  }, [categoryItems])

  // 커스텀 템플릿 로컬스토리지 동기화
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_CHECKLISTS_KEY, JSON.stringify(customTemplates))
    } catch (err) {
      console.error('커스텀 체크리스트 저장 실패', err)
    }
  }, [customTemplates])

  // 통계
  const totalCount = packingList.length
  const completedCount = packingList.filter((item) => item.checked).length
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // 체크 토글
  const toggleItem = (id) => {
    const updated = packingList.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    )
    onUpdatePackingList(updated)
  }

  // 삭제
  const deleteItem = (id) => {
    const updated = packingList.filter((item) => item.id !== id)
    onUpdatePackingList(updated)
  }

  // 단일 추가
  const handleAdd = (e) => {
    e?.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed) return

    const newItem = {
      id: uid(),
      text: trimmed,
      checked: false,
      category: inputCategory,
    }
    onUpdatePackingList([...packingList, newItem])
    setInputText('')
  }

  // 프리셋 로드 (국내여행 / 해외여행 / 나들이)
  const handleLoadPreset = (type) => {
    let presetData = []
    let title = ''

    if (type === 'domestic') {
      presetData = DOMESTIC_PACKING_ITEMS
      title = '국내여행'
    } else if (type === 'overseas') {
      presetData = OVERSEAS_PACKING_ITEMS
      title = '해외여행'
    } else if (type === 'outing') {
      presetData = OUTING_PACKING_ITEMS
      title = '나들이'
    }

    if (
      packingList.length > 0 &&
      !confirm(`기존 체크리스트 목록을 '${title} 기본 체크리스트'로 새로 교체하시겠습니까?`)
    ) {
      return
    }

    const newItems = presetData.map((item) => ({
      id: uid(),
      text: item.text,
      checked: false,
      category: item.category,
    }))
    onUpdatePackingList(newItems)
  }

  // 커스텀 템플릿 불러오기
  const handleLoadCustomTemplate = (template) => {
    if (
      packingList.length > 0 &&
      !confirm(`기존 체크리스트 목록을 '${template.name}' 커스텀 체크리스트로 교체하시겠습니까?`)
    ) {
      return
    }

    const newItems = template.items.map((item) => ({
      id: uid(),
      text: item.text,
      checked: false,
      category: item.category || '기타',
    }))
    onUpdatePackingList(newItems)
  }

  // 현재 체크리스트를 커스텀 템플릿으로 저장
  const handleSaveCurrentAsTemplate = () => {
    if (packingList.length === 0) {
      alert('현재 저장할 체크리스트 항목이 없습니다.')
      return
    }
    const name = newTemplateTitle.trim()
    if (!name) return

    const newTemplate = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      items: packingList.map((i) => ({ text: i.text, category: i.category })),
    }

    setCustomTemplates([newTemplate, ...customTemplates])
    setNewTemplateTitle('')
    setSaveModalOpen(false)
    alert(`'${name}' 커스텀 체크리스트가 저장되었습니다!`)
  }

  // 새 커스텀 템플릿 직접 만들기 및 저장 (카테고리별로 각각 입력된 항목들을 합쳐서 저장)
  const handleCreateCustomTemplate = () => {
    const name = createTemplateTitle.trim()
    if (!name) {
      alert('체크리스트 이름을 입력해주세요.')
      return
    }

    const allItems = []
    PACKING_CATEGORIES.forEach((cat) => {
      const lines = (categoryItems[cat] || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      lines.forEach((text) => {
        allItems.push({
          text,
          category: cat,
        })
      })
    })

    if (allItems.length === 0) {
      alert('적어도 하나 이상의 카테고리에 체크리스트 항목을 입력해주세요.')
      return
    }

    const newTemplate = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      items: allItems,
    }

    setCustomTemplates([newTemplate, ...customTemplates])
    setCreateModalOpen(false)
    alert(`'${name}' 커스텀 체크리스트(총 ${allItems.length}개 항목)가 생성되었습니다!`)
  }

  // 커스텀 템플릿 삭제
  const handleDeleteCustomTemplate = (id, name, e) => {
    e.stopPropagation()
    if (confirm(`'${name}' 커스텀 체크리스트를 삭제하시겠습니까?`)) {
      setCustomTemplates(customTemplates.filter((t) => t.id !== id))
    }
  }

  // 전체 초기화 (비우기)
  const handleClearAll = () => {
    if (confirm('모든 체크리스트 항목을 비우고 빈 상태로 만들까요?')) {
      onUpdatePackingList([])
    }
  }

  // 전체 완료 / 전체 해제
  const handleToggleAll = () => {
    const allChecked = packingList.length > 0 && packingList.every((i) => i.checked)
    const updated = packingList.map((i) => ({ ...i, checked: !allChecked }))
    onUpdatePackingList(updated)
  }

  // 카테고리별로 그룹화된 리스트 계산
  const groupedItems = useMemo(() => {
    const groups = {}
    PACKING_CATEGORIES.forEach((cat) => {
      groups[cat] = []
    })

    packingList.forEach((item) => {
      // 상태 필터 적용
      if (filter === 'active' && item.checked) return
      if (filter === 'completed' && !item.checked) return

      const cat = PACKING_CATEGORIES.includes(item.category) ? item.category : '기타'
      groups[cat].push(item)
    })

    return groups
  }, [packingList, filter])

  return (
    <div className="space-y-5">
      {/* ======================================================== */}
      {/* 1. 상단 진행률 대시보드 카드: 체크리스트 */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden rounded-3xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200/90 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <ListChecks className="h-4 w-4" /> TRIP NOTE
            </p>
            {/* 이름: 체크리스트 */}
            <h2 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
              체크리스트
            </h2>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-2 ring-1 ring-slate-200 text-right">
            <span className="text-xs text-slate-500">준비 완료</span>
            <p className="text-xl font-black text-indigo-600 tabular-nums">
              {completedCount}{' '}
              <span className="text-sm font-semibold text-slate-400">/ {totalCount}개</span>
            </p>
          </div>
        </div>

        {/* 달성률 프로그레스 바 */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>달성률</span>
            <span className="text-slate-800 font-bold">{percent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200/60">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. 여행 유형별 기본 체크리스트 불러오기 + 나들이 + 커스텀 */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-800">
              여행 유형별 기본 체크리스트 불러오기
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {packingList.length > 0 && (
              <button
                type="button"
                onClick={() => setSaveModalOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl transition"
                title="현재 체크리스트를 커스텀 템플릿으로 저장"
              >
                <BookmarkPlus className="h-3.5 w-3.5" /> 현재 목록 저장
              </button>
            )}
            {packingList.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 목록 비우기
              </button>
            )}
          </div>
        </div>

        {/* 프리셋 버튼 3종: 국내여행, 해외여행, 나들이 */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* 국내여행 버튼 */}
          <button
            type="button"
            onClick={() => handleLoadPreset('domestic')}
            className="group flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 py-3 px-3 shadow-xs transition active:scale-95 text-center sm:text-left"
          >
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs sm:text-sm font-black">국내여행</p>
              <p className="text-[10px] text-emerald-600/80 hidden md:block">
                의류, 전자기기 등 38종
              </p>
            </div>
          </button>

          {/* 해외여행 버튼 */}
          <button
            type="button"
            onClick={() => handleLoadPreset('overseas')}
            className="group flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200/80 py-3 px-3 shadow-xs transition active:scale-95 text-center sm:text-left"
          >
            <Plane className="h-4 w-4 shrink-0 text-indigo-600" />
            <div>
              <p className="text-xs sm:text-sm font-black">해외여행</p>
              <p className="text-[10px] text-indigo-600/80 hidden md:block">
                여권, 변환플러그 등 42종
              </p>
            </div>
          </button>

          {/* 나들이 버튼 */}
          <button
            type="button"
            onClick={() => handleLoadPreset('outing')}
            className="group flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 ring-1 ring-amber-200/80 py-3 px-3 shadow-xs transition active:scale-95 text-center sm:text-left"
          >
            <Compass className="h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs sm:text-sm font-black">나들이</p>
              <p className="text-[10px] text-amber-700/80 hidden md:block">
                면허증, 외투, 간식 등
              </p>
            </div>
          </button>
        </div>

        {/* 커스텀 체크리스트 목록 및 만들기 섹션 */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
              <FolderHeart className="h-3.5 w-3.5 text-pink-500" /> 나만의 커스텀 체크리스트
              <span className="text-[11px] font-semibold text-slate-400">
                ({customTemplates.length}개)
              </span>
            </span>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1 text-[11px] font-bold text-pink-600 hover:text-pink-700 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> 직접 만들기
            </button>
          </div>

          {customTemplates.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              저장된 커스텀 체크리스트가 없습니다. 현재 목록을 저장하거나 직접 새 체크리스트를 만들어보세요!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customTemplates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleLoadCustomTemplate(t)}
                  className="group flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 hover:bg-pink-50/70 border border-slate-200 hover:border-pink-300 py-1.5 px-3 transition active:scale-95"
                  title="클릭하여 이 체크리스트 불러오기"
                >
                  <FileCheck className="h-3.5 w-3.5 text-pink-500" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-pink-900">
                    {t.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    ({t.items?.length || 0}개)
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustomTemplate(t.id, t.name, e)}
                    className="ml-1 text-slate-300 hover:text-rose-500"
                    title="커스텀 체크리스트 삭제"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. 준비물 직접 추가 입력 폼 */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <h3 className="mb-3 text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Plus className="h-4 w-4 text-indigo-600" /> 준비물 직접 추가
        </h3>

        <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
          {/* 카테고리 셀렉트: 필수, 의류, 전자기기, 세면/화장품, 약, 식품, 기타 */}
          <select
            value={inputCategory}
            onChange={(e) => setInputCategory(e.target.value)}
            className="rounded-2xl border-0 bg-slate-50 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-700 ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {PACKING_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* 입력창 */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="추가할 준비물을 입력하세요 (예: 선글라스, 목베개 등)"
            className="flex-1 rounded-2xl border-0 bg-slate-50 px-4 py-2.5 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          {/* 추가 버튼 */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> 추가
          </button>
        </form>
      </section>

      {/* ======================================================== */}
      {/* 4. 카테고리별로 묶어서 표시되는 여행 체크리스트 리스트 */}
      {/* ======================================================== */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          {/* 상태 필터 탭 (전체 / 챙길 것 / 완료) */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
            {[
              { k: 'all', label: `전체 (${totalCount})` },
              { k: 'active', label: `챙길 것 (${totalCount - completedCount})` },
              { k: 'completed', label: `완료 (${completedCount})` },
            ].map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  filter === k ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 일괄 액션 버튼 */}
          {packingList.length > 0 && (
            <button
              onClick={handleToggleAll}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {packingList.every((i) => i.checked) ? '전체 해제' : '전체 완료 체크'}
            </button>
          )}
        </div>

        {/* 준비물이 하나도 없을 때의 빈 상태 화면 */}
        {packingList.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-indigo-50 text-indigo-600 shadow-inner">
              <ListChecks className="h-8 w-8" />
            </div>
            <h4 className="mt-3 text-base font-extrabold text-slate-800">
              아직 등록된 체크리스트가 없습니다
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              위의 [국내여행], [해외여행], [나들이] 버튼을 누르거나 커스텀 체크리스트를 불러와보세요!
            </p>
          </div>
        ) : (
          /* 카테고리별로 묶어서 표시 */
          <div className="space-y-6">
            {PACKING_CATEGORIES.map((cat) => {
              const itemsInCat = groupedItems[cat] || []
              if (itemsInCat.length === 0) return null

              const CatIcon = CATEGORY_ICONS[cat] || Package
              const catCompleted = itemsInCat.filter((i) => i.checked).length
              const catTotal = itemsInCat.length
              const catStyle = PACKING_CATEGORY_STYLES[cat] || 'bg-slate-100 text-slate-700'

              return (
                <div key={cat} className="space-y-2.5">
                  {/* 카테고리 헤더 */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ring-1 ring-inset ${catStyle}`}>
                        <CatIcon className="h-3.5 w-3.5" />
                        {cat}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {catCompleted} / {catTotal} 완료
                      </span>
                    </div>

                    {catCompleted === catTotal && catTotal > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ✓ 카테고리 완료
                      </span>
                    )}
                  </div>

                  {/* 해당 카테고리의 준비물 리스트 그리드 (한 줄에 6개씩 표시) */}
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {itemsInCat.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`group flex cursor-pointer items-center justify-between rounded-2xl p-3 ring-1 transition active:scale-[0.99] select-none ${
                          item.checked
                            ? 'bg-slate-50/70 ring-slate-200 opacity-60'
                            : 'bg-white ring-slate-200 hover:ring-indigo-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {/* 체크박스 */}
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition ${
                              item.checked
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 bg-white group-hover:border-indigo-400'
                            }`}
                          >
                            {item.checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </span>

                          {/* 준비물 텍스트 */}
                          <p
                            className={`text-sm font-semibold truncate ${
                              item.checked ? 'text-slate-400 line-through' : 'text-slate-800'
                            }`}
                          >
                            {item.text}
                          </p>
                        </div>

                        {/* 개별 삭제 버튼 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteItem(item.id)
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                          aria-label="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 모달 1: 현재 체크리스트를 커스텀 템플릿으로 저장하기 */}
      {/* ======================================================== */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-800">
                  현재 목록 템플릿으로 저장
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                현재 체크리스트({packingList.length}개 항목)를 나만의 템플릿으로 저장하여 다른 플랜에서도 재사용할 수 있습니다.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700">템플릿 이름</label>
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="예: 1박2일 캠핑, 아이와 주말 나들이"
                  className="mt-1 w-full rounded-2xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="flex-1 rounded-2xl py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentAsTemplate}
                disabled={!newTemplateTitle.trim()}
                className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-700 disabled:opacity-40"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 모달 2: 새 커스텀 체크리스트 직접 만들기 */}
      {/* ======================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-2xl ring-1 ring-slate-200 max-h-[90dvh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FolderHeart className="h-5 w-5 text-pink-500" />
                <h3 className="text-base font-extrabold text-slate-800">
                  커스텀 체크리스트 만들기
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 모달 본문 (스크롤 가능) */}
            <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              {/* 체크리스트 이름 입력 */}
              <div>
                <label className="text-xs font-bold text-slate-700">체크리스트 이름 *</label>
                <input
                  type="text"
                  value={createTemplateTitle}
                  onChange={(e) => setCreateTemplateTitle(e.target.value)}
                  placeholder="예: 2박 3일 캠핑 준비물, 스키장 필수템"
                  className="mt-1 w-full rounded-2xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* 카테고리 탭 선택기 (카테고리를 누르면 해당 카테고리 입력창으로 전환) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    카테고리 선택 (카테고리별로 각각 다른 항목 입력)
                  </label>
                  <span className="text-[11px] font-semibold text-pink-600">
                    현재: <span className="font-extrabold">{createCategory}</span>
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {PACKING_CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat] || Package
                    const isSelected = createCategory === cat
                    const count = getCategoryCount(cat)
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCreateCategory(cat)}
                        className={`relative flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition active:scale-95 ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-300'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 mb-0.5" />
                        <span className="text-[11px] font-bold leading-none">{cat}</span>
                        {/* 해당 카테고리에 입력된 항목 수 뱃지 */}
                        {count > 0 && (
                          <span
                            className={`mt-1 rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                              isSelected
                                ? 'bg-white text-pink-600'
                                : 'bg-pink-100 text-pink-600'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 현재 선택된 카테고리의 항목 입력 텍스트에리어 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-pink-500" />
                    '{createCategory}' 카테고리 항목 (한 줄에 하나씩)
                  </label>
                  <span className="text-[11px] font-bold text-pink-600">
                    {getCategoryCount(createCategory)}개 입력됨
                  </span>
                </div>
                <textarea
                  key={createCategory}
                  value={categoryItems[createCategory] || ''}
                  onChange={(e) => handleCategoryTextChange(createCategory, e.target.value)}
                  rows={5}
                  placeholder={CATEGORY_PLACEHOLDERS[createCategory] || '한 줄에 하나씩 항목을 입력하세요'}
                  className="w-full rounded-2xl border-0 bg-slate-50 p-3 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none leading-relaxed"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  💡 줄바꿈(엔터)으로 여러 항목을 입력하세요. 위의 다른 카테고리를 누르면 해당 카테고리 항목도 각각 추가할 수 있습니다.
                </p>
              </div>

              {/* 전체 등록 예정 항목 요약 카드 */}
              {totalCustomItemsCount > 0 && (
                <div className="rounded-2xl bg-pink-50/80 p-3 ring-1 ring-pink-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-extrabold text-pink-900">
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-4 w-4 text-pink-600" /> 등록 예정 체크리스트 구성:
                    </span>
                    <span className="rounded-full bg-pink-600 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
                      총 {totalCustomItemsCount}개 항목
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {PACKING_CATEGORIES.map((cat) => {
                      const count = getCategoryCount(cat)
                      if (count === 0) return null
                      return (
                        <span
                          key={cat}
                          onClick={() => setCreateCategory(cat)}
                          className={`cursor-pointer rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                            createCategory === cat
                              ? 'bg-pink-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-pink-100/70 border border-pink-200'
                          }`}
                          title="클릭하여 이 카테고리 편집"
                        >
                          {cat} {count}개
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="flex-1 rounded-2xl py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateCustomTemplate}
                disabled={!createTemplateTitle.trim() || totalCustomItemsCount === 0}
                className="flex-1 rounded-2xl bg-rose-500 hover:bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-40"
              >
                체크리스트 생성 {totalCustomItemsCount > 0 ? `(총 ${totalCustomItemsCount}개)` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
