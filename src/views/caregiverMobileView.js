// 요양보호사용 전용 모바일 뷰 (기획안 2장, 6장: 큰 글씨, 버튼 3개 이내, 직관적 내 근무 조회)
import { realShiftTypes } from '../services/realRosterData';
import { saveRequest } from '../services/requestService';

export function renderCaregiverMobileView(container, { rosterData, authState, currentStaffId = 'st_1', navigate }) {
  const staff = rosterData.staffList.find(s => s.id === currentStaffId) || rosterData.staffList[0];
  const assignments = rosterData.assignments[staff.id] || [];

  // 오늘 날짜 기준 (예: 9월 10일)
  const today = 10;
  const todayAssign = assignments.find(a => a.day === today) || { code: 'B' };
  const tomorrowAssign = assignments.find(a => a.day === today + 1) || { code: 'N1' };

  const getShiftBadge = (code) => {
    if (code === 'B' || code === 'D') return { text: '주간 (Day)', bg: 'bg-blue-600', textCol: 'text-white', desc: '08:00 ~ 20:00 (식사/기저귀 케어)' };
    if (code === 'N') return { text: '전반야 (Night)', bg: 'bg-indigo-700', textCol: 'text-white', desc: '23:00 ~ 07:00 (전반 4H 휴식)' };
    if (code === 'N1') return { text: '후반야 (Night1)', bg: 'bg-indigo-800', textCol: 'text-white', desc: '23:00 ~ 07:00 (후반 4H 휴식)' };
    return { text: '휴무 / 비번 (Off)', bg: 'bg-slate-200', textCol: 'text-slate-800', desc: '충분한 휴식을 취하세요' };
  };

  const todayShift = getShiftBadge(todayAssign.code);
  const tomorrowShift = getShiftBadge(tomorrowAssign.code);

  container.innerHTML = `
    <div class="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-16 font-sans">
      <!-- 모바일 상단 바 -->
      <div class="bg-[#004349] text-white p-4 flex items-center justify-between shadow">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center font-bold text-base">
            ${staff.name.charAt(0)}
          </div>
          <div>
            <h1 class="text-base font-bold">${staff.name} 요양보호사님</h1>
            <p class="text-[11px] text-teal-100">늘푸른요양병원 2층 병동</p>
          </div>
        </div>
        <!-- 직원 전환 셀렉터 -->
        <select id="select-mobile-staff" class="bg-teal-900 text-white text-xs px-2 py-1 rounded border border-teal-700 focus:outline-none">
          ${rosterData.staffList.map(s => `
            <option value="${s.id}" ${s.id === staff.id ? 'selected' : ''}>${s.name}</option>
          `).join('')}
        </select>
      </div>

      <!-- 공지 배너 -->
      <div class="bg-amber-100 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-900">
        <span class="material-symbols-outlined text-[18px] text-amber-700">campaign</span>
        <span><b>2026년 9월 확정 근무표</b>가 배포되었습니다.</span>
      </div>

      <div class="p-4 space-y-4 flex-1">
        <!-- 1. 오늘 내 근무 (초대형 카드) -->
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 text-center space-y-3">
          <div class="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>오늘 근무 (9월 ${today}일)</span>
            <span class="text-teal-700">실시간 반영됨</span>
          </div>
          <div class="py-2">
            <span class="inline-block px-5 py-2.5 rounded-xl ${todayShift.bg} ${todayShift.textCol} text-2xl font-black shadow-sm tracking-wide">
              ${todayShift.text}
            </span>
          </div>
          <p class="text-xs text-slate-600 font-medium">${todayShift.desc}</p>
        </div>

        <!-- 2. 내일 내 근무 -->
        <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div class="text-left">
            <span class="text-xs text-slate-400 block font-medium">내일 근무 (9월 ${today + 1}일)</span>
            <span class="text-base font-bold text-slate-800">${tomorrowShift.text}</span>
          </div>
          <span class="px-3 py-1 rounded-lg ${tomorrowShift.bg} ${tomorrowShift.textCol} text-xs font-bold">
            ${tomorrowAssign.code}
          </span>
        </div>

        <!-- 3. 원클릭 3대 행동 버튼 (연령대 높은 요양보호사 배려) -->
        <div class="grid grid-cols-2 gap-3 pt-2">
          <button id="btn-mobile-request-off" class="p-4 bg-white hover:bg-slate-50 border-2 border-teal-600 rounded-xl shadow-sm flex flex-col items-center justify-center gap-1.5 transition">
            <span class="material-symbols-outlined text-[28px] text-teal-700">event_busy</span>
            <span class="text-sm font-extrabold text-slate-900">희망 휴무 신청</span>
            <span class="text-[10px] text-slate-500">원하는 날짜 쉬기</span>
          </button>

          <button id="btn-mobile-request-swap" class="p-4 bg-white hover:bg-slate-50 border-2 border-blue-600 rounded-xl shadow-sm flex flex-col items-center justify-center gap-1.5 transition">
            <span class="material-symbols-outlined text-[28px] text-blue-700">swap_horiz</span>
            <span class="text-sm font-extrabold text-slate-900">근무 맞교환 요청</span>
            <span class="text-[10px] text-slate-500">동료와 당번 바꾸기</span>
          </button>
        </div>

        <!-- 4. 이번 달 내 전체 근무 캘린더 미니뷰 -->
        <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div class="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
            <span>2026년 9월 내 달력 (총 30일)</span>
            <span class="text-teal-700">주간 ${staff.fixedD}회 · 야간 ${staff.fixedN}회</span>
          </div>

          <div class="grid grid-cols-7 gap-1 text-center text-xs">
            <span class="text-red-500 font-bold py-1">일</span>
            <span class="text-slate-500 py-1">월</span>
            <span class="text-slate-500 py-1">화</span>
            <span class="text-slate-500 py-1">수</span>
            <span class="text-slate-500 py-1">목</span>
            <span class="text-slate-500 py-1">금</span>
            <span class="text-blue-500 font-bold py-1">토</span>

            <div></div><div></div>

            ${assignments.map(a => {
              const isToday = a.day === today;
              const isRed = a.isRequested;
              return `
                <div class="py-1.5 rounded flex flex-col items-center justify-center ${isToday ? 'ring-2 ring-teal-600 bg-teal-50' : 'bg-slate-50'}">
                  <span class="text-[10px] text-slate-400">${a.day}</span>
                  <span class="text-xs font-black ${isRed ? 'text-red-600' : 'text-slate-800'}">
                    ${a.code}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // 직원 전환 이벤트
  container.querySelector('#select-mobile-staff')?.addEventListener('change', (e) => {
    renderCaregiverMobileView(container, { rosterData, authState, currentStaffId: e.target.value, navigate });
  });

  // 희망 휴무 신청
  container.querySelector('#btn-mobile-request-off')?.addEventListener('click', async () => {
    const day = prompt('희망 휴무를 신청할 날짜(일자)를 입력하세요 (예: 18):', '18');
    if (!day) return;
    const reason = prompt('신청 사유를 입력하세요 (예: 병원 정기검진):', '병원 정기검진') || '개인 사정';

    await saveRequest({
      type: 'OFF',
      typeName: '희망 휴무(OFF)',
      requesterId: staff.id,
      requesterName: staff.name,
      targetId: '',
      targetName: '-',
      date: `2026-09-${day.padStart(2, '0')}`,
      fromShift: 'B',
      toShift: 'X',
      reason: reason,
      status: 'PENDING_ADMIN',
      statusText: '관리자 승인 대기중'
    });

    alert(`✅ [9월 ${day}일] 희망 휴무 신청이 관리자(수간호사님)께 접수되었습니다!\n관리자 승인 즉시 근무표에 빨간색으로 자동 반영됩니다.`);
  });

  // 근무 맞교환 신청
  container.querySelector('#btn-mobile-request-swap')?.addEventListener('click', () => {
    navigate('requests');
  });
}
