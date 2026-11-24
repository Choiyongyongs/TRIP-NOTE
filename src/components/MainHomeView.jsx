import { Sparkles, Plane, ChevronRight, Sun, CalendarDays, MapPin, Wallet } from 'lucide-react'

export default function MainHomeView({
  tripCount = 0,
  onOpenSecretary,
  onOpenTrips,
}) {
  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* 상단 타이틀 헤더 */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-black tracking-[0.18em] text-indigo-600 uppercase shadow-2xs ring-1 ring-slate-200/90">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            PERSONAL WORKSPACE
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
            최가네 허브
          </h1>
          <p className="text-sm sm:text-base font-medium text-slate-500">
            오늘의 일상 브리핑부터 설레는 여행 계획까지 한 곳에서 관리하세요.
          </p>
        </header>

        {/* 메인 메뉴 2개: 일상 / 여행 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* 1. 일상 (일상 비서 에이전트) */}
          <button
            type="button"
            id="btn-main-secretary"
            onClick={onOpenSecretary}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-7 text-left shadow-sm ring-1 ring-slate-200/90 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:ring-indigo-300 active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Sparkles className="h-7 w-7" />
                </span>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-200/80">
                  AI 비서 대시보드
                </span>
              </div>

              <h2 className="mt-6 text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                일상
              </h2>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                아산시 실시간 날씨·옷차림, 어린이집 식단 기반 저녁 추천, 개인·육아 스케줄, 국내외 경제 시황을 한눈에 확인합니다.
              </p>

              <div className="mt-5 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="rounded-xl bg-slate-100 px-2.5 py-1">AI 브리핑</span>
                <span className="rounded-xl bg-slate-100 px-2.5 py-1">아산시 날씨</span>
                <span className="rounded-xl bg-slate-100 px-2.5 py-1">식단 · 저녁추천</span>
                <span className="rounded-xl bg-slate-100 px-2.5 py-1">경제 시황</span>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-extrabold text-indigo-600">
              <span>일상 비서 열기</span>
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* 2. 여행 (여행 플래너) */}
          <button
            type="button"
            id="btn-main-trips"
            onClick={onOpenTrips}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-7 text-left shadow-sm ring-1 ring-slate-200/90 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 hover:ring-emerald-300 active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Plane className="h-7 w-7 -rotate-12" />
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200/80">
                  플랜 {tripCount}개
                </span>
              </div>

              <h2 className="mt-6 text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                여행
              </h2>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                국내·해외 여행 일정 타임라인, 실시간 코스 지도, 준비물 체크리스트, 가계부 및 1/N 정산까지 한 번에 관리합니다.
              </p>

              <div className="mt-5 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1">
                  <CalendarDays className="h-3 w-3 text-emerald-600" /> 일정 타임라인
                </span>
                <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1">
                  <MapPin className="h-3 w-3 text-rose-500" /> 코스 지도
                </span>
                <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1">
                  <Wallet className="h-3 w-3 text-indigo-500" /> 가계부 · 정산
                </span>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-extrabold text-emerald-600">
              <span>여행 플래너 열기</span>
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
