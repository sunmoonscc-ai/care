// 운영 대시보드 뷰
export function renderDashboardView(container, { rosterData, violations, navigate }) {
  const staffCount = rosterData.staffList.length;
  const errorCount = violations.filter(v => v.type === 'error').length;
  const warnCount = violations.filter(v => v.type === 'warning').length;

  container.innerHTML = `
    <div class="px-6 py-6 max-w-7xl mx-auto space-y-6">
      <!-- 헤더 요약 배너 -->
      <div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">정상 가동 중</span>
            <span class="text-sm text-slate-500 font-medium">늘푸른요양병원 본원 · 제2재활병동 (54병상)</span>
          </div>
          <h1 class="text-2xl font-bold text-slate-900 mt-1">오늘의 간병 병동 운영 현황</h1>
          <p class="text-sm text-slate-600 mt-0.5">2026년 11월 7일 (토) · 현재 주간 근무(D) 4명, 비번 1명 순회 중</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="btn-goto-editor" class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#004349] hover:bg-[#0d5c63] text-white text-sm font-semibold rounded-lg shadow-sm transition">
            <span class="material-symbols-outlined text-[18px]">calendar_month</span>
            월간 근무표 편집 바로가기
          </button>
        </div>
      </div>

      <!-- KPI 카드 그리드 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>오늘 출근 인원</span>
            <span class="material-symbols-outlined text-teal-600">groups</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-bold text-slate-900">8명</span>
            <span class="text-xs text-slate-500">/ 총 ${staffCount}명</span>
          </div>
          <div class="mt-2 text-xs text-slate-500 flex gap-2">
            <span>주간 4명</span> · <span>이브닝 2명</span> · <span>야간 2명</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>실시간 규칙 검증</span>
            <span class="material-symbols-outlined text-rose-600">report</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-bold ${errorCount > 0 ? 'text-rose-600' : 'text-emerald-600'}">${errorCount}건</span>
            <span class="text-xs text-amber-600 font-medium">주의 ${warnCount}건</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">11/14 야간 연속 초과 감지됨</p>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>미처리 신청 건수</span>
            <span class="material-symbols-outlined text-blue-600">pending_actions</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-bold text-blue-600">3건</span>
            <span class="text-xs text-slate-500">신규 요청</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">휴무 신청 2건 · 근무 교환 1건</p>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>근무표 확정 디데이</span>
            <span class="material-symbols-outlined text-indigo-600">alarm</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-bold text-slate-900">D-3</span>
            <span class="text-xs text-slate-500">25일 공지 예정</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">현재 버전: v2.4 초안</p>
        </div>
      </div>

      <!-- 근무 교대 현황 & 신청 목록 2열 레이아웃 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 오늘 근무 배정 현황 (2열) -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span class="material-symbols-outlined text-teal-700">schedule</span>
              오늘 시간대별 간병인력 배치
            </h2>
            <span class="text-xs text-slate-500">최소 필요 인원 충족 완료</span>
          </div>

          <div class="space-y-3">
            <div class="p-3 bg-amber-50/60 rounded-lg border border-amber-200/60 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="px-2 py-1 rounded bg-amber-100 text-amber-800 font-bold text-xs">데이 D (07:00~15:00)</span>
                <div>
                  <div class="text-sm font-semibold text-slate-800">박정희(팀장), 최영희(숙련), 이순자, 강옥순</div>
                  <div class="text-xs text-slate-500">집중 간병: 아침 식사 수발, 기저귀 케어, 체위 변경</div>
                </div>
              </div>
              <span class="text-xs font-bold text-amber-700">4명 근무중</span>
            </div>

            <div class="p-3 bg-orange-50/60 rounded-lg border border-orange-200/60 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="px-2 py-1 rounded bg-orange-100 text-orange-800 font-bold text-xs">이브닝 E (15:00~23:00)</span>
                <div>
                  <div class="text-sm font-semibold text-slate-800">조명희, 윤숙자</div>
                  <div class="text-xs text-slate-500">집중 간병: 저녁 투약 지원, 석식 수발, 취침 환경 정돈</div>
                </div>
              </div>
              <span class="text-xs font-bold text-orange-700">2명 대기</span>
            </div>

            <div class="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200/60 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="px-2 py-1 rounded bg-indigo-100 text-indigo-800 font-bold text-xs">나이트 N (23:00~07:00)</span>
                <div>
                  <div class="text-sm font-semibold text-slate-800">김미숙(야간전담), 한선화(숙련)</div>
                  <div class="text-xs text-slate-500">야간 2시간 간격 순회, 낙상 예방 모니터링, 체위 변경</div>
                </div>
              </div>
              <span class="text-xs font-bold text-indigo-700">2명 배정</span>
            </div>
          </div>
        </div>

        <!-- 미처리 신청 및 긴급 알림 (1열) -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span class="material-symbols-outlined text-blue-600">notifications_active</span>
              최근 신청 및 처리 대기
            </h2>
            <button id="btn-goto-requests" class="text-xs text-blue-600 hover:underline">전체보기</button>
          </div>

          <div class="space-y-3">
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div class="flex items-center justify-between font-semibold text-slate-800">
                <span>정미경 ↔ 조명희</span>
                <span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">근무 맞교환</span>
              </div>
              <p class="text-slate-600">11/12(목) D ↔ E 교환 요청 (양측 동의 완료)</p>
              <div class="flex gap-2 pt-1">
                <button class="px-2 py-1 bg-teal-700 text-white rounded font-medium hover:bg-teal-800">승인</button>
                <button class="px-2 py-1 bg-slate-200 text-slate-700 rounded font-medium hover:bg-slate-300">반려</button>
              </div>
            </div>

            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div class="flex items-center justify-between font-semibold text-slate-800">
                <span>강옥순</span>
                <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">희망 휴무</span>
              </div>
              <p class="text-slate-600">11/18(수) 개인 사정 희망 휴무 신청</p>
              <div class="flex gap-2 pt-1">
                <button class="px-2 py-1 bg-teal-700 text-white rounded font-medium hover:bg-teal-800">승인</button>
                <button class="px-2 py-1 bg-slate-200 text-slate-700 rounded font-medium hover:bg-slate-300">반려</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-goto-editor')?.addEventListener('click', () => navigate('editor'));
  container.querySelector('#btn-goto-requests')?.addEventListener('click', () => navigate('requests'));
}

