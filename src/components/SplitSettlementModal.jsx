import { useState, useMemo, useEffect } from 'react'
import {
  X,
  Calculator,
  Users,
  Copy,
  Check,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Divide,
  WalletCards,
  Coins,
  Wallet,
} from 'lucide-react'
import { won, uid, formatMoney, getCurrency } from '../data'

export default function SplitSettlementModal({
  open,
  onClose,
  total,
  defaultHeadcount = 2,
  tripTitle = '여행',
  isSettled = false,
  initialData = null,
  onSave,
  onClear,
  isCollection = false, // 회비 걷기 모드 여부
  tripType = 'domestic',
  tripCurrency = 'KRW',
  foreignTotal = 0,
  krwTotal = 0,
  collectionData = null,
  onSaveCollection,
}) {
  const isOverseas = tripType === 'overseas' && tripCurrency !== 'KRW'
  const currencyInfo = getCurrency(tripCurrency)

  // 모드: 'simple' (나눌 수 직접 입력) | 'group' (그룹별 정산)
  const [mode, setMode] = useState('simple')

  // 1. 단순 N등분 모드 상태
  const [splitCount, setSplitCount] = useState(defaultHeadcount || 2)

  // 2. 그룹별 정산 모드 상태
  const [groupSplitType, setGroupSplitType] = useState('byPeople') // 'byPeople' (그룹인원수 비례) | 'equal' (그룹 균등)
  const [groups, setGroups] = useState([
    { id: 'g-1', name: '그룹 A', members: 2 },
    { id: 'g-2', name: '그룹 B', members: 2 },
  ])

  // [국내여행 전용] 단일 회비 입력값
  const [customTotalInput, setCustomTotalInput] = useState('')

  // [해외여행 전용] 외화 회비/정산액과 원화 회비/정산액 분리 상태 관리
  const [customForeignInput, setCustomForeignInput] = useState('')
  const [customKrwInput, setCustomKrwInput] = useState('')

  // [해외여행 정산하기 전용] 정산 대상 통화 선택: 'both' (외화+원화 각각) | 'foreign' (현지 외화만) | 'krw' (원화만)
  const [settleTarget, setSettleTarget] = useState('both')

  const [copied, setCopied] = useState(false)

  // 모달이 열릴 때 이전 저장된 조건 복원
  useEffect(() => {
    if (open) {
      if (isCollection) {
        setSettleTarget(collectionData?.collectionTarget || 'both')
        setMode(collectionData?.mode || 'simple')
        setSplitCount(collectionData?.splitCount || defaultHeadcount || 2)
        setRoundingUnit(1)
        setGroupSplitType(collectionData?.groupSplitType || 'byPeople')
        if (collectionData?.groups && collectionData.groups.length > 0) {
          setGroups(collectionData.groups)
        }

        if (isOverseas) {
          // 해외여행: 외화 및 원화 둘 다 초기화
          if (collectionData?.foreignCollected !== undefined) {
            setCustomForeignInput(String(collectionData.foreignCollected))
          } else {
            setCustomForeignInput(String(foreignTotal || 0))
          }

          if (collectionData?.krwCollected !== undefined) {
            setCustomKrwInput(String(collectionData.krwCollected))
          } else {
            setCustomKrwInput(String(krwTotal || 0))
          }
        } else {
          // 국내여행: 단일 원화 회비 초기화
          if (collectionData?.totalCollected !== undefined) {
            setCustomTotalInput(String(collectionData.totalCollected))
          } else {
            setCustomTotalInput(String(total || 0))
          }
        }
      } else {
        // 정산하기 모드
        setSettleTarget(initialData?.settleTarget || 'both')
        if (initialData) {
          setMode(initialData.mode || 'simple')
          setSplitCount(initialData.splitCount || defaultHeadcount || 2)
          setRoundingUnit(1)
          setGroupSplitType(initialData.groupSplitType || 'byPeople')
          if (initialData.groups && initialData.groups.length > 0) {
            setGroups(initialData.groups)
          }
        } else {
          setMode('simple')
          setSplitCount(defaultHeadcount || 2)
          setRoundingUnit(1)
          setGroupSplitType('byPeople')
        }

        if (isOverseas) {
          setCustomForeignInput(String(foreignTotal || 0))
          setCustomKrwInput(String(krwTotal || 0))
        } else {
          setCustomTotalInput(String(total || 0))
        }
      }
    }
  }, [
    open,
    isCollection,
    initialData,
    collectionData,
    defaultHeadcount,
    isOverseas,
    tripCurrency,
    foreignTotal,
    krwTotal,
    total,
  ])

  // 실제 적용 금액 계산
  // 1) 국내여행 단일 총액
  const activeDomesticTotal = useMemo(() => {
    if (!isCollection) return total
    return customTotalInput !== '' ? Number(customTotalInput) || 0 : total
  }, [isCollection, customTotalInput, total])

  // 2) 해외여행 외화 총액 & 원화 총액 (회비걷기 및 정산하기 모두 지원)
  const activeForeignTotal = useMemo(() => {
    return customForeignInput !== '' ? Number(customForeignInput) || 0 : foreignTotal
  }, [customForeignInput, foreignTotal])

  const activeKrwTotal = useMemo(() => {
    return customKrwInput !== '' ? Number(customKrwInput) || 0 : krwTotal
  }, [customKrwInput, krwTotal])

  const showForeign = isOverseas && (settleTarget === 'both' || settleTarget === 'foreign')
  const showKrw = isOverseas && (settleTarget === 'both' || settleTarget === 'krw')

  // 1인당 계산 (단순 N등분)
  const count = Math.max(1, Number(splitCount) || 1)

  // 국내 1인당
  const simplePerPersonDomestic = useMemo(() => {
    return Math.round(activeDomesticTotal / count)
  }, [activeDomesticTotal, count])

  // 해외 1인당 외화 & 원화
  const simpleForeignPerPerson = useMemo(() => {
    return Math.round(activeForeignTotal / count)
  }, [activeForeignTotal, count])

  const simpleKrwPerPerson = useMemo(() => {
    return Math.round(activeKrwTotal / count)
  }, [activeKrwTotal, count])

  // 그룹별 정산 계산
  const totalGroupMembers = useMemo(() => {
    return groups.reduce((s, g) => s + (Number(g.members) || 1), 0)
  }, [groups])

  const groupResults = useMemo(() => {
    const groupCount = Math.max(1, groups.length)

    return groups.map((grp) => {
      const memCount = Math.max(1, Number(grp.members) || 1)
      const ratio =
        groupSplitType === 'byPeople'
          ? totalGroupMembers > 0
            ? memCount / totalGroupMembers
            : 0
          : 1 / groupCount
      const percent = ratio * 100

      if (isOverseas) {
        const amountForeign = Math.round(activeForeignTotal * ratio)
        const amountKrw = Math.round(activeKrwTotal * ratio)
        return {
          ...grp,
          memCount,
          percent,
          amountForeign,
          amountKrw,
        }
      }

      const base = isCollection ? activeDomesticTotal : total
      const amount = Math.round(base * ratio)
      return {
        ...grp,
        memCount,
        percent,
        amount,
      }
    })
  }, [
    groups,
    total,
    isCollection,
    isOverseas,
    activeDomesticTotal,
    activeForeignTotal,
    activeKrwTotal,
    groupSplitType,
    totalGroupMembers,
  ])

  if (!open) return null

  // 정산 조건 저장 핸들러
  const handleSaveSettlement = () => {
    const data = {
      mode,
      splitCount: Number(splitCount) || 1,
      roundingUnit: 1,
      groupSplitType,
      groups,
      total,
      foreignTotal: activeForeignTotal,
      krwTotal: activeKrwTotal,
      settleTarget,
      savedAt: new Date().toISOString(),
    }
    onSave?.(data)
    alert('정산 조건이 저장되었으며, 플랜 목록에 [정산완료] 상태가 등록되었습니다!')
  }

  // 회비 걷기 저장 핸들러 (해외여행 시 외화+원화 / 현지외화만 / 원화만 선택에 따라 저장)
  const handleSaveCollection = () => {
    if (isOverseas) {
      if (settleTarget === 'foreign') {
        const data = {
          isDual: false,
          collectionTarget: 'foreign',
          totalCollected: activeForeignTotal,
          foreignCollected: activeForeignTotal,
          currency: tripCurrency,
          mode,
          splitCount: Number(splitCount) || 1,
          roundingUnit: 1,
          groupSplitType,
          groups,
          perPerson: simpleForeignPerPerson,
          simpleForeignPerPerson,
          savedAt: new Date().toISOString(),
        }
        onSaveCollection?.(data)
        alert(
          `현지 외화(${formatMoney(
            activeForeignTotal,
            tripCurrency
          )}) 회비 걷기 내역이 저장되었습니다! 가계부 탭에서 회비 잔액을 실시간으로 확인하실 수 있습니다.`
        )
      } else if (settleTarget === 'krw') {
        const data = {
          isDual: false,
          collectionTarget: 'krw',
          totalCollected: activeKrwTotal,
          krwCollected: activeKrwTotal,
          currency: 'KRW',
          mode,
          splitCount: Number(splitCount) || 1,
          roundingUnit: 1,
          groupSplitType,
          groups,
          perPerson: simpleKrwPerPerson,
          simpleKrwPerPerson,
          savedAt: new Date().toISOString(),
        }
        onSaveCollection?.(data)
        alert(
          `원화(${won(
            activeKrwTotal
          )}) 회비 걷기 내역이 저장되었습니다! 가계부 탭에서 회비 잔액을 실시간으로 확인하실 수 있습니다.`
        )
      } else {
        const data = {
          isDual: true,
          collectionTarget: 'both',
          foreignCollected: activeForeignTotal,
          krwCollected: activeKrwTotal,
          currency: tripCurrency,
          mode,
          splitCount: Number(splitCount) || 1,
          roundingUnit: 1,
          groupSplitType,
          groups,
          simpleForeignPerPerson,
          simpleKrwPerPerson,
          savedAt: new Date().toISOString(),
        }
        onSaveCollection?.(data)
        alert(
          `외화(${formatMoney(activeForeignTotal, tripCurrency)}) 및 원화(${won(
            activeKrwTotal
          )}) 회비 걷기 내역이 저장되었습니다! 가계부 탭에서 각 회비의 잔액을 실시간으로 확인하실 수 있습니다.`
        )
      }
    } else {
      const data = {
        isDual: false,
        totalCollected: activeDomesticTotal,
        currency: 'KRW',
        mode,
        splitCount: Number(splitCount) || 1,
        roundingUnit: 1,
        groupSplitType,
        groups,
        perPerson: simplePerPersonDomestic,
        savedAt: new Date().toISOString(),
      }
      onSaveCollection?.(data)
      alert(
        `총 회비 ${won(activeDomesticTotal)} 걷기 내역이 저장되었습니다! 가계부 탭에서 회비 잔액을 확인하실 수 있습니다.`
      )
    }
    onClose()
  }

  // 그룹 추가 / 삭제 / 수정
  const handleAddGroup = () => {
    const nextIdx = groups.length + 1
    const nextChar = String.fromCharCode(64 + nextIdx)
    setGroups([...groups, { id: uid(), name: `그룹 ${nextChar}`, members: 2 }])
  }

  const handleDeleteGroup = (id) => {
    if (groups.length <= 1) {
      alert('최소 1개 이상의 그룹이 있어야 합니다.')
      return
    }
    setGroups(groups.filter((g) => g.id !== id))
  }

  const handleUpdateGroup = (id, patch) => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  // 카카오톡 공유용 클립보드 복사
  const handleCopyResult = () => {
    let text = isCollection
      ? `✈️ [TRIP NOTE] ${tripTitle} 여행 회비 걷기 안내\n`
      : `✈️ [TRIP NOTE] ${tripTitle} 여행 경비 정산 안내\n`

    if (isOverseas) {
      text += isCollection ? `💰 걷을 총 회비:\n` : `💰 실제 총 지출:\n`
      if (showForeign) {
        text += `  • 현지 외화 (${currencyInfo.code}): ${formatMoney(activeForeignTotal, tripCurrency)}${
          isCollection ? ` (예상: ${formatMoney(foreignTotal, tripCurrency)})` : ''
        }\n`
      }
      if (showKrw) {
        text += `  • 원화 (KRW): ${won(activeKrwTotal)}${
          isCollection ? ` (예상: ${won(krwTotal)})` : ''
        }\n`
      }
      text += `-------------------------------\n`
      if (mode === 'simple') {
        text += `👥 ${isCollection ? '회비 분할' : '정산'} 인원: ${splitCount}등분\n`
        text += `👉 1인당(팀당) ${isCollection ? '회비 입금액' : '부담 금액'}:\n`
        if (showForeign) {
          text += `  • 현지 외화: ${formatMoney(simpleForeignPerPerson, tripCurrency)}\n`
        }
        if (showKrw) {
          text += `  • 원화: ${won(simpleKrwPerPerson)}\n`
        }
      } else {
        text += `👥 그룹별 ${isCollection ? '회비' : '정산'} 내역 (${
          groupSplitType === 'byPeople' ? '인원 비례' : '그룹 균등'
        }):\n`
        groupResults.forEach((g) => {
          const parts = []
          if (showForeign) parts.push(`외화 ${formatMoney(g.amountForeign, tripCurrency)}`)
          if (showKrw) parts.push(`원화 ${won(g.amountKrw)}`)
          text += `• ${g.name} (${g.memCount}명): ${parts.join(' + ')}\n`
        })
        text += `-------------------------------\n`
        text += `총 참여 인원: ${totalGroupMembers}명 (${groups.length}개 그룹)\n`
      }
    } else {
      const baseTotal = isCollection ? activeDomesticTotal : total
      const per = simplePerPersonDomestic
      text += isCollection
        ? `💰 걷을 총 회비: ${won(baseTotal)} (예상경비: ${won(total)})\n`
        : `💰 여행 총 지출: ${won(baseTotal)}\n`
      text += `-------------------------------\n`
      if (mode === 'simple') {
        text += `👥 ${isCollection ? '회비 분할' : '정산'} 인원: ${splitCount}등분\n`
        text += `👉 1인당(팀당) ${isCollection ? '회비 입금액' : '부담 금액'}: ${won(per)}\n`
      } else {
        text += `👥 그룹별 ${isCollection ? '회비' : '정산'} 내역:\n`
        groupResults.forEach((g) => {
          text += `• ${g.name} (${g.memCount}명): ${won(g.amount)}\n`
        })
        text += `-------------------------------\n`
        text += `총 참여 인원: ${totalGroupMembers}명 (${groups.length}개 그룹)\n`
      }
    }

    text += isCollection
      ? `\n즐겁고 알찬 여행을 위해 사전 회비 입금 부탁드립니다 😊`
      : `\n모두 즐거운 여행이었습니다! 확인 후 송금 부탁드립니다 😊`

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-fade">
        {/* 헤더 */}
        <div className="border-b border-slate-800 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-10 w-10 place-items-center rounded-2xl font-black shadow-md ${
                  isCollection
                    ? 'bg-emerald-400 text-slate-950 shadow-emerald-400/20'
                    : 'bg-amber-400 text-slate-950 shadow-amber-400/20'
                }`}
              >
                {isCollection ? <WalletCards className="h-5 w-5" /> : <Calculator className="h-5 w-5" />}
              </span>
              <div>
                <h3 className="text-base font-black">
                  {isCollection ? '여행 회비 걷기' : '여행 경비 정산하기'}
                </h3>
                <p className="text-xs text-slate-300">
                  {isCollection ? (
                    isOverseas ? (
                      <span>
                        예상 경비: <strong className="text-indigo-300">외화 {formatMoney(foreignTotal, tripCurrency)}</strong> ·{' '}
                        <strong className="text-emerald-300">원화 {won(krwTotal)}</strong>
                      </span>
                    ) : (
                      <span>예상 총 경비: <strong className="text-emerald-300">{won(total)}</strong></span>
                    )
                  ) : isOverseas ? (
                    <span>
                      실제 지출: <strong className="text-indigo-300">외화 {formatMoney(foreignTotal, tripCurrency)}</strong> ·{' '}
                      <strong className="text-emerald-300">원화 {won(krwTotal)}</strong>
                    </span>
                  ) : (
                    <span>실제 총 지출: <strong className="text-amber-300">{won(total)}</strong></span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-300 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* [요청사항] 회비 걷기 시 예상 경비 옆 총회비금액 입력 섹션 / 해외여행 정산하기 시 외화·원화 개별 정산 섹션 */}
        {(isCollection || isOverseas) && (
          <div
            className={`border-b p-4 space-y-3 ${
              isCollection
                ? 'border-emerald-100 bg-emerald-50/70'
                : 'border-indigo-100 bg-indigo-50/50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p
                  className={`text-xs font-black flex items-center gap-1 ${
                    isCollection ? 'text-emerald-950' : 'text-slate-900'
                  }`}
                >
                  <Sparkles
                    className={`h-3.5 w-3.5 ${
                      isCollection ? 'text-emerald-600' : 'text-indigo-600'
                    }`}
                  />
                  {isCollection
                    ? '실제 걷을 총 회비 금액 설정'
                    : '해외여행 실제 지출 외화 · 원화 따로 정산'}
                </p>
                <p
                  className={`text-[11px] ${
                    isCollection ? 'text-emerald-800/80' : 'text-slate-600'
                  }`}
                >
                  {isCollection
                    ? isOverseas
                      ? '해외여행 시 현지 외화와 원화 회비를 각각 입력하여 둘 다 걷으실 수 있습니다.'
                      : '예상 경비보다 넉넉하게 걷으시려면 원하는 총 금액을 입력하세요.'
                    : '실제 지출한 현지 외화와 원화를 각각 따로 정산하거나 한눈에 정산할 수 있습니다.'}
                </p>
              </div>
            </div>

            {/* 해외여행 전용: 회비걷기 및 정산하기 모두 외화+원화 / 현지외화만 / 원화만 옵션 지원 */}
            {isOverseas && (
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/90 p-1 ring-1 ring-slate-200">
                {[
                  { id: 'both', label: '외화 + 원화 각각' },
                  { id: 'foreign', label: `현지 외화 (${currencyInfo.symbol})만` },
                  { id: 'krw', label: '원화 (₩)만' },
                ].map(({ id, label }) => {
                  const active = settleTarget === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSettleTarget(id)}
                      className={`rounded-xl py-1.5 px-2 text-xs font-extrabold transition active:scale-95 ${
                        active
                          ? id === 'krw'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {isOverseas ? (
              /* 해외여행: 외화 & 원화 2분할 입력/확인 카드 */
              <div
                className={`grid gap-2.5 ${
                  showForeign && showKrw ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {/* 1) 현지 외화 카드 (파랑) */}
                {showForeign && (
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-indigo-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-indigo-700 flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-indigo-600" />
                        현지 외화 ({currencyInfo.code})
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-500">
                        {isCollection ? '예상' : '실제 지출'} {formatMoney(foreignTotal, tripCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-xl bg-indigo-50/40 px-2.5 py-1.5 ring-1 ring-indigo-200/80">
                      <span className="text-xs font-bold text-indigo-600">{currencyInfo.symbol}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={customForeignInput}
                        onChange={(e) => setCustomForeignInput(e.target.value)}
                        placeholder={String(foreignTotal)}
                        className="w-full text-right text-sm font-black text-indigo-700 outline-none bg-transparent tabular-nums"
                      />
                    </div>
                    {isCollection && Number(customForeignInput) > foreignTotal && (
                      <p className="mt-1 text-right text-[10px] font-bold text-indigo-600">
                        +{formatMoney(Number(customForeignInput) - foreignTotal, tripCurrency)} 여유
                      </p>
                    )}
                  </div>
                )}

                {/* 2) 원화 카드 (초록) */}
                {showKrw && (
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-emerald-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-emerald-700 flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                        원화 (KRW)
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600">
                        {isCollection ? '예상' : '실제 지출'} {won(krwTotal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50/40 px-2.5 py-1.5 ring-1 ring-emerald-200/80">
                      <span className="text-xs font-bold text-emerald-600">₩</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={customKrwInput}
                        onChange={(e) => setCustomKrwInput(e.target.value)}
                        placeholder={String(krwTotal)}
                        className="w-full text-right text-sm font-black text-emerald-700 outline-none bg-transparent tabular-nums"
                      />
                      <span className="text-xs font-bold text-emerald-700">원</span>
                    </div>
                    {isCollection && Number(customKrwInput) > krwTotal && (
                      <p className="mt-1 text-right text-[10px] font-bold text-emerald-700">
                        +{won(Number(customKrwInput) - krwTotal)} 여유
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* 국내여행: 단일 원화 회비 입력 카드 */
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-emerald-200">
                <span className="text-xs font-bold text-slate-700">총 걷을 회비:</span>
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
                  <span className="text-xs font-bold text-slate-500">₩</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={customTotalInput}
                    onChange={(e) => setCustomTotalInput(e.target.value)}
                    placeholder={String(total)}
                    className="w-32 text-right text-base font-black text-slate-900 outline-none bg-transparent tabular-nums"
                  />
                  <span className="text-xs font-bold text-slate-700">원</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 탭 전환: 1) 나눌 수 직접 입력 / 2) 가족별/그룹별 정산 */}
        <div className="grid grid-cols-2 gap-1 border-b border-slate-100 bg-slate-50 p-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition ${
              mode === 'simple'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Divide className="h-4 w-4" /> 나눌 수 직접 입력 (N등분)
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition ${
              mode === 'group'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" /> 그룹별 정산
          </button>
        </div>

        {/* 본문 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 모드 1: 나눌 수 직접 입력 (N등분) */}
          {mode === 'simple' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-indigo-100">
                <label className="block text-xs font-extrabold text-indigo-900 mb-1.5">
                  총 지출을 몇 명(또는 몇 그룹)으로 나눌까요?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={splitCount}
                    onChange={(e) => setSplitCount(Math.max(1, Number(e.target.value)))}
                    className="w-28 rounded-xl border-0 bg-white px-3 py-2.5 text-center text-lg font-black text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none tabular-nums"
                  />
                  <span className="text-sm font-bold text-slate-700">등분</span>

                  <div className="flex gap-1 ml-auto">
                    {[2, 3, 4, 5, defaultHeadcount].filter(
                      (v, i, a) => a.indexOf(v) === i && v > 0
                    ).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSplitCount(n)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                          splitCount === n
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {n}명
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 1인당 최종 계산 결과 카드 */}
              {isOverseas ? (
                <div
                  className={`grid gap-3 ${
                    showForeign && showKrw ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {showForeign && (
                    <div className="rounded-3xl bg-slate-900 p-4 text-white shadow-lg text-center ring-1 ring-indigo-500/40">
                      <p className="text-xs font-bold text-indigo-300">
                        {isCollection ? '1인당 현지 외화 회비' : '1인당 현지 외화 정산액'}
                      </p>
                      <p className="mt-1.5 text-2xl font-black text-indigo-300 tabular-nums">
                        {formatMoney(simpleForeignPerPerson, tripCurrency)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                        외화 {formatMoney(activeForeignTotal, tripCurrency)} ÷ {splitCount}등분
                      </p>
                    </div>
                  )}

                  {showKrw && (
                    <div className="rounded-3xl bg-slate-900 p-4 text-white shadow-lg text-center ring-1 ring-emerald-500/40">
                      <p className="text-xs font-bold text-emerald-300">
                        {isCollection ? '1인당 원화 회비' : '1인당 원화 정산액'}
                      </p>
                      <p className="mt-1.5 text-2xl font-black text-emerald-300 tabular-nums">
                        {won(simpleKrwPerPerson)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                        원화 {won(activeKrwTotal)} ÷ {splitCount}등분
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg text-center">
                  <p className="text-xs font-semibold text-slate-400">
                    {isCollection ? '1인당(팀당) 회비 입금액' : '1인당(팀당) 최종 부담 금액'}
                  </p>
                  <div className="mt-2">
                    <p className="text-3xl font-black text-amber-300 tabular-nums">
                      {won(simplePerPersonDomestic)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      총 {won(isCollection ? activeDomesticTotal : total)} ÷ {splitCount}등분
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 모드 2: 그룹별 정산 */}
          {mode === 'group' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">그룹 분할 방식 선택</span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setGroupSplitType('byPeople')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      groupSplitType === 'byPeople'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    인원수 비례
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupSplitType('equal')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      groupSplitType === 'equal'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    그룹 균등 (1/N)
                  </button>
                </div>
              </div>

              {/* 그룹 리스트 (그룹 균등 선택 시에도 인원수 입력칸 상시 유지) */}
              <div className="space-y-2">
                {groups.map((grp) => (
                  <div
                    key={grp.id}
                    className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200"
                  >
                    <input
                      type="text"
                      value={grp.name}
                      onChange={(e) => handleUpdateGroup(grp.id, { name: e.target.value })}
                      placeholder="그룹 이름"
                      className="flex-1 rounded-xl border-0 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={grp.members}
                        onChange={(e) =>
                          handleUpdateGroup(grp.id, {
                            members: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-16 rounded-xl border-0 bg-white px-2 py-1.5 text-center text-xs font-black text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                      <span className="text-xs font-semibold text-slate-500">명</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(grp.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                      title="그룹 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition"
                >
                  <Plus className="h-4 w-4" /> 새 그룹 추가
                </button>
              </div>

              {/* 그룹별 계산 결과 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-700">그룹별 부담 결과</p>
                <div className="space-y-2">
                  {groupResults.map((res) => (
                    <div
                      key={res.id}
                      className="flex items-center justify-between rounded-2xl bg-indigo-50/70 p-3 ring-1 ring-indigo-200"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-slate-900">{res.name}</p>
                          <span className="rounded-md bg-indigo-200/70 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-800">
                            {res.memCount}명 ({res.percent.toFixed(1)}%)
                          </span>
                        </div>
                        {isOverseas ? (
                          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            1인당:{' '}
                            {showForeign && (
                              <span className="font-bold text-indigo-600">
                                외화 {formatMoney(Math.round(res.amountForeign / res.memCount), tripCurrency)}
                              </span>
                            )}
                            {showForeign && showKrw && <span className="mx-1 text-slate-400">+</span>}
                            {showKrw && (
                              <span className="font-bold text-emerald-600">
                                원화 {won(Math.round(res.amountKrw / res.memCount))}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            1인당 {won(Math.round(res.amount / res.memCount))}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        {isOverseas ? (
                          <div className="text-sm font-black tabular-nums space-y-0.5">
                            {showForeign && (
                              <p className="text-indigo-700">
                                {formatMoney(res.amountForeign, tripCurrency)}
                              </p>
                            )}
                            {showKrw && (
                              <p className="text-emerald-700">
                                {showForeign ? `+${won(res.amountKrw)}` : won(res.amountKrw)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-base font-black text-indigo-950 tabular-nums">
                            {won(res.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 바: 닫기 & 카카오톡 공유 복사 & 저장하기 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-200 transition"
            >
              닫기
            </button>
            {!isCollection && isSettled && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정산완료 상태를 해제하시겠습니까?')) {
                    onClear?.()
                  }
                }}
                className="rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-rose-50 transition"
              >
                정산완료 해제
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyResult}
              className="flex items-center gap-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 px-3.5 py-2.5 text-xs font-bold transition active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-800">복사됨!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>내역 복사</span>
                </>
              )}
            </button>

            {isCollection ? (
              <button
                type="button"
                id="save-collection-btn"
                onClick={handleSaveCollection}
                className="flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-sm active:scale-95 transition"
              >
                <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                <span>회비 걷기 저장하기</span>
              </button>
            ) : (
              <button
                type="button"
                id="save-settlement-btn"
                onClick={handleSaveSettlement}
                className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 text-xs font-bold shadow-sm active:scale-95 transition"
              >
                <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                <span>{isSettled ? '정산 조건 수정 저장' : '정산 완료 및 저장하기'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
