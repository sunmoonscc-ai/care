// 요양보호사용 전용 모바일 뷰 (터치 친화적, 반응형 카드, 어르신 친화적 큰 폰트)
import { openMobileRequestModal } from './mobileRequestModal';
import { loadRequests } from '../services/requestService';

export async function renderCaregiverMobileView(container, { rosterData, authState, navigate }) {
  const userProfile = authState.userProfile;
  const isGuest = userProfile?.role === 'GUEST'; // 임시회원: 둘러보기만 가능
  const isAssociate = userProfile?.role === 'ASSOCIATE'; // 준회원
  const isRegular = userProfile?.role === 'REGULAR'; // 정회원
  const isAdmin = authState.isAdmin;

  // 1. 등록된 본인의 직원 정보만 확인 (다른 더미 직원으로 무단 매핑 방지)
  // 우선순위 1: 관리자가 승인 시 매핑해 준 staffId가 있는 경우
  let myStaff = null;
  if (userProfile && userProfile.staffId) {
    myStaff = rosterData.staffList.find(s => s.id === userProfile.staffId);
  }

  // 우선순위 2: 이메일로 등록된 직원 매칭 (가장 확실함)
  if (!myStaff && authState.user?.email) {
    const userEmail = authState.user.email.toLowerCase();
    myStaff = rosterData.staffList.find(s => s.email && s.email.toLowerCase() === userEmail);
  }

  // 우선순위 3: 사용자 입력 실명(realName) 또는 구글 표시명(displayName)으로 매칭
  if (!myStaff && (userProfile?.realName || userProfile?.displayName || authState.user?.displayName)) {
    const myName = (userProfile?.realName || userProfile?.displayName || authState.user?.displayName).trim();
    myStaff = rosterData.staffList.find(s => s.name === myName);
  }

  // 우선순위 4: 그래도 매칭되지 않는 경우 (신규 미승인자 또는 게스트)
  // 임의로 1번 직원(김은정)으로 덮어쓰지 않고, 본인의 프로필 정보로 가상 직원을 구성
  if (!myStaff) {
    const fallbackName = userProfile?.realName || userProfile?.displayName || authState.user?.displayName || '요양보호사';
    myStaff = {
      id: userProfile?.staffId || `user_${authState.user?.uid || 'guest'}`,
      name: fallbackName,
      role: isRegular ? '요양보호사(정회원)' : isAssociate ? '요양보호사(준회원)' : '요양보호사(대기)',
      email: authState.user?.email || userProfile?.email || '',
      phoneNumber: userProfile?.phoneNumber || '',
      fixedD: 10,
      fixedN: 7
    };
  }

  // 본인의 실명(realName)이 있으면 화면 이름은 무조건 본인 실제 등록 이름 우선 표기
  const displayName = userProfile?.realName || userProfile?.displayName || authState.user?.displayName || myStaff.name;

  // 최종 staff 정보 (email과 phoneNumber 확실히 포함)
  const staff = {
    ...myStaff,
    email: myStaff.email || authState.user?.email || userProfile?.email || '',
    phoneNumber: myStaff.phoneNumber || userProfile?.phoneNumber || ''
  };
  const assignments = rosterData.assignments[staff.id] || rosterData.assignments['st_1'] || [];

  // 실제 현재 시스템 날짜 기준 (2026년 11월 10일)
  const nowDate = new Date();
  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth() + 1; // 11월
  const todayDay = nowDate.getDate(); // 10일
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const todayWeekName = weekDayNames[nowDate.getDay()]; // 화

  const tomorrowDate = new Date(nowDate);
  tomorrowDate.setDate(todayDay + 1);
  const tomorrowDay = tomorrowDate.getDate();
  const tomorrowWeekName = weekDayNames[tomorrowDate.getDay()];

  // 오늘 및 내일 근무 할당 조회
  const todayAssign = assignments.find(a => a.day === todayDay) || { code: 'B' };
  const tomorrowAssign = assignments.find(a => a.day === tomorrowDay) || { code: 'N1' };

  const getShiftBadge = (code) => {
    if (code === 'D') return { text: '주간 Day (D)', badge: 'D', bg: 'bg-emerald-600', textCol: 'text-white', desc: '07:00 ~ 15:00 (식사/회진/투약 케어 집중)' };
    if (code === 'E') return { text: '저녁 Evening (E)', badge: 'E', bg: 'bg-teal-600', textCol: 'text-white', desc: '15:00 ~ 23:00 (저녁 수발 및 취침 준비)' };
    if (code === 'B') return { text: '주간 종일 (B)', badge: 'B', bg: 'bg-emerald-600', textCol: 'text-white', desc: '08:00 ~ 20:00 (식사/기저귀 케어 집중)' };
    if (code === 'N') return { text: '야간 Night (N)', badge: 'N', bg: 'bg-indigo-700', textCol: 'text-white', desc: '23:00 ~ 07:00 (수면관리/낙상 순찰 집중)' };
    if (code === 'N1') return { text: '후반야간 (N1)', badge: 'N1', bg: 'bg-indigo-800', textCol: 'text-white', desc: '23:00 ~ 07:00 (후반 4H 수면휴식 분담)' };
    return { text: '휴무 / 비번 (OFF)', badge: 'OFF', bg: 'bg-slate-200', textCol: 'text-slate-700', desc: '오늘은 푹 쉬는 날입니다 💤' };
  };

  const todayShift = getShiftBadge(todayAssign.code);
  const tomorrowShift = getShiftBadge(tomorrowAssign.code);

  // 2. 내가 신청한 12월 희망 휴무 내역 실시간 조회
  const allReqs = await loadRequests();
  const myOffReqs = allReqs.filter(r =>
    r.type === 'OFF' &&
    (r.requesterId === staff.id || r.requesterName === displayName || (authState.user?.email && r.requesterEmail === authState.user.email)) &&
    r.date && r.date.startsWith('2026-12')
  );

  // 설정에서 maxOffDays 로드 (기본 2)
  const settings = await import('../services/settingsService').then(m => m.getAppSettings());
  const maxOffDays = settings.monthlyOffLimit || 2;

  // 각 신청의 rank 필드를 사용하여 복원 (단순 로직)
  const myRanks = { 1: [], 2: [], 3: [] };
  myOffReqs.forEach(r => {
    const day = parseInt(r.date.split('-')[2], 10);
    const rank = r.rank || 1;
    if (myRanks[rank] && !myRanks[rank].includes(day)) {
      myRanks[rank].push(day);
    }
  });

  // 각 순위별 maxOffDays 제한
  Object.keys(myRanks).forEach(rank => {
    if (myRanks[rank].length > maxOffDays) {
      myRanks[rank] = myRanks[rank].slice(0, maxOffDays);
    }
  });

  const hasMyRequests = myRanks[1].length > 0 || myRanks[2].length > 0 || myRanks[3].length > 0;

  // 요일 구하기 헬퍼
  const getDayWeekName = (y, m, d) => {
    return weekDayNames[new Date(y, m - 1, d).getDay()];
  };

  const formatRankList = (days, rankName, colorClass) => {
    if (!days || days.length === 0) return '';
    const sorted = [...days].sort((a,b)=>a-b);
    return `
      <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
        <span class="font-extrabold ${colorClass} flex items-center gap-1">
          <span class="w-2 h-2 rounded-full ${colorClass.replace('text-', 'bg-')} inline-block"></span>
          ${rankName}
        </span>
        <span class="font-black text-slate-800">
          ${sorted.map(d => `${d}일(${getDayWeekName(2026, 12, d)})`).join(', ')}
        </span>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="w-full max-w-lg mx-auto px-4 py-4 space-y-4 font-sans select-none pb-20">
      
      <!-- 상단 본인 프로필 카드 (더미 직원 임의 선택 불가) -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#004349] text-white flex items-center justify-center font-black text-lg shadow-sm">
            ${displayName.charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-base font-extrabold text-slate-900">${displayName}님</span>
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
        ` : ''}
      </div>

      ${isGuest ? `
        <!-- 임시회원 안내 배너 -->
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-xs text-amber-900">
          <span class="material-symbols-outlined text-[18px] text-amber-600 shrink-0">visibility</span>
          <span>현재 <b>임시회원(둘러보기)</b> 권한으로 접속 중입니다. 근무표 열람만 가능하며, 휴무/교환 신청은 관리자의 정회원 승인 후 활성화됩니다.</span>
        </div>
      ` : ''}

      <!-- 1. 오늘 내 근무 (실제 오늘 날짜 11월 10일 반영) -->
      <div class="bg-white rounded-3xl p-6 shadow-sm border-2 border-teal-600/30 text-center space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-teal-700 text-[18px]">calendar_today</span>
            <span class="text-xs font-black text-slate-700">오늘 (${currentMonth}월 ${todayDay}일 ${todayWeekName}요일)</span>
          </div>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">오늘 근무</span>
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
          <span class="text-[11px] font-bold text-slate-400 block">내일 (${currentMonth}월 ${tomorrowDay}일 ${tomorrowWeekName}요일)</span>
          <span class="text-sm font-extrabold text-slate-800 mt-0.5 block">${tomorrowShift.text}</span>
        </div>
        <span class="px-3 py-1.5 rounded-xl ${tomorrowShift.bg} ${tomorrowShift.textCol} text-xs font-black shadow-xs">
          ${tomorrowShift.badge}
        </span>
      </div>

      <!-- 3. 🌟 내가 신청한 12월 희망 휴무 현황 카드 (신청 내역 확인 및 바로 변경) -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-amber-600 text-[18px]">event_available</span>
            <span class="text-xs font-black text-slate-900">내 12월 희망 휴무 신청 현황</span>
          </div>
          <button id="btn-reopen-request-modal" class="text-[11px] font-black text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">edit_calendar</span>
            ${hasMyRequests ? '신청 날짜 변경' : '휴무 신청하기'}
          </button>
        </div>

        ${hasMyRequests ? `
          <div class="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1">
            ${formatRankList(myRanks[1], '1순위 (필수)', 'text-teal-800')}
            ${formatRankList(myRanks[2], '2순위 (대안)', 'text-blue-700')}
            ${formatRankList(myRanks[3], '3순위 (추가)', 'text-amber-700')}
            <div class="pt-1.5 mt-1 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span>상태: <b class="text-teal-700 font-extrabold">관리자 근무표 편성 대기중</b></span>
              <span class="text-[10px] text-slate-400">변경 희망 시 위 [날짜 변경] 클릭</span>
            </div>
          </div>
        ` : `
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-center space-y-1">
            <p class="text-xs font-extrabold text-amber-900">아직 접수된 12월 희망 휴무가 없습니다.</p>
            <p class="text-[11px] text-amber-700">관리자가 근무표를 작성하기 전에 쉬고 싶은 날짜를 미리 신청해주세요.</p>
          </div>
        `}
      </div>

      <!-- 4. 이번 달(${currentMonth}월) 내 전체 근무 캘린더 -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-teal-700 text-[18px]">calendar_month</span>
            <span class="text-xs font-black text-slate-900">${currentYear}년 ${currentMonth}월 내 전체 근무</span>
          </div>
          <span class="text-[11px] font-bold text-teal-700">주간 ${staff.fixedD || 10}회 · 야간 ${staff.fixedN || 7}회</span>
        </div>

        <div class="grid grid-cols-7 gap-1 text-center text-xs">
          <div class="text-rose-500 font-bold py-1">일</div>
          <div class="text-slate-600 font-bold py-1">월</div>
          <div class="text-slate-600 font-bold py-1">화</div>
          <div class="text-slate-600 font-bold py-1">수</div>
          <div class="text-slate-600 font-bold py-1">목</div>
          <div class="text-slate-600 font-bold py-1">금</div>
          <div class="text-blue-500 font-bold py-1">토</div>

          <!-- 2026년 11월 1일은 일요일 시작 -->
          ${assignments.map(a => {
            const isToday = a.day === todayDay;
            const isRed = a.isRequested;
            const isNight = (a.code === 'N' || a.code === 'N1');
            const isOff = (a.code === 'X' || a.code === 'OFF');

            let cellBg = isToday ? 'ring-2 ring-teal-600 bg-teal-50' : 'bg-slate-50';
            if (isNight) cellBg = isToday ? 'ring-2 ring-teal-600 bg-indigo-50' : 'bg-indigo-50/60';

            return `
              <div class="py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 ${cellBg} shadow-xs">
                <span class="text-[10px] font-medium text-slate-500 ${isToday ? 'font-black text-teal-800' : ''}">${a.day}</span>
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

  const handleOpenOffModal = () => {
    if (isGuest) {
      alert('⚠️ 임시회원은 둘러보기 전용입니다. 희망 휴무 신청을 원하시면 관리자에게 정회원/준회원 승인을 요청하세요.');
      return;
    }
    openMobileRequestModal({
      rosterData,
      staff: {
        ...staff,
        name: displayName,
        email: staff.email || authState.user?.email || userProfile?.email || '',
        phoneNumber: staff.phoneNumber || userProfile?.phoneNumber || ''
      },
      type: 'OFF',
      existingSelections: myRanks,
      onComplete: () => {
        renderCaregiverMobileView(container, { rosterData, authState, navigate });
      }
    });
  };

  // 희망 휴무 신청 모달 열기 (신규 신청 및 카드 내 날짜 변경 버튼 연동)
  container.querySelector('#btn-reopen-request-modal')?.addEventListener('click', handleOpenOffModal);
}
