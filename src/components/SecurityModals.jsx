import { useState } from 'react'
import {
  Lock,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  X,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  getStoredPasscode,
  verifyAndSaveOwnerAuth,
  clearOwnerAuth,
  buildTripShareUrl,
  copyTextToClipboard,
  generateDeterministicKey,
} from '../services/securityService'
import { savePasscodeToSupabase } from '../services/supabaseService'

/**
 * 1. 외부인 접속 차단 잠금 화면 (프라이빗 게이트)
 */
export function SecurityLockScreen({
  onUnlockSuccess,
  sharedTripTitle = null,
  onReturnToSharedTrip = null,
}) {
  const [inputCode, setInputCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const currentPasscode = getStoredPasscode()
    if (verifyAndSaveOwnerAuth(inputCode, currentPasscode, remember)) {
      setError('')
      onUnlockSuccess()
    } else {
      setError('입장 비밀번호가 일치하지 않습니다. 초대받은 지인은 전달받은 전용 공유 링크로 접속해주세요.')
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl ring-1 ring-slate-200/90">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black tracking-wider text-indigo-700 ring-1 ring-indigo-200/80 uppercase">
            PRIVATE TRIP NOTE
          </span>
          <h1 className="mt-2.5 text-xl sm:text-2xl font-black text-slate-900">
            프라이빗 여행 플래너
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            개인 및 초대된 지인 전용 공간입니다.
            <br />
            전체 플랜 목록을 보려면 <strong className="text-slate-700">입장 비밀번호</strong>를 입력해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              입장 비밀번호
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value)
                  if (error) setError('')
                }}
                placeholder="비밀번호 입력"
                autoFocus
                className="w-full rounded-2xl border-0 bg-slate-100 px-4 py-3 pr-11 text-sm font-bold text-slate-900 ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                title={showPassword ? '숨기기' : '보기'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 ring-1 ring-rose-200">
                {error}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>내 기기(PC/스마트폰)에서 자동 잠금 해제 유지</span>
          </label>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-black text-white shadow-md shadow-indigo-500/25 transition active:scale-[0.99]"
          >
            <ShieldCheck className="h-4.5 w-4.5" />
            잠금 해제하기
          </button>
        </form>

        {sharedTripTitle && onReturnToSharedTrip && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onReturnToSharedTrip}
              className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 py-2.5 text-xs font-extrabold text-slate-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              공유받은 &lsquo;{sharedTripTitle}&rsquo; 플랜으로 돌아가기
            </button>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500 ring-1 ring-slate-200/70 space-y-1">
          <p className="font-bold text-slate-700">🔒 보안 안내</p>
          <p>• 검색 로봇(구글·네이버 등) 노출이 전면 차단되어 있습니다.</p>
          <p>• 지인에게는 개별 여행 플랜 상단의 <strong>&lsquo;링크 복사&rsquo;</strong> 버튼으로 공유하세요.</p>
        </div>
      </div>
    </div>
  )
}

/**
 * 2. 보안 설정 및 공유 링크 관리 모달
 */
