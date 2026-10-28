import { useState } from 'react'
import { X, MapPin, Plus, StickyNote, Clock, Search, Loader2, CheckCircle2, AlertCircle, Phone, Link2, Coins } from 'lucide-react'
import { CATEGORIES, CATEGORY_KEYS, getCurrency } from '../data'
import { searchKakaoKeyword } from '../services/kakaoService'
import { searchOverseasPlaces } from '../services/googleService'

/**
 * 새 일정 추가 모달
 * - 일정명은 사용자가 자유롭게 입력 (장소 선택 시 미입력 상태면 상호명 자동 제안)
 * - 국내: 카카오 로컬 검색 / 해외: 글로벌 명소·지오코딩 검색
 * - 검색 결과 선택 시 도로명 주소, 좌표 자동 입력 및 지도 연동
 * - 링크 추가: 최대 3개까지 링크 이름 및 URL 지정 지원
 */
export default function AddScheduleModal({
  open,
  onClose,
  onAdd,
  onUpdate,
  initialData,
  defaultDay,
  dayCount,
  defaultCoord,
  dayLabel,
  tripType = 'domestic',
  tripCurrency = 'KRW',
}) {
  const getInitialLinks = () => {
    if (Array.isArray(initialData?.links) && initialData.links.length > 0) {
      return initialData.links.map((l) => ({ name: l?.name || '', url: l?.url || '' }))
    }
    if (initialData?.customNaverUrl) {
      return [{ name: '상세보기', url: initialData.customNaverUrl }]
    }
    return []
  }

  const init = () => ({
    day: initialData?.day ?? defaultDay,
    title: initialData?.title ?? '',
    time: initialData?.time ?? '12:00',
    category: initialData?.category ?? 'sightseeing',
    expense: initialData?.expense !== undefined && initialData?.expense !== null ? String(initialData.expense) : '',
    actualExpense:
      initialData?.actualExpense !== undefined && initialData?.actualExpense !== null
        ? String(initialData.actualExpense)
        : '',
    currency: initialData?.currency || (tripType === 'overseas' ? (tripCurrency || 'JPY') : 'KRW'),
    memo: initialData?.memo ?? '',
    showOnMap: initialData?.showOnMap ?? true,
    lat: initialData?.lat
      ? String(initialData.lat)
      : defaultCoord?.lat
      ? defaultCoord.lat.toFixed(4)
      : '33.3800',
    lng: initialData?.lng
      ? String(initialData.lng)
      : defaultCoord?.lng
      ? defaultCoord.lng.toFixed(4)
      : '126.5500',
    address: initialData?.address ?? '',
    addressName: initialData?.addressName ?? initialData?.oldAddress ?? '',
    roadAddress: initialData?.roadAddress ?? '',
    links: getInitialLinks(),
    placeName: initialData?.placeName ?? '',
    phone: initialData?.phone ?? '',
    placeUrl: initialData?.placeUrl ?? '',
  })

  const [f, setF] = useState(init)
  const [lastOpen, setLastOpen] = useState(open)
  const [lastInitialId, setLastInitialId] = useState(initialData?.id)

  // 장소 검색 관련 상태 (타이핑 중 호출 금지 · 검색 버튼 클릭 시에만 1회 실행)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastSearchedQuery, setLastSearchedQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // 열릴 때마다 또는 편집 대상 바뀔 때마다 폼 초기화
  if (open !== lastOpen || (open && initialData?.id !== lastInitialId)) {
    setLastOpen(open)
    setLastInitialId(initialData?.id)
    if (open) {
      setF(init())
      setSearchQuery(initialData?.placeName || initialData?.searchLocation || '')
      setLastSearchedQuery('')
      setSearchResults([])
      setSearchError('')
      setHasSearched(false)
    }
  }

  if (!open) return null

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  // 링크 추가/수정/삭제 헬퍼 (최대 3개)
  const handleAddLink = () => {
    if (f.links.length >= 3) return
    setF((prev) => ({
      ...prev,
      links: [...prev.links, { name: '', url: '' }],
    }))
  }

  const handleUpdateLink = (index, key, val) => {
    setF((prev) => {
      const next = [...prev.links]
      next[index] = { ...next[index], [key]: val }
      return { ...prev, links: next }
    })
  }

  const handleRemoveLink = (index) => {
    setF((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }))
  }

  const valid =
    f.title.trim() &&
    (!f.showOnMap || (isFinite(parseFloat(f.lat)) && isFinite(parseFloat(f.lng))))

  // 장소 검색 실행 함수 (검색 버튼 클릭 또는 엔터 시에만 1회 호출 · 영구 캐시 적용)
  const handleSearch = async (e) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (!q || isSearching) return

    // 직전에 이미 동일 검색어로 결과를 띄운 상태라면 중복 호출 방지
    if (hasSearched && lastSearchedQuery === q && searchResults.length > 0) {
      return
    }

    setIsSearching(true)
    setSearchError('')
    setHasSearched(true)
    setLastSearchedQuery(q)

    try {
      if (tripType === 'overseas') {
        // 해외여행: Google Places API (Text Search) + localStorage 영구 캐싱 (실패 시 무료 Nominatim 폴백)
        const results = await searchOverseasPlaces(q)
        setSearchResults(results)
        if (results.length === 0) {
          setSearchError('검색된 해외 장소가 없습니다. 영문 또는 한글 명칭을 다시 확인해주세요.')
        }
      } else {
        // 국내여행: 카카오 로컬 키워드 검색 + localStorage 영구 캐싱
        const results = await searchKakaoKeyword(q, {
          lat: f.lat ? Number(f.lat) : undefined,
          lng: f.lng ? Number(f.lng) : undefined,
        })
        setSearchResults(results)
        if (results.length === 0) {
          setSearchError('검색된 장소가 없습니다. 상호명이나 도로명을 다시 확인해주세요.')
        }
      }
    } catch (err) {
      console.error('장소 검색 실패:', err)
      setSearchError('장소 검색 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsSearching(false)
    }
  }

  // 검색 결과 중 장소 선택 시
  const selectPlace = (place) => {
    // 카테고리 자동 유추 (카페, 음식점, 숙박, 쇼핑 등)
    let guessedCategory = f.category
    const catStr = (place.category || '').toLowerCase()
    const nameStr = (place.name || '').toLowerCase()
    if (catStr.includes('카페') || nameStr.includes('카페') || nameStr.includes('커피')) {
      guessedCategory = 'cafe'
    } else if (catStr.includes('음식점') || catStr.includes('식당') || nameStr.includes('식당') || nameStr.includes('맛집')) {
      guessedCategory = 'food'
    } else if (catStr.includes('숙박') || catStr.includes('호텔') || catStr.includes('펜션') || nameStr.includes('호텔')) {
      guessedCategory = 'lodging'
    } else if (catStr.includes('쇼핑') || catStr.includes('마트') || catStr.includes('시장')) {
      guessedCategory = 'shopping'
    }

    setF((prev) => ({
      ...prev,
      // 일정명이 아직 비어있거나 기존 장소명과 동일하다면 새 장소명으로 채우기
      title: prev.title.trim() ? prev.title : place.name,
      placeName: place.name,
      address: place.address,
      addressName: place.addressName || place.oldAddress || '',
      roadAddress: place.roadAddress || '',
      lat: place.lat,
      lng: place.lng,
      category: guessedCategory,
      phone: place.phone || prev.phone,
      placeUrl: place.placeUrl || prev.placeUrl,
    }))
  }

  const submit = (e) => {
    e.preventDefault()
    if (!valid) return
    const targetPlace = f.placeName || searchQuery.trim() || f.title.trim()
    const cleanedLinks = (f.links || [])
      .map((l) => ({ name: (l.name || '').trim(), url: (l.url || '').trim() }))
      .filter((l) => l.url)
      .slice(0, 3)
    const payload = {
      day: Number(f.day),
      title: f.title.trim(),
      time: f.time,
      category: f.category,
      expense: Math.max(0, Number(f.expense) || 0),
      actualExpense:
        f.actualExpense !== '' && f.actualExpense !== undefined && f.actualExpense !== null
          ? Math.max(0, Number(f.actualExpense))
          : (initialData?.actualExpense ?? null),
      currency: f.currency || (tripType === 'overseas' ? (tripCurrency || 'JPY') : 'KRW'),
      memo: f.memo.trim(),
      showOnMap: f.showOnMap,
      lat: f.showOnMap ? parseFloat(f.lat) : 0,
      lng: f.showOnMap ? parseFloat(f.lng) : 0,
      address: f.address || '',
      addressName: f.addressName || '',
      roadAddress: f.roadAddress || '',
      links: cleanedLinks,
      customNaverUrl: cleanedLinks[0]?.url || '',
      placeName: targetPlace,
      searchLocation: targetPlace,
    }

    if (initialData?.id && onUpdate) {
      onUpdate(initialData.id, payload)
    } else if (onAdd) {
      onAdd(payload)
    }
    onClose()
  }

  const field =
    'w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none'
  const label = 'mb-1.5 block text-xs font-bold text-slate-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-title"
    >
      <div className="absolute inset-0 animate-fade bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 id="add-title" className="text-lg font-extrabold text-slate-900">
            {initialData ? '일정 편집' : '새 일정 추가'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {/* 일정 제목 */}
          <div>
            <label className={label} htmlFor="add-name">
              일정 제목 *
            </label>
            <input
              id="add-name"
              autoFocus
              value={f.title}
              onChange={set('title')}
              placeholder="예) 성산일출봉, 숙소 휴식, 도톤보리 라멘"
              className={field}
            />
          </div>

          {/* 일차 (날짜+요일) & 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="add-day">
                일차 (날짜 & 요일) *
              </label>
              <select id="add-day" value={f.day} onChange={set('day')} className={field}>
                {Array.from({ length: dayCount }, (_, i) => {
                  const dNum = i + 1
                  const dateStr = dayLabel ? dayLabel(dNum) : ''
                  return (
                    <option key={i} value={dNum}>
                      {dNum}일차 {dateStr}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="add-time-hour">
                <Clock className="mr-1 inline h-3 w-3" />
                시간 (24시간 기준)
              </label>
              {(() => {
                const parts = (f.time || '10:00').split(':')
                const curHour = parts[0] ? parts[0].padStart(2, '0') : '10'
                const curMin = parts[1] ? parts[1].padStart(2, '0') : '00'

                // 분 옵션 (5분 단위 기본 + 현재 임의의 분이 있으면 포함)
                const minOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
                if (!minOptions.includes(curMin)) {
                  minOptions.push(curMin)
                  minOptions.sort((a, b) => Number(a) - Number(b))
                }

                return (
                  <div className="flex items-center gap-1.5">
                    <select
                      id="add-time-hour"
                      value={curHour}
                      onChange={(e) => {
                        const newH = e.target.value
                        setF((prev) => ({ ...prev, time: `${newH}:${curMin}` }))
                      }}
                      className={`${field} flex-1 text-center font-mono font-bold text-slate-800`}
                    >
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                        <option key={h} value={h}>
                          {h}시
                        </option>
                      ))}
                    </select>
                    <span className="font-black text-slate-400">:</span>
                    <select
                      id="add-time-min"
                      value={curMin}
                      onChange={(e) => {
                        const newM = e.target.value
                        setF((prev) => ({ ...prev, time: `${curHour}:${newM}` }))
                      }}
                      className={`${field} flex-1 text-center font-mono font-bold text-slate-800`}
                    >
                      {minOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}분
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <span className={label}>카테고리</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {CATEGORY_KEYS.map((k) => {
                const c = CATEGORIES[k]
                const Icon = c.icon
                const on = f.category === k
                return (
                  <button
                    type="button"
                    key={k}
                    id={`add-cat-${k}`}
                    onClick={() => setF({ ...f, category: k })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold ring-1 transition active:scale-95 ${
                      on
                        ? `${c.bar} text-white shadow-md ring-transparent`
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 돈 단위 선택 버튼 (해외여행 또는 기본 통화가 KRW가 아닐 때: 기본설정 외화 vs 원화 선택) */}
          {tripCurrency && tripCurrency !== 'KRW' && (
            <div className="rounded-2xl bg-indigo-50/70 p-2.5 ring-1 ring-indigo-200/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-indigo-600" />
                  돈 단위 선택
                </span>
                <div className="inline-flex rounded-xl bg-white p-0.5 shadow-2xs ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setF((prev) => ({ ...prev, currency: tripCurrency }))}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      f.currency !== 'KRW'
                        ? 'bg-indigo-600 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {getCurrency(tripCurrency).name} ({getCurrency(tripCurrency).symbol})
                  </button>
                  <button
                    type="button"
                    onClick={() => setF((prev) => ({ ...prev, currency: 'KRW' }))}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      f.currency === 'KRW'
                        ? 'bg-indigo-600 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    대한민국 원 (₩)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 예상 지출액 & 실제 지출액 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="add-expense">
                예상 지출액
              </label>
              <div className="relative">
                <input
                  id="add-expense"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={f.expense}
                  onChange={set('expense')}
                  placeholder="0"
                  className={`${field} pr-10 text-right text-base font-bold`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  {getCurrency(f.currency || tripCurrency).unit}
                </span>
              </div>
            </div>

            <div>
              <label className={label} htmlFor="add-actual-expense">
                실제 지출액
              </label>
              <div className="relative">
                <input
                  id="add-actual-expense"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={f.actualExpense}
                  onChange={set('actualExpense')}
                  placeholder="0"
                  className={`${field} pr-10 text-right text-base font-bold text-indigo-600`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-500">
                  {getCurrency(f.currency || tripCurrency).unit}
                </span>
              </div>
            </div>
          </div>

          {/* 특이사항 메모 */}
          <div>
            <label className={label} htmlFor="add-memo">
              <StickyNote className="mr-1 inline h-3 w-3" />
              특이사항 메모
            </label>
            <textarea
              id="add-memo"
              rows={2}
              value={f.memo}
              onChange={set('memo')}
              placeholder="예약번호, 준비물, 팁 등"
              className={`${field} resize-none`}
            />
          </div>

          {/* 링크추가 (최대 3개, 링크 이름 지정 가능) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={label} style={{ marginBottom: 0 }}>
                <Link2 className="mr-1 inline h-3.5 w-3.5 text-indigo-600" />
                링크추가 <span className="font-normal text-slate-400">({f.links.length}/3)</span>
              </label>
              {f.links.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  링크 추가
                </button>
              )}
            </div>

            {f.links.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-xs text-slate-400">
                등록된 링크가 없습니다. 예약 사이트나 안내 링크를 추가해보세요.
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="ml-2 font-bold text-indigo-600 hover:underline"
                >
                  + 링크 추가
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {f.links.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={link.name}
                      onChange={(e) => handleUpdateLink(idx, 'name', e.target.value)}
                      placeholder="링크명 (예: 예약, 공홈)"
                      className="w-28 shrink-0 rounded-xl border-0 bg-slate-50 px-2.5 py-2 text-xs font-semibold ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 min-w-0 rounded-xl border-0 bg-slate-50 px-2.5 py-2 text-xs ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="링크 삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              * 웹사이트 주소(https://...)를 입력하면 일정 목록에서 지정한 이름의 버튼으로 바로 열립니다.
            </p>
          </div>

          {/* 지도에 표시 체크박스 */}
          <label
            htmlFor="add-showmap"
            className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 ring-1 transition ${
              f.showOnMap ? 'bg-indigo-50 ring-indigo-200' : 'bg-slate-50 ring-slate-200'
            }`}
          >
            <input
              id="add-showmap"
              type="checkbox"
              checked={f.showOnMap}
              onChange={set('showOnMap')}
              className="h-5 w-5 accent-indigo-600"
            />
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-800">지도에 표시</span>
              <span className="block text-xs text-slate-500">
                끄면 '숙소 휴식' 같은 일정으로 타임라인에만 표시돼요
              </span>
            </span>
            <MapPin className={`h-5 w-5 ${f.showOnMap ? 'text-indigo-500' : 'text-slate-300'}`} />
          </label>

          {/* ======================================================== */}
          {/* 지도 장소 검색기 (수동 좌표 입력 대신 실제 장소 검색 및 주소 선택) */}
          {/* ======================================================== */}
          {f.showOnMap && (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Search className="h-3.5 w-3.5 text-indigo-600" />
                  지도 장소 검색
                </span>
              </div>

              {/* 검색 입력창 */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSearch()
                      }
                    }}
                    placeholder={
                      tripType === 'overseas'
                        ? '해외 장소 검색 (예: 오사카성, 도톤보리, 에펠탑...)'
                        : '국내 매장·명소 검색 (예: 성수동 카페, 런던베이글, 연돈...)'
                    }
                    className="w-full rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-xs font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 disabled:opacity-40 transition"
                >
                  {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  검색
                </button>
              </div>

              {/* 검색 에러 메시지 */}
              {searchError && (
                <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {searchError}
                </p>
              )}

              {/* 검색 결과 목록 (중복/여러 결과 시 정확한 도로명 주소와 함께 표시) */}
              {hasSearched && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500">
                    검색 결과 ({searchResults.length}개) · 원하는 정확한 장소를 선택해주세요:
                  </span>

                  {searchResults.length === 0 && !isSearching && (
                    <div className="rounded-xl bg-white p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200">
                      검색된 장소가 없습니다. 상호명이나 지번/도로명으로 검색해보세요.
                    </div>
                  )}

                  <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {searchResults.map((place) => {
                      const isSelected = f.lat === place.lat && f.lng === place.lng
                      return (
                        <div
                          key={place.id}
                          onClick={() => selectPlace(place)}
                          className={`cursor-pointer rounded-xl p-2.5 transition active:scale-[0.99] border text-left ${
                            isSelected
                              ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-200'
                              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                              <MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                              {place.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {place.category && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                  {place.category}
                                </span>
                              )}
                              {isSelected ? (
                                <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                                  선택됨
                                </span>
                              ) : (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  선택
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 정확한 상세 주소 표시 */}
                          <p className="mt-1 text-[11px] leading-tight text-slate-500 line-clamp-2">
                            {place.address}
                          </p>
                          {place.phone && (
                            <p className="mt-0.5 text-[10px] text-slate-400 flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {place.phone}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            id="add-submit"
            type="submit"
            disabled={!valid}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-[15px] font-bold text-white shadow-md shadow-indigo-500/20 transition active:scale-[0.98] disabled:opacity-40"
          >
            {initialData ? (
              <>
                <CheckCircle2 className="h-5 w-5" /> 일정 수정 완료
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" /> 일정 추가하기
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

