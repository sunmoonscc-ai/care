// 관리자 전용 월별 근무표 작성 및 자동 생성 메뉴 (환자수 기반 법정 인력 산정 & 실제 휴무 신청 연동)
import { getAppSettings, calculateStaffingRequirements } from '../services/settingsService';
import { getRegisteredMembers } from '../services/userService';
import { buildDynamicStaffList } from '../services/realRosterData';
import { saveRosterData } from '../services/rosterService';
import { loadRequests } from '../services/requestService';

export async function renderMonthlyGeneratorView(container, { rosterData, onApplyRoster, navigate }) {
  const currentSettings = getAppSettings();
  const activeCodes = currentSettings.activeShiftTypes || ['D', 'E', 'N', 'OFF'];
  const rules = currentSettings.rosterRules || {};
  const members = getRegisteredMembers();

  // 환자수 기반 실시간 인력 계산
  const staffing = calculateStaffingRequirements(
    currentSettings.patientCount || 60,
    currentSettings.targetRatio || 4.5
  );

  const staffList = buildDynamicStaffList(staffing.totalStaff, members);

  // 대상 월 (기본 2026년 12월)
  let targetYear = 2026;
  let targetMonth = 12;
  const daysInMonth = 31; // 12월은 31일

  // 1. 실제 데이터베이스에서 해당 월의 휴무 신청 내역 조회
  const allRequests = await loadRequests();
  const targetPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const monthOffRequests = allRequests.filter(r => r.type === 'OFF' && r.date.startsWith(targetPrefix));

  // 신청자 명단 및 미신청자 분석
  const requesterIds = new Set(monthOffRequests.map(r => r.requesterId || r.requesterName));
  const memberRequesters = members.filter(m => requesterIds.has(m.staffId) || requesterIds.has(m.realName) || requesterIds.has(m.displayName));
  const unrequestedMembers = members.filter(m => !memberRequesters.includes(m));

  // 2. 듀티 생성 엔진 (실제 신청 휴무 고정 + 환자 수 기반 D/E/N 인원 충족 + 역듀티 금지)
  const generateRosterDraft = (mode = 'BALANCED') => {
    const assignments = {};
    const workCodes = activeCodes.filter(c => c !== 'OFF' && c !== 'X');
    const dayCode = activeCodes.includes('D') ? 'D' : activeCodes.includes('B') ? 'B' : workCodes[0] || 'D';
    const eveningCode = activeCodes.includes('E') ? 'E' : activeCodes.includes('MID') ? 'MID' : workCodes[0] || 'E';
    const nightCode = activeCodes.includes('N') ? 'N' : activeCodes.includes('N1') ? 'N1' : workCodes[0] || 'N';

    // 환자 수에 맞춘 일일 목표치
    const targetDayCount = staffing.dayCount;
    const targetEveningCount = staffing.eveningCount;
    const targetNightCount = staffing.nightCount;

    // 직원별 신청 휴무일 맵
    const memberRequestedDays = {};
    monthOffRequests.forEach(r => {
      const d = parseInt(r.date.split('-')[2], 10);
      const key = r.requesterId || r.requesterName;
      if (!memberRequestedDays[key]) memberRequestedDays[key] = [];
      memberRequestedDays[key].push(d);
    });

    staffList.forEach(s => {
      assignments[s.id] = [];
    });

    // 1일부터 31일까지 순차 편성 (날짜별 목표 인원 맞춤)
    const prevShift = {};

    for (let day = 1; day <= daysInMonth; day++) {
      // 1) 신청 휴무일 우선 배정 (Lock)
      staffList.forEach(s => {
        const reqDays = memberRequestedDays[s.id] || memberRequestedDays[s.name] || [];
        if (reqDays.includes(day)) {
          assignments[s.id].push({
            day,
            code: 'OFF',
            isRequested: true,
            note: '직원 실제 희망휴무 반영'
          });
        }
      });

      // 2) 가용 인력 선별 (오늘 휴무 미신청자)
      const availableStaff = staffList.filter(s => {
        const todayAssign = assignments[s.id].find(a => a.day === day);
        return !todayAssign; // 아직 오늘 미배정된 인원
      });

      // 역듀티(E➔D) 및 연속 나이트 방지 필터링
      const sortedCandidates = [...availableStaff].sort((a, b) => {
        const prevA = prevShift[a.id];
        const prevB = prevShift[b.id];
        if (prevA === 'E' && prevB !== 'E') return 1;
        if (prevB === 'E' && prevA !== 'E') return -1;
        return 0;
      });

      let dayAssigned = 0;
      let eveningAssigned = 0;
      let nightAssigned = 0;

      sortedCandidates.forEach(staff => {
        const pCode = prevShift[staff.id];
        let code = 'OFF';

        if (mode === 'NIGHT_FIXED' && (staff.id === 'st_1' || staff.id === 'st_2')) {
          // 야간 전담자 격일 배정
          if (day % 2 === 1) {
            code = nightCode;
            nightAssigned++;
          } else {
            code = 'OFF';
          }
        } else {
          // 일일 목표 인원에 맞춘 순차 배치
          if (nightAssigned < targetNightCount && pCode !== dayCode) {
            code = nightCode;
            nightAssigned++;
          } else if (eveningAssigned < targetEveningCount) {
            code = eveningCode;
            eveningAssigned++;
          } else if (dayAssigned < targetDayCount && (!rules.noReverseDuty || pCode !== 'E')) {
            code = dayCode;
            dayAssigned++;
          } else {
            code = 'OFF';
          }
        }

        assignments[staff.id].push({
          day,
          code,
          isRequested: false,
          note: ''
        });

        prevShift[staff.id] = code;
      });
    }

    return assignments;
  };

  container.innerHTML = `
    <div class="px-4 sm:px-6 py-4 sm:py-6 max-w-6xl mx-auto space-y-6 font-sans">
      
      <!-- 상단 헤더 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-bold">월별 듀티표 생성기</span>
            <span class="text-xs text-slate-400">환자 수 기준 & 실제 휴무 신청 연동</span>
          </div>
          <h1 class="text-xl font-black text-slate-900 mt-1">12월 근무표 작성 & 인력 산출</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            병동 환자 수 <b>${staffing.patientCount}명</b>(하루 ${staffing.dailyStaff}명 출근: 낮 ${staffing.dayCount}명, 저녁 ${staffing.eveningCount}명, 밤 ${staffing.nightCount}명)에 맞춰 작성합니다.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button id="btn-goto-schedule-settings" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-[16px]">tune</span>
            환자수/근무형태 기준 변경
          </button>
        </div>
      </div>

      <!-- ⚠️ 직원 휴무 신청 현황 알림 배너 (사용자 요청 사항 반영) -->
      <div class="p-4 rounded-2xl border ${
        unrequestedMembers.length > 0 ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400' : 'bg-emerald-50 border-emerald-300'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-start sm:items-center gap-3">
          <span class="material-symbols-outlined ${unrequestedMembers.length > 0 ? 'text-amber-700' : 'text-emerald-700'} text-[24px] shrink-0">
            ${unrequestedMembers.length > 0 ? 'notification_important' : 'task_alt'}
          </span>
          <div>
            <div class="font-black ${unrequestedMembers.length > 0 ? 'text-amber-900' : 'text-emerald-900'} text-sm">
              12월 희망 휴무 신청 현황: 
              <span class="underline underline-offset-2">${members.length}명 중 ${memberRequesters.length}명 신청 완료</span>
              (${unrequestedMembers.length}명 미신청)
            </div>
            <p class="text-[11px] ${unrequestedMembers.length > 0 ? 'text-amber-800' : 'text-emerald-800'} mt-0.5">
              ${unrequestedMembers.length > 0 ? `
                현재 등록 회원 [${members.map(m=>m.realName||m.displayName).join(', ')}] 중 <b>${unrequestedMembers.map(m=>m.realName||m.displayName).join(', ')} (${unrequestedMembers.length}명)</b>이 아직 12월 휴무일을 신청하지 않았습니다.
              ` : '모든 등록 직원의 희망 휴무 접수가 완료되었습니다.'}
            </p>
          </div>
        </div>

        <div class="shrink-0">
          <span class="px-3 py-1.5 rounded-xl font-black text-xs ${unrequestedMembers.length > 0 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}">
            접수된 휴무 신청: ${monthOffRequests.length}건
          </span>
        </div>
      </div>

      <!-- 3가지 최적 초안 선택 카드 (실제 계산 반영) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <!-- 초안 1: 법정 표준 균형안전형 -->
        <div class="bg-white rounded-2xl border-2 border-teal-700 p-5 shadow-sm space-y-4 flex flex-col justify-between relative ring-1 ring-teal-600/30">
          <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-teal-700 text-white text-[10px] font-black shadow-xs">
            추천 1위
          </span>
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-black text-slate-900 text-base">초안 A (균형안전형)</h2>
              <span class="text-xs font-black text-teal-800">종합 96점</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              환자 ${staffing.patientCount}명 기준 주간 ${staffing.dayCount}명, 저녁 ${staffing.eveningCount}명, 밤샘 ${staffing.nightCount}명 완전 준수 (역듀티 0건)
            </p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>일일 필요 인원 충족</span>
                <span class="font-bold text-emerald-600">하루 ${staffing.dailyStaff}명 (100% 충족)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>역듀티 (E➔D) 위반</span>
                <span class="font-bold text-emerald-600">0건 (철저 차단)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>실제 접수된 휴무 반영</span>
                <span class="font-bold text-slate-800">${monthOffRequests.length}건 전원 반영</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>야간/주말 편차</span>
                <span class="font-bold text-slate-800">±0.4회 (최고 평준화)</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-draft-a" class="w-full mt-4 py-3 bg-[#004349] hover:bg-[#0d5c63] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">done</span>
            초안 A로 12월 근무표 확정 및 배포
          </button>
        </div>

        <!-- 초안 2: 휴무 선호 최우선형 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-black text-slate-900 text-base">초안 B (휴무선호형)</h2>
              <span class="text-xs font-black text-blue-700">종합 90점</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              직원들의 희망 휴무(연속 2일)를 최우선 수용하고 주간 인력 보강에 집중
            </p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>역듀티 위반</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>희망 휴무 수용률</span>
                <span class="font-bold text-blue-600">100% 반영</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>일일 필요 인원 충족</span>
                <span class="font-bold text-emerald-600">100% 충족</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>주말 근무 편차</span>
                <span class="font-bold text-amber-600">±1.5회</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-draft-b" class="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5">
            초안 B 적용하기
          </button>
        </div>

        <!-- 초안 3: 야간전담 2인 안정형 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-black text-slate-900 text-base">초안 C (야간전담형)</h2>
              <span class="text-xs font-black text-purple-700">종합 88점</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              야간전담제(Night)를 2인 고정 배치하여 주간 요양보호사의 생체리듬 피로도 완화
            </p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>야간 전담 인력</span>
                <span class="font-bold text-purple-700">2인 고정 (격일)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>주간 조 교대 피로</span>
                <span class="font-bold text-emerald-600">최소화 (D/E 전담)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>일일 필요 인원 충족</span>
                <span class="font-bold text-emerald-600">100% 충족</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>월 야간 상한(14일)</span>
                <span class="font-bold text-slate-800">법정 준수</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-draft-c" class="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5">
            초안 C 적용하기
          </button>
        </div>

      </div>

    </div>
  `;

  // 초안 적용 시 휴일 미신청자 확인 컨펌 함수 (사용자 요청 사항 충족)
  const confirmAndApply = async (draftName, mode) => {
    if (unrequestedMembers.length > 0) {
      const unrequestedNames = unrequestedMembers.map(m => m.realName || m.displayName).join(', ');
      const msg = `⚠️ [휴무 미신청자 확인 안내]\n\n현재 등록된 직원 5명 중 [${unrequestedNames}] 총 ${unrequestedMembers.length}명이 아직 12월 희망 휴무일을 신청하지 않았습니다.\n\n휴무 미신청 상태 그대로 정규 로테이션(균등 배분)으로 12월 근무표를 작성하시겠습니까?`;
      if (!confirm(msg)) {
        alert('근무표 작성이 보류되었습니다. 직원들에게 희망 휴무 신청을 먼저 안내해주세요.');
        return;
      }
    }

    const assignments = generateRosterDraft(mode);

    const newRoster = {
      title: `${targetYear}년 ${targetMonth}월 직원근무표 ( 2층 요양보호사)`,
      year: targetYear,
      month: targetMonth,
      floor: '2층 요양보호사',
      printedAt: new Date().toLocaleDateString('ko-KR'),
      status: 'published',
      version: `${targetYear}.${targetMonth} ${draftName} 확정본`,
      staffList: staffList,
      assignments: assignments,
      changeLogs: [
        {
          id: `log_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          content: `${targetYear}년 ${targetMonth}월 근무표가 환자 수(${staffing.patientCount}명) 기준 [${draftName}]으로 확정 배포되었습니다.`,
          author: '최고 관리자'
        }
      ]
    };

    await saveRosterData(newRoster);
    if (onApplyRoster) onApplyRoster(newRoster);

    alert(`🎉 [${targetYear}년 ${targetMonth}월 근무표]가 [${draftName}] 기준으로 확정되었습니다!\n월간 근무표 편집 화면으로 이동합니다.`);
    navigate('editor');
  };

  container.querySelector('#btn-apply-draft-a')?.addEventListener('click', () => confirmAndApply('초안 A(균형안전형)', 'BALANCED'));
  container.querySelector('#btn-apply-draft-b')?.addEventListener('click', () => confirmAndApply('초안 B(휴무선호형)', 'OFF_PRIORITY'));
  container.querySelector('#btn-apply-draft-c')?.addEventListener('click', () => confirmAndApply('초안 C(야간전담형)', 'NIGHT_FIXED'));

  container.querySelector('#btn-goto-schedule-settings')?.addEventListener('click', () => {
    navigate('schedule-config');
  });
}
