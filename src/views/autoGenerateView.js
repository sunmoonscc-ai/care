// 자동 생성 및 규칙 시뮬레이션 비교 뷰 (기획안 4장 및 화면 1 기반)
import { generateInitialRoster } from '../services/mockData';

export function renderAutoGenerateView(container, { rosterData, onApplyRoster, navigate }) {
  container.innerHTML = `
    <div class="px-6 py-6 max-w-7xl mx-auto space-y-6">
      <div class="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 class="text-xl font-bold text-slate-900">근무표 자동 생성 및 초안 규칙 비교</h1>
          <p class="text-xs text-slate-500 mt-1">3교대 제약 충족 솔버를 기반으로 법정 기준, 인원 공백, 선호 휴무를 고려한 3가지 최적 초안을 생성했습니다.</p>
        </div>
        <button id="btn-regenerate" class="px-3.5 py-2 bg-[#004349] hover:bg-[#0d5c63] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition">
          <span class="material-symbols-outlined text-[16px]">refresh</span>
          솔버 다시 돌리기
        </button>
      </div>

      <!-- 시뮬레이션 카드 3종 비교 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- 초안 A: 법정 준수 최적형 -->
        <div class="bg-white rounded-xl border-2 border-teal-600 p-5 shadow-sm space-y-4 relative flex flex-col justify-between">
          <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-bold">
            추천 1위
          </span>
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-900 text-base">초안 A (균형안전형)</h2>
              <span class="text-xs font-bold text-teal-700">종합 점수 94점</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">법정 근무시간 엄수, 나이트 2일 상한, 주말 근무 편차 ±1회 이내 균등 배분</p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>법정 규칙 위반</span>
                <span class="font-bold text-emerald-600">0건 (완전 준수)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>희망 휴무 반영률</span>
                <span class="font-bold text-slate-800">92% (23건 중 21건 반영)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>주말/야간 편차</span>
                <span class="font-bold text-slate-800">±0.5회 (최고 수준 평준화)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>최소 필요 인원 미달</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-a" class="w-full mt-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg transition">
            이 초안으로 근무표 적용하기
          </button>
        </div>

        <!-- 초안 B: 휴무 희망 극대화형 -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-900 text-base">초안 B (선호우선형)</h2>
              <span class="text-xs font-bold text-blue-700">종합 점수 88점</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">요양보호사 희망 휴무 신청을 100% 반영한 대신 주말 근무 편차가 일부 발생</p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>법정 규칙 위반</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>희망 휴무 반영률</span>
                <span class="font-bold text-blue-600">100% (23건 전원 수용)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>주말/야간 편차</span>
                <span class="font-bold text-amber-600">±2회 (일부 직원 주말 집중)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>최소 필요 인원 미달</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-b" class="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition">
            초안 B 적용하기
          </button>
        </div>

        <!-- 초안 C: 숙련자 집중 배치형 -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-900 text-base">초안 C (숙련안정형)</h2>
              <span class="text-xs font-bold text-indigo-700">종합 점수 86점</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">시간대별(D/E/N) 경력 5년 이상 숙련자를 1명 이상 상시 배치하여 환자 케어 품질 최적화</p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>법정 규칙 위반</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>희망 휴무 반영률</span>
                <span class="font-bold text-slate-800">87%</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>숙련자 배치 충족율</span>
                <span class="font-bold text-indigo-600">100% 충족</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>최소 필요 인원 미달</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-c" class="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition">
            초안 C 적용하기
          </button>
        </div>
      </div>
    </div>
  `;

  const handleApply = (draftName) => {
    // 자동 생성된 클린 초안 적용 (김미숙 4연속 나이트 등을 해소한 정규 패턴)
    const newAssignments = generateInitialRoster(2026, 11);
    // 김미숙 나이트 조정 (최대 2연속으로 안전화)
    newAssignments['staff_2'].forEach(a => {
      if (a.day === 14) a.code = 'O';
      if (a.day === 13) a.code = 'N';
      if (a.day === 12) a.code = 'N';
      if (a.day === 11) a.code = 'O';
    });

    const updated = {
      ...rosterData,
      version: `${draftName} 적용본`,
      assignments: newAssignments
    };
    onApplyRoster(updated);
    alert(`✅ [${draftName}]이 성공적으로 반영되었습니다. 월간 근무표 편집 화면으로 이동합니다.`);
    navigate('editor');
  };

  container.querySelector('#btn-apply-a')?.addEventListener('click', () => handleApply('초안 A(균형안전형)'));
  container.querySelector('#btn-apply-b')?.addEventListener('click', () => handleApply('초안 B(선호우선형)'));
  container.querySelector('#btn-apply-c')?.addEventListener('click', () => handleApply('초안 C(숙련안정형)'));
  container.querySelector('#btn-regenerate')?.addEventListener('click', () => {
    alert('🔄 제약 충족 최적화 엔진이 재가동되어 3개 초안이 새롭게 계산되었습니다.');
  });
}

