// 운영 대시보드 뷰 (인터랙티브 날짜별 근무 조회 달력 및 실시간 인력 현황 연동)
import { loadRequests } from '../services/requestService';

export async function renderDashboardView(container, { rosterData, violations, navigate }) {
  const staffList = rosterData.staffList || [];
  const assignments = rosterData.assignments || {};
  const staffCount = staffList.length;
  const errorCount = (violations || []).filter(v => v.type === 'error').length;
  const warnCount = (violations || []).filter(v => v.type === 'warning').length;

  // 실제 현재 날짜 (오늘: 2026년 11월 10일 화요일)
  const nowDate = new Date();
  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth() + 1; // 11월
  const todayDay = nowDate.getDate(); // 10일

  // 대시보드에서 조회할 년도 및 월 (기본값: 오늘이 속한 2026년 11월)
  // 관리자가 상단에서 11월 또는 12월을 전환하여 볼 수 있도록 뷰 월(viewYear, viewMonth) 상태 제공
  let viewYear = currentYear;
  let viewMonth = currentMonth; // 기본은 오늘인 11월
  let selectedDay = todayDay;   // 기본 선택일은 오늘(10일)

  // 미처리 신청 건수 조회
  const requests = await loadRequests();
  const pendingRequests = requests.filter(r => r.status && r.status.includes('PENDING'));

  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 특정 일자의 근무자 분류 함수 (D, E, N, B, OFF 등)
  const getStaffForDay = (day) => {
    const dayStaff = {
      dayGroup: [],    // D, B (주간)
      eveningGroup: [],// E, MID (저녁/이브닝)
      nightGroup: [],  // N, N1 (야간)
      offGroup: []     // OFF, X (휴무/비번)
    };

    staffList.forEach(staff => {
      const staffAssign = assignments[staff.id] || [];
      const item = staffAssign.find(a => a.day === day);
      const code = item ? item.code : 'OFF';

      const staffInfo = {
        id: staff.id,
        name: staff.name,
        role: staff.role || '요양보호사',
        code: code,
        isRequested: item?.isRequested || false,
        note: item?.note || ''
      };

      if (code === 'D' || code === 'B' || code === 'D2' || code === 'B2') {
        dayStaff.dayGroup.push(staffInfo);
      } else if (code === 'E' || code === 'MID') {
        dayStaff.eveningGroup.push(staffInfo);
      } else if (code === 'N' || code === 'N1') {
        dayStaff.nightGroup.push(staffInfo);
      } else {
        dayStaff.offGroup.push(staffInfo);
      }
    });

    return dayStaff;
  };

  const renderDashboardContent = () => {
    // 조회할 월의 총 일수 및 1일의 시작 요일 계산
    const daysInViewMonth = new Date(viewYear, viewMonth, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0(일) ~ 6(토)

    // 선택일 보정
    if (selectedDay > daysInViewMonth) selectedDay = daysInViewMonth;

    const selectedDateObj = new Date(viewYear, viewMonth - 1, selectedDay);
    const selectedWeekDay = weekDayNames[selectedDateObj.getDay()];
    const isToday = (selectedDay === todayDay && viewMonth === currentMonth && viewYear === currentYear);
    const isPast = (viewYear < currentYear) || (viewYear === currentYear && viewMonth < currentMonth) || (viewYear === currentYear && viewMonth === currentMonth && selectedDay < todayDay);
    const isFuture = !isToday && !isPast;

    const statusBadge = isToday
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-200">오늘 (실시간 가동)</span>`
      : isPast
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">근무 완료 (기록)</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">근무 예정 (편성완료)</span>`;

    const dayStaff = getStaffForDay(selectedDay);
    const totalWorkingToday = dayStaff.dayGroup.length + dayStaff.eveningGroup.length + dayStaff.nightGroup.length;

    // 1일 시작 요일에 맞춘 빈 칸(padding) 생성
    let calendarGridHtml = '';
    for (let p = 0; p < firstDayOfWeek; p++) {
      calendarGridHtml += `<div class="py-2 px-1 min-h-[58px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200/60"></div>`;
    }

    // 1일부터 말일까지 달력 날짜 렌더링
    for (let d = 1; d <= daysInViewMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth - 1, d);
      const dayOfWeek = dateObj.getDay();
      const isSun = dayOfWeek === 0;
      const isSat = dayOfWeek === 6;
      const isSel = (d === selectedDay);
      const isNow = (d === todayDay && viewMonth === currentMonth && viewYear === currentYear);

      const dStaff = getStaffForDay(d);
      const dTotalWork = dStaff.dayGroup.length + dStaff.eveningGroup.length + dStaff.nightGroup.length;

      let btnClass = 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-800';
      if (isSel) {
        btnClass = 'bg-[#004349] text-white border-[#004349] shadow-md ring-2 ring-teal-300 font-black';
      } else if (isNow) {
        btnClass = 'bg-teal-50 border-teal-300 text-teal-900 font-extrabold ring-1 ring-teal-400';
      } else if (isSun) {
        btnClass = 'bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-100';
      } else if (isSat) {
        btnClass = 'bg-blue-50/70 border-blue-200 text-blue-700 hover:bg-blue-100';
      }

      calendarGridHtml += `
        <button type="button" class="btn-cal-day py-2 px-1 rounded-xl transition flex flex-col items-center justify-between text-center min-h-[58px] ${btnClass}" data-day="${d}">
          <div class="flex items-center justify-between w-full px-1 text-[10px]">
            <span class="${isSel ? 'text-teal-100 font-bold' : isSun ? 'text-rose-600 font-bold' : isSat ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'}">
              ${weekDayNames[dayOfWeek]}
            </span>
            ${isNow ? `<span class="w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-teal-600'}"></span>` : ''}
          </div>
          <span class="text-sm font-extrabold my-0.5 leading-none">${d}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded-full leading-tight font-bold ${
            isSel ? 'bg-teal-800/80 text-teal-100' : 'bg-slate-100 text-slate-600'
          }">
            출근 ${dTotalWork}명
          </span>
        </button>
      `;
    }

    container.innerHTML = `
      <div class="px-4 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto space-y-6 font-sans pb-24">
        
        <!-- 상단 헤더 배너 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <div class="flex items-center gap-2">
              ${statusBadge}
              <span class="text-xs text-slate-400 font-medium">늘푸른요양병원 본원 · 2층 병동 (${rosterData.floor || '54병상'})</span>
            </div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
              ${viewYear}년 ${viewMonth}월 ${selectedDay}일 (${selectedWeekDay}) 인력 운영 대시보드
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
              ${isToday ? '오늘' : `${selectedDay}일`} 출근 인원 <b>${totalWorkingToday}명</b> (주간 ${dayStaff.dayGroup.length}명, 저녁 ${dayStaff.eveningGroup.length}명, 야간 ${dayStaff.nightGroup.length}명) · 휴무 ${dayStaff.offGroup.length}명
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- 월 선택 토글 버튼 -->
            <div class="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button id="btn-switch-month-11" class="px-3 py-1.5 rounded-lg text-xs font-black transition ${viewMonth === 11 ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                11월 (당월)
              </button>
              <button id="btn-switch-month-12" class="px-3 py-1.5 rounded-lg text-xs font-black transition ${viewMonth === 12 ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                12월 (익월)
              </button>
            </div>

            <button id="btn-goto-today" class="px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-black rounded-xl border border-teal-200 transition flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[17px]">today</span>
              오늘 날짜 (11월 ${todayDay}일)로 이동
            </button>
            <button id="btn-goto-editor" class="px-4 py-2.5 bg-[#004349] hover:bg-[#0d5c63] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[17px]">table_chart</span>
              월간 근무표 편집 바로가기
            </button>
          </div>
        </div>

        <!-- 4대 핵심 KPI 카드 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>선택일 출근 인원</span>
              <span class="material-symbols-outlined text-teal-700 text-[20px]">groups</span>
            </div>
            <div class="mt-2.5 flex items-baseline gap-1.5">
              <span class="text-2xl sm:text-3xl font-black text-slate-900">${totalWorkingToday}명</span>
              <span class="text-xs text-slate-400">/ 총 ${staffCount}명</span>
            </div>
            <div class="mt-2 text-[11px] text-slate-500 font-medium">
              주간 ${dayStaff.dayGroup.length} · 저녁 ${dayStaff.eveningGroup.length} · 야간 ${dayStaff.nightGroup.length}
            </div>
          </div>

          <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>법정 야간 인력 (2인)</span>
              <span class="material-symbols-outlined text-indigo-700 text-[20px]">shield_moon</span>
            </div>
            <div class="mt-2.5 flex items-baseline gap-1.5">
              <span class="text-2xl sm:text-3xl font-black ${dayStaff.nightGroup.length >= 2 ? 'text-indigo-700' : 'text-rose-600'}">
                ${dayStaff.nightGroup.length}명
              </span>
              <span class="text-xs text-slate-400 font-bold">${dayStaff.nightGroup.length >= 2 ? '안전 보장' : '인력 부족'}</span>
            </div>
            <div class="mt-2 text-[11px] text-slate-500 font-medium">
              최소 2인 필수 배치 규정 준수
            </div>
          </div>

          <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>실시간 근무 규칙 검증</span>
              <span class="material-symbols-outlined text-rose-600 text-[20px]">verified</span>
            </div>
            <div class="mt-2.5 flex items-baseline gap-1.5">
              <span class="text-2xl sm:text-3xl font-black ${errorCount > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                ${errorCount === 0 ? '정상 0건' : `${errorCount}건`}
              </span>
              <span class="text-xs text-amber-600 font-bold">주의 ${warnCount}건</span>
            </div>
            <div class="mt-2 text-[11px] text-slate-500 font-medium">
              역듀티 0건 · 연속야간 상한 관리
            </div>
          </div>

          <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>휴무/교환 승인 대기</span>
              <span class="material-symbols-outlined text-blue-600 text-[20px]">pending_actions</span>
            </div>
            <div class="mt-2.5 flex items-baseline gap-1.5">
              <span class="text-2xl sm:text-3xl font-black text-blue-700">${pendingRequests.length}건</span>
              <span class="text-xs text-slate-400">접수됨</span>
            </div>
            <div class="mt-2 text-[11px] text-slate-500 font-medium flex items-center justify-between">
              <span>미처리 신청서</span>
              <button id="btn-goto-requests" class="text-teal-700 hover:underline font-bold">승인하러 가기 &gt;</button>
            </div>
          </div>
        </div>

        <!-- 🌟 날짜별 근무 일정 선택 달력 뷰 (정확한 요일 정렬 및 빈칸 패딩 지원) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-teal-700 text-[20px]">calendar_month</span>
              <h2 class="text-base font-black text-slate-900">${viewYear}년 ${viewMonth}월 날짜별 근무 현황 달력</h2>
            </div>
            <p class="text-xs text-slate-500">
              달력의 날짜를 누르면 해당 일자의 <b>근무완료/예정자 명단 및 상세 교대 일정</b>이 아래에 즉시 나타납니다.
            </p>
          </div>

          <!-- 요일 헤더 (일 ~ 토) -->
          <div class="grid grid-cols-7 gap-1.5 text-center font-bold text-xs mb-1">
            <div class="text-rose-600">일</div>
            <div class="text-slate-600">월</div>
            <div class="text-slate-600">화</div>
            <div class="text-slate-600">수</div>
            <div class="text-slate-600">목</div>
            <div class="text-slate-600">금</div>
            <div class="text-blue-600">토</div>
          </div>

          <!-- 요일 칸에 맞춰 정렬된 캘린더 그리드 -->
          <div class="grid grid-cols-7 gap-1.5">
            ${calendarGridHtml}
          </div>
        </div>

        <!-- 선택된 날짜의 근무자 상세 현황 (주간 / 저녁 / 야간 / 휴무 4열 카드) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-teal-700 text-[20px]">badge</span>
              <h2 class="text-base font-black text-slate-900">
                [${viewMonth}월 ${selectedDay}일 ${selectedWeekDay}요일] 시간대별 간병인력 명단 (${totalWorkingToday}명 출근)
              </h2>
            </div>
            <span class="text-xs font-bold text-slate-500">
              ${isToday ? '오늘 실시간 순회 중' : isPast ? '근무 완료 기록' : '근무 예정 배정'}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <!-- 1. 낮/주간 (D / B) -->
            <div class="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-black text-xs">
                  주간 Day (07:00 ~ 15:00)
                </span>
                <span class="text-xs font-black text-amber-800">${dayStaff.dayGroup.length}명</span>
              </div>
              <p class="text-[11px] text-amber-800">아침/점심 식사 수발, 회진 보조, 주사/투약 처치 집중</p>
              
              <div class="space-y-1.5 pt-1">
                ${dayStaff.dayGroup.length === 0 ? `
                  <div class="text-xs text-slate-400 py-2 text-center">배정 인원 없음</div>
                ` : dayStaff.dayGroup.map(s => `
                  <div class="px-2.5 py-1.5 rounded-lg bg-white border border-amber-200/60 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-slate-900">${s.name}</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      ${s.code} 근무
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 2. 저녁/이브닝 (E / MID) -->
            <div class="p-4 rounded-xl bg-teal-50/70 border border-teal-200/80 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-900 font-black text-xs">
                  저녁 Evening (15:00 ~ 23:00)
                </span>
                <span class="text-xs font-black text-teal-800">${dayStaff.eveningGroup.length}명</span>
              </div>
              <p class="text-[11px] text-teal-800">저녁 식사 수발, 취침 준비, 당직 의사 보고 및 투약</p>
              
              <div class="space-y-1.5 pt-1">
                ${dayStaff.eveningGroup.length === 0 ? `
                  <div class="text-xs text-slate-400 py-2 text-center">배정 인원 없음</div>
                ` : dayStaff.eveningGroup.map(s => `
                  <div class="px-2.5 py-1.5 rounded-lg bg-white border border-teal-200/60 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-slate-900">${s.name}</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      ${s.code} 근무
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 3. 밤샘/나이트 (N / N1) -->
            <div class="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs">
                  야간 Night (23:00 ~ 07:00)
                </span>
                <span class="text-xs font-black text-indigo-800">${dayStaff.nightGroup.length}명</span>
              </div>
              <p class="text-[11px] text-indigo-800">수면 상태 점검, 2시간 간격 낙상 순찰, 새벽 채혈</p>
              
              <div class="space-y-1.5 pt-1">
                ${dayStaff.nightGroup.length === 0 ? `
                  <div class="text-xs text-rose-600 font-bold py-2 text-center">⚠️ 야간 배정 인원 없음 (경고)</div>
                ` : dayStaff.nightGroup.map(s => `
                  <div class="px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200/60 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-slate-900">${s.name}</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                      ${s.code} 야간
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- 휴무 / 비번 직원 명단 바 -->
          <div class="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">휴무/비번 (OFF) ${dayStaff.offGroup.length}명</span>
              <span class="text-slate-600 font-medium">
                ${dayStaff.offGroup.length === 0 ? '없음 (전원 출근)' : dayStaff.offGroup.map(s => s.name).join(', ')}
              </span>
            </div>
            <span class="text-slate-400 text-[11px]">늘푸른요양병원 2층 요양보호사 운영관리</span>
          </div>
        </div>

      </div>
    `;

    // 이벤트 리스너 바인딩
    container.querySelectorAll('.btn-cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDay = parseInt(btn.dataset.day, 10);
        renderDashboardContent();
      });
    });

    // 오늘 날짜로 이동 (11월 10일)
    container.querySelector('#btn-goto-today')?.addEventListener('click', () => {
      viewYear = currentYear;
      viewMonth = currentMonth;
      selectedDay = todayDay;
      renderDashboardContent();
    });

    // 11월 보기 버튼
    container.querySelector('#btn-switch-month-11')?.addEventListener('click', () => {
      viewYear = 2026;
      viewMonth = 11;
      selectedDay = (viewMonth === currentMonth) ? todayDay : 1;
      renderDashboardContent();
    });

    // 12월 보기 버튼
    container.querySelector('#btn-switch-month-12')?.addEventListener('click', () => {
      viewYear = 2026;
      viewMonth = 12;
      selectedDay = 1;
      renderDashboardContent();
    });

    container.querySelector('#btn-goto-editor')?.addEventListener('click', () => navigate('editor'));
    container.querySelector('#btn-goto-requests')?.addEventListener('click', () => navigate('requests'));
  };

  renderDashboardContent();
}
