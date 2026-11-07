// 요양보호사용 전용 모바일 뷰 (터치 친화적, 반응형 카드, 어르신 친화적 큰 폰트)
import { openMobileRequestModal } from './mobileRequestModal';

export function renderCaregiverMobileView(container, { rosterData, authState, navigate }) {
  const userProfile = authState.userProfile;
  const isGuest = userProfile?.role === 'GUEST'; // 임시회원: 둘러보기만 가능
  const isAssociate = userProfile?.role === 'ASSOCIATE'; // 준회원
  const isRegular = userProfile?.role === 'REGULAR'; // 정회원
  const isAdmin = authState.isAdmin;

  // 1. 등록된 본인의 직원 정보만 확인 (다른 더미 직원으로 무단 변경 불가)
  // 관리자가 승인 시 매핑해 준 staffId가 있으면 그것만 고정 사용
  let myStaff = null;
  if (userProfile && userProfile.staffId) {
    myStaff = rosterData.staffList.find(s => s.id === userProfile.staffId);
  }

  // 매핑 정보가 없으면 이름 매칭 시도, 임시회원(GUEST)인 경우 첫 번째 직원 기본 둘러보기
  if (!myStaff) {
    if (authState.isLoggedIn && authState.user) {
      myStaff = rosterData.staffList.find(s => s.name === authState.user.displayName);
    }
    if (!myStaff) {
      myStaff = rosterData.staffList[0];
    }
  }

  const staff = myStaff;
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
      
      <!-- 상단 본인 프로필 카드 (더미 직원 임의 선택 불가) -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#004349] text-white flex items-center justify-center font-black text-lg shadow-sm">
            ${staff.name.charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-base font-extrabold text-slate-900">${staff.name}님</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isRegular ? 'bg-emerald-100 text-emerald-800' :
                isAssociate ? 'bg-blue-100 text-blue-800' :
                isGuest ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
              }">
                ${isRegular ? '정회원' : isAssociate ? '준회원' : isGuest ? '임시회원 (둘러보기)' : '요양보호사'}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">늘푸른요양병원 2층 병동 (${staff.role || '요양보호사'})</p>
          </div>
        </div>

        <!-- 관리자인 경우에만 다른 직원 근무표 교차 조회 가능 -->
        ${isAdmin ? `
          <select id="select-admin-switch-staff" class="bg-slate-100 text-slate-800 text-xs font-bold py-1.5 px-2 rounded-xl border border-slate-300">
            ${rosterData.staffList.map(s => `
              <option value="${s.id}" ${s.id === staff.id ? 'selected' : ''}>[관리자] ${s.name}</option>
            `).join('')}
          </select>
        ` : `
          <span class="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg">내 전용 근무</span>
        `}
      </div>

      ${isGuest ? `
        <!-- 임시회원 안내 배너 -->
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-xs text-amber-900">
          <span class="material-symbols-outlined text-[18px] text-amber-600 shrink-0">visibility</span>
          <span>현재 <b>임시회원(둘러보기)</b> 권한으로 접속 중입니다. 근무표 열람만 가능하며, 휴무/교환 신청은 관리자의 정회원 승인 후 활성화됩니다.</span>
        </div>
      ` : ''}

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

      <!-- 3. 모바일 원클릭 액션 버튼 2개 (정회원/준회원만 활성화, 임시회원은 안내) -->
      <div class="grid grid-cols-2 gap-3">
        <button id="btn-mobile-request-off" class="p-4 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-2xl border-2 border-amber-300 shadow-sm flex flex-col items-center justify-center gap-2 transition touch-manipulation ${isGuest ? 'opacity-50' : ''}">
          <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]">event_busy</span>
          </div>
          <div class="text-center">
            <span class="text-sm font-extrabold text-slate-900 block">희망 휴무 신청</span>
            <span class="text-[10px] text-slate-400">${isGuest ? '정회원 승인 필요' : '쉬고 싶은 날짜 선택'}</span>
          </div>
        </button>

        <button id="btn-mobile-request-swap" class="p-4 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-2xl border-2 border-blue-300 shadow-sm flex flex-col items-center justify-center gap-2 transition touch-manipulation ${isGuest ? 'opacity-50' : ''}">
          <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]">swap_horiz</span>
          </div>
          <div class="text-center">
            <span class="text-sm font-extrabold text-slate-900 block">근무 맞교환 요청</span>
            <span class="text-[10px] text-slate-400">${isGuest ? '정회원 승인 필요' : '동료와 당번 바꾸기'}</span>
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
      </div>

    </div>
  `;

  // 관리자 전용 직원 전환
  container.querySelector('#select-admin-switch-staff')?.addEventListener('change', (e) => {
    authState.userProfile.staffId = e.target.value;
    renderCaregiverMobileView(container, { rosterData, authState, navigate });
  });

  // 희망 휴무 신청 모달 (임시회원 차단)
  container.querySelector('#btn-mobile-request-off')?.addEventListener('click', () => {
    if (isGuest) {
      alert('⚠️ 임시회원은 둘러보기 전용입니다. 희망 휴무 신청을 원하시면 관리자에게 정회원/준회원 승인을 요청하세요.');
      return;
    }
    openMobileRequestModal({
      rosterData,
      staff,
      type: 'OFF',
      onComplete: () => {
        renderCaregiverMobileView(container, { rosterData, authState, navigate });
      }
    });
  });

  // 맞교환 요청 모달 (임시회원 차단)
  container.querySelector('#btn-mobile-request-swap')?.addEventListener('click', () => {
    if (isGuest) {
      alert('⚠️ 임시회원은 둘러보기 전용입니다. 맞교환 요청을 원하시면 관리자에게 정회원/준회원 승인을 요청하세요.');
      return;
    }
    openMobileRequestModal({
      rosterData,
      staff,
      type: 'SWAP',
      onComplete: () => {
        renderCaregiverMobileView(container, { rosterData, authState, navigate });
      }
    });
  });
}
