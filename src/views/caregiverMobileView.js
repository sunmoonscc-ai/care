// 요양보호사용 전용 모바일 뷰 (터치 친화적, 반응형 카드, 어르신 친화적 큰 폰트)
import { saveRequest } from '../services/requestService';

export function renderCaregiverMobileView(container, { rosterData, authState, currentStaffId = 'st_1', navigate }) {
  // 로그인한 사용자의 이메일이나 이름과 일치하는 직원이 있으면 자동 매칭, 없으면 선택된 직원
  let defaultStaff = rosterData.staffList[0];
  if (authState.isLoggedIn && authState.user) {
    const matched = rosterData.staffList.find(s => s.name === authState.user.displayName);
    if (matched) defaultStaff = matched;
  }
  const staff = rosterData.staffList.find(s => s.id === currentStaffId) || defaultStaff;
  const assignments = rosterData.assignments[staff.id] || [];

  // 오늘 날짜 기준 (9월 10일)
  const today = 10;
  const todayAssign = assignments.find(a => a.day === today) || { code: 'B' };
  const tomorrowAssign = assignments.find(a => a.day === today + 1) || { code: 'N1' };

  const getShiftBadge = (code) => {
    if (code === 'B' || code === 'D') return { text: '주간 근무 (B)', badge: 'B', bg: 'bg-emerald-600', textCol: 'text-white', desc: '08:00 ~ 20:00 (식사/기저귀 케어 집중)' };
    if (code === 'N') return { text: '전반야간 (N)', badge: 'N', bg: 'bg-indigo-700', textCol: 'text-white', desc: '23:00 ~ 07:00 (전반 4H 수면휴식)' };
    if (code === 'N1') return { text: '후반야간 (N1)', badge: 'N1', bg: 'bg-indigo-800', textCol: 'text-white', desc: '23:00 ~ 07:00 (후반 4H 수면휴식)' };
    return { text: '휴무 / 비번 (X)', badge: 'X', bg: 'bg-slate-200', textCol: 'text-slate-700', desc: '오늘은 푹 쉬는 날입니다 💤' };
  };

  const todayShift = getShiftBadge(todayAssign.code);
  const tomorrowShift = getShiftBadge(tomorrowAssign.code);

  container.innerHTML = `
    <div class="w-full max-w-lg mx-auto px-4 py-4 space-y-4 font-sans select-none">
      
      <!-- 상단 근무자 선택 및 상태 카드 -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#004349] text-white flex items-center justify-center font-black text-lg shadow-sm">
            ${staff.name.charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-base font-extrabold text-slate-900">${staff.name}님</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">2층 요양</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">늘푸른요양병원 본원</p>
          </div>
        </div>

        <!-- 직원 전환 팝업/셀렉터 -->
        <div class="relative">
          <select id="select-mobile-staff" class="bg-slate-100 text-slate-800 text-xs font-bold py-1.5 px-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600">
            ${rosterData.staffList.map(s => `
              <option value="${s.id}" ${s.id === staff.id ? 'selected' : ''}>${s.name} 변경</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- 1. 오늘 내 근무 (초대형 시인성 카드) -->
      <div class="bg-white rounded-3xl p-6 shadow-sm border-2 border-teal-600/30 text-center space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-400">오늘 (9월 ${today}일)</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">실시간 연동</span>
        </div>

        <div class="py-2">
          <div class="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl ${todayShift.bg} ${todayShift.textCol} shadow-md">
            <span class="text-2xl font-black">${todayShift.text}</span>
          </div>
        </div>

        <p class="text-xs font-medium text-slate-500">${todayShift.desc}</p>
      </div>

      <!-- 2. 내일 내 근무 요약 카드 -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <span class="text-[11px] font-bold text-slate-400 block">내일 (9월 ${today + 1}일)</span>
          <span class="text-sm font-extrabold text-slate-800 mt-0.5 block">${tomorrowShift.text}</span>
        </div>
        <span class="px-3 py-1.5 rounded-xl ${tomorrowShift.bg} ${tomorrowShift.textCol} text-xs font-black shadow-xs">
          ${tomorrowShift.badge}
        </span>
      </div>

      <!-- 3. 모바일 원클릭 액션 버튼 2개 (희망 휴무 / 맞교환) -->
      <div class="grid grid-cols-2 gap-3">
        <button id="btn-mobile-request-off" class="p-4 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-2xl border-2 border-amber-300 shadow-sm flex flex-col items-center justify-center gap-2 transition touch-manipulation">
          <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]">event_busy</span>
          </div>
          <div class="text-center">
            <span class="text-sm font-extrabold text-slate-900 block">희망 휴무 신청</span>
            <span class="text-[10px] text-slate-400">쉬고 싶은 날짜 선택</span>
          </div>
        </button>

        <button id="btn-mobile-request-swap" class="p-4 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-2xl border-2 border-blue-300 shadow-sm flex flex-col items-center justify-center gap-2 transition touch-manipulation">
          <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]">swap_horiz</span>
          </div>
          <div class="text-center">
            <span class="text-sm font-extrabold text-slate-900 block">근무 맞교환 요청</span>
            <span class="text-[10px] text-slate-400">동료와 당번 바꾸기</span>
          </div>
        </button>
      </div>

      <!-- 4. 이번 달 내 전체 근무 캘린더 (터치 스크롤 최적화) -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span class="text-xs font-black text-slate-900">2026년 9월 내 근무 캘린더</span>
          <span class="text-[11px] font-bold text-teal-700">주간 ${staff.fixedD}회 · 야간 ${staff.fixedN}회</span>
        </div>

        <div class="grid grid-cols-7 gap-1.5 text-center text-xs">
          <div class="text-rose-500 font-bold py-1">일</div>
          <div class="text-slate-400 font-bold py-1">월</div>
          <div class="text-slate-400 font-bold py-1">화</div>
          <div class="text-slate-400 font-bold py-1">수</div>
          <div class="text-slate-400 font-bold py-1">목</div>
          <div class="text-slate-400 font-bold py-1">금</div>
          <div class="text-sky-500 font-bold py-1">토</div>

          <!-- 9월 1일 화요일 시작 (일, 월 빈칸) -->
          <div></div><div></div>

          ${assignments.map(a => {
            const isToday = a.day === today;
            const isRed = a.isRequested;
            const isNight = (a.code === 'N' || a.code === 'N1');
            const isOff = (a.code === 'X' || a.code === 'OFF');

            let cellBg = isToday ? 'ring-2 ring-teal-600 bg-teal-50' : 'bg-slate-50';
            if (isNight) cellBg = isToday ? 'ring-2 ring-teal-600 bg-indigo-50' : 'bg-indigo-50/60';

            return `
              <div class="py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 ${cellBg} shadow-xs">
                <span class="text-[10px] font-medium text-slate-400">${a.day}</span>
                <span class="text-xs font-black ${
                  isRed ? 'text-red-600 font-extrabold' : 
                  isNight ? 'text-indigo-900 font-extrabold' : 
                  isOff ? 'text-slate-400' : 'text-slate-800'
                }">
                  ${a.code}
                </span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="pt-2 text-center">
          <span class="text-[10px] text-slate-400">빨간색 글씨는 희망 휴무 또는 사후 대체 변경된 근무입니다.</span>
        </div>
      </div>

    </div>
  `;

  // 직원 전환 이벤트
  container.querySelector('#select-mobile-staff')?.addEventListener('change', (e) => {
    renderCaregiverMobileView(container, { rosterData, authState, currentStaffId: e.target.value, navigate });
  });

  // 희망 휴무 신청 모달/프롬프트
  container.querySelector('#btn-mobile-request-off')?.addEventListener('click', async () => {
    const day = prompt('희망 휴무를 신청할 9월 날짜를 입력하세요 (예: 18):', '18');
    if (!day) return;
    const reason = prompt('신청 사유를 입력하세요 (예: 정기 검진, 집안 행사):', '정기 검진') || '개인 사정';

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

    alert(`✅ [9월 ${day}일] 희망 휴무 신청이 수간호사님께 접수되었습니다!\n승인 시 근무표에 빨간색으로 자동 반영됩니다.`);
  });

  // 맞교환 요청
  container.querySelector('#btn-mobile-request-swap')?.addEventListener('click', () => {
    navigate('requests');
  });
}