export function SecuritySettingsModal({
  open,
  onClose,
  currentTrip = null,
  onRegenerateShareKey = null,
  onLockNow = null,
}) {
  const [newPasscode, setNewPasscode] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [regenDone, setRegenDone] = useState(false)

  if (!open) return null

  const shareUrl = currentTrip ? buildTripShareUrl(currentTrip) : ''

  const handleSavePasscode = async (e) => {
    e.preventDefault()
    const clean = newPasscode.trim()
    if (clean.length < 4) {
      setSavedMsg('⚠️ 비밀번호는 최소 4자리 이상 입력해주세요.')
      return
    }
    await savePasscodeToSupabase(clean)
    setNewPasscode('')
    setSavedMsg('✅ 새 입장 비밀번호가 저장 및 클라우드에 동기화되었습니다!')
    setTimeout(() => setSavedMsg(''), 3500)
  }

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return
    const ok = await copyTextToClipboard(shareUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleRegenerate = () => {
    if (!currentTrip || !onRegenerateShareKey) return
    if (
      confirm(
        '공유 링크 보안키를 새로 발급하시겠습니까?\n재발급하면 이전에 복사해 둔 링크로는 더 이상 접속할 수 없게 됩니다.'
      )
    ) {
      const nextKey = generateDeterministicKey(`${currentTrip.id}-${Date.now()}`)
      onRegenerateShareKey(nextKey)
      setRegenDone(true)
      setTimeout(() => setRegenDone(false), 2500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900">프라이빗 보안 & 공유 설정</h3>
              <p className="text-[11px] font-medium text-slate-500">
                개인 및 지인 전용 보호 설정
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 pt-4">
          {/* 현재 여행 플랜 전용 공유 링크 섹션 (상세 페이지에서 열었을 때) */}
          {currentTrip && (
            <div className="rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-950">
                  🔗 &lsquo;{currentTrip.title}&rsquo; 지인 초대 링크
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                  타 플랜 열람 자동 차단
                </span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                이 링크를 전달받은 지인은 비밀번호 입력 없이 <strong>이 여행 플랜에만 바로 접속</strong>할 수 있으며, 다른 개인 여행 플랜 목록은 볼 수 없습니다.
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-xl bg-white px-3 py-2 text-[11px] font-mono text-slate-600 ring-1 ring-indigo-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-white shadow-xs transition active:scale-95 ${
                    copied ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-indigo-700 font-semibold">
                  {regenDone ? '✅ 새 보안 링크가 발급되었습니다!' : '혹시 링크가 잘못 유출되었나요?'}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/90 hover:bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-indigo-200 transition active:scale-95"
                >
                  <RefreshCw className="h-3 w-3 text-indigo-600" />
                  공유 링크 재발급 (기존 링크 차단)
                </button>
              </div>
            </div>
          )}

          {/* 관리자 입장 비밀번호 변경 */}
          <form onSubmit={handleSavePasscode} className="space-y-2.5">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
              <KeyRound className="h-4 w-4 text-indigo-600" />
              관리자(본인) 입장 비밀번호 변경
            </label>
            <p className="text-[11px] text-slate-500">
              메인 사이트 접속 및 전체 여행 플랜 목록을 열람할 때 사용하는 비밀번호입니다. (현재 설정값: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-indigo-700">{getStoredPasscode()}</code>)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="새 비밀번호 입력 (4자리 이상)"
                className="flex-1 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-2xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-black text-white transition active:scale-95"
              >
                변경 저장
              </button>
            </div>
            {savedMsg && (
              <p className="text-xs font-bold text-indigo-600">{savedMsg}</p>
            )}
          </form>

          {/* 적용된 보안 항목 요약 */}
          <div className="rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600 ring-1 ring-slate-200/80 space-y-1.5">
            <p className="font-extrabold text-slate-800">🛡️ 현재 활성화된 보안 보호</p>
            <ul className="space-y-1 text-[11px] text-slate-500">
              <li>• <strong>외부인 접속 차단:</strong> 비밀번호 없이는 전체 여행 목록 접근 불가</li>
              <li>• <strong>지인 단독 공유 모드:</strong> 복사한 링크로 접속한 지인은 해당 플랜만 열람 가능</li>
              <li>• <strong>검색엔진 노출 방지:</strong> 구글·네이버 로봇 수집 차단 (noindex, robots.txt)</li>
              <li>• <strong>플랜 삭제 보호:</strong> 관리자 인증 상태에서만 여행 플랜 삭제 가능</li>
            </ul>
          </div>

          {/* 기기 즉시 잠금 버튼 */}
          {onLockNow && (
            <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">공용 PC를 사용 중이신가요?</span>
              <button
                type="button"
                onClick={() => {
                  clearOwnerAuth()
                  onClose()
                  onLockNow()
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600 ring-1 ring-rose-200 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                이 기기에서 즉시 잠금
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
