// 휴무 신청 모달 (단순화: 1개 날짜만 선택)
import { replaceStaffMonthlyOffRequests } from '../services/requestService';

export function openMobileRequestModal({ rosterData, staff, type = 'OFF', existingSelections = null, onComplete }) {
  let modal = document.getElementById('modal-mobile-request');
  if (modal) modal.remove();

  const maxOffDays = 2; // 고정: 선택한 날부터 2일 휴무

  // 현재 날짜 기반으로 다음 달 계산
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth() + 2; // 다음 달
  if (targetMonth > 12) {
    targetMonth = 1;
    targetYear += 1;
  }

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const getDayInfo = (day) => {
    const d = new Date(targetYear, targetMonth - 1, day);
    const dayOfWeek = d.getDay();
    return {
      day,
      dayOfWeek,
      dayName: weekDayNames[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    };
  };

  // 1순위 숫자 1개만 선택 (예: 15 선택 → 15,16일 휴무)
  let selectedDay = null;

  // 기존 신청이 있으면 복원 (배열 형태면 첫 번째 요소 사용)
  if (existingSelections && existingSelections[1]) {
    const existing = existingSelections[1];
    selectedDay = Array.isArray(existing) ? existing[0] : existing;
  }

  let isSubmitting = false;

  const renderCalendarGrid = () => {
    // 2026년 12월 1일의 요일 (0=일, 1=월, ..., 6=토)
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1).getDay();

    let html = '';

    // 첫 주: 1일 전까지 빈 칸 추가
    for (let i = 0; i < firstDayOfMonth; i++) {
      html += `<div class="py-2 px-1"></div>`;
    }

    // 1일부터 마지막 날짜까지
    for (let day = 1; day <= daysInMonth; day++) {
      const info = getDayInfo(day);
      const isSelected = selectedDay === day;
      let btnStyle = 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200';

      if (isSelected) {
        btnStyle = 'bg-teal-700 text-white border-teal-800 shadow-sm font-black ring-2 ring-teal-300';
      } else if (info.isWeekend) {
        if (info.dayOfWeek === 0) {
          btnStyle = 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200';
        } else {
          btnStyle = 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200';
        }
      }

      html += `
        <button type="button" class="btn-calendar-day py-2 px-1 rounded-xl transition flex flex-col items-center justify-center ${btnStyle}" data-day="${day}">
          <span class="text-[11px] ${isSelected ? 'text-white' : info.isWeekend ? (info.dayOfWeek === 0 ? 'text-rose-600' : 'text-blue-600') : 'text-slate-500'} font-medium leading-none">
            ${info.dayName}
          </span>
          <span class="text-sm font-extrabold leading-tight mt-0.5">${day}</span>
        </button>
      `;
    }

    return html;
  };

  const formatSelectedDay = () => {
    if (!selectedDay) return '미선택';
    const info = getDayInfo(selectedDay);
    const nextDay = selectedDay + 1 <= daysInMonth ? selectedDay + 1 : daysInMonth;
    const nextInfo = getDayInfo(nextDay);
    return `12월 ${selectedDay}일(${info.dayName}) ~ ${nextDay}일(${nextInfo.dayName})`;
  };

  const modalHtml = `
    <div id="modal-mobile-request" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto pb-safe">

        <!-- 모달 헤더 -->
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold border border-teal-200/50">
              <span class="material-symbols-outlined text-[20px]">event_available</span>
            </div>
            <div>
              <h3 class="font-black text-slate-900 text-base">12월 희망 휴무 신청</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">신청자: <b class="text-slate-700">${staff.name}</b></p>
            </div>
          </div>
          <button id="btn-close-mobile-req" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 flex items-center justify-center transition">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- 안내 텍스트 -->
        <div class="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <p class="text-xs font-bold text-teal-900">
            <span class="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
            아래 달력에서 휴무를 시작할 날짜 <b>1개만 클릭</b>하세요.
          </p>
          <p class="text-[11px] text-teal-800 mt-1">예: 15일 클릭 → 15일, 16일 연속 휴무</p>
        </div>

        <!-- 달력 -->
        <div>
          <label class="block font-black text-slate-800 mb-1.5">${targetYear}년 ${targetMonth}월 달력</label>

          <!-- 요일 헤더 -->
          <div class="grid grid-cols-7 gap-1 text-center font-bold text-[10px] mb-1">
            <div class="text-rose-600">일</div>
            <div class="text-slate-600">월</div>
            <div class="text-slate-600">화</div>
            <div class="text-slate-600">수</div>
            <div class="text-slate-600">목</div>
            <div class="text-slate-600">금</div>
            <div class="text-blue-600">토</div>
          </div>

          <!-- 날짜 버튼 -->
          <div id="calendar-days-grid" class="grid grid-cols-7 gap-1 max-h-52 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
            ${renderCalendarGrid()}
          </div>
        </div>

        <!-- 선택 결과 -->
        <div class="p-3 rounded-xl bg-slate-100 border border-slate-200">
          <p class="text-xs font-bold text-slate-700">선택한 휴무 기간</p>
          <p id="selected-display" class="text-sm font-black text-teal-800 mt-1">${formatSelectedDay()}</p>
        </div>

        <!-- 신청 사유 -->
        <div>
          <label class="block font-bold text-slate-700 mb-1.5 text-xs">신청 사유</label>
          <input id="input-req-reason" type="text" placeholder="사유를 입력하세요" value="개인 사정" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600 text-xs font-medium"/>
        </div>

        <!-- 제출 버튼 -->
        <div class="pt-2">
          <button id="btn-submit-mobile-req" class="w-full py-3.5 bg-[#004349] hover:bg-[#0d5c63] active:bg-[#003035] text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 touch-manipulation">
            <span id="btn-submit-icon" class="material-symbols-outlined text-[18px]">send</span>
            <span id="btn-submit-label">12월 휴무 신청 제출</span>
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('modal-mobile-request');

  const updateDisplay = () => {
    const display = modal.querySelector('#selected-display');
    if (display) {
      display.innerText = formatSelectedDay();
    }

    const grid = modal.querySelector('#calendar-days-grid');
    if (grid) {
      grid.innerHTML = renderCalendarGrid();
      bindCalendarEvents();
    }
  };

  const bindCalendarEvents = () => {
    modal.querySelectorAll('.btn-calendar-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.dataset.day, 10);
        selectedDay = selectedDay === day ? null : day;
        updateDisplay();
      });
    });
  };

  // 날짜 클릭 이벤트
  bindCalendarEvents();

  // 닫기
  modal.querySelector('#btn-close-mobile-req')?.addEventListener('click', () => modal.remove());

  // 제출
  modal.querySelector('#btn-submit-mobile-req')?.addEventListener('click', async () => {
    if (isSubmitting) return;

    if (!selectedDay) {
      alert('⚠️ 휴무를 시작할 날짜를 선택해주세요.');
      return;
    }

    isSubmitting = true;
    const submitBtn = modal.querySelector('#btn-submit-mobile-req');
    const submitIcon = modal.querySelector('#btn-submit-icon');
    const submitLabel = modal.querySelector('#btn-submit-label');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.className = 'w-full py-3.5 bg-slate-400 text-white font-black text-sm rounded-xl cursor-not-allowed flex items-center justify-center gap-2';
    }
    if (submitIcon) {
      submitIcon.innerText = 'sync';
      submitIcon.classList.add('animate-spin');
    }
    if (submitLabel) {
      submitLabel.innerText = '신청 등록 중...';
    }

    const reason = modal.querySelector('#input-req-reason').value.trim() || '개인 사정';

    // 선택한 날짜부터 2일간 휴무 신청
    const nextDay = selectedDay + 1 <= daysInMonth ? selectedDay + 1 : daysInMonth;

    const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    console.log(`📝 [신청 생성] 사용자: ${staff.name}, 선택일: ${selectedDay}일, 다음날: ${nextDay}일, 월: ${monthStr}`);

    const newItems = [
      {
        type: 'OFF',
        typeName: '희망 휴무(OFF)',
        requesterId: staff.id || '',
        requesterName: staff.name || '',
        requesterEmail: (staff.email || '').toLowerCase().trim(),
        requesterPhone: (staff.phoneNumber || '').replace(/[^0-9]/g, ''),
        targetId: '',
        targetName: '-',
        date: `${monthStr}-${String(selectedDay).padStart(2, '0')}`,
        fromShift: 'D',
        toShift: 'OFF',
        reason: reason,
        rank: 1,
        month: monthStr,
        status: 'PENDING_ADMIN',
        statusText: '관리자(수간호사) 승인 대기중'
      },
      {
        type: 'OFF',
        typeName: '희망 휴무(OFF)',
        requesterId: staff.id || '',
        requesterName: staff.name || '',
        requesterEmail: (staff.email || '').toLowerCase().trim(),
        requesterPhone: (staff.phoneNumber || '').replace(/[^0-9]/g, ''),
        targetId: '',
        targetName: '-',
        date: `${monthStr}-${String(nextDay).padStart(2, '0')}`,
        fromShift: 'D',
        toShift: 'OFF',
        reason: reason,
        rank: 1,
        month: monthStr,
        status: 'PENDING_ADMIN',
        statusText: '관리자(수간호사) 승인 대기중'
      }
    ];

    await replaceStaffMonthlyOffRequests(staff.id, staff.name, monthStr, newItems);

    modal.remove();
    alert(`🎉 ${targetYear}년 ${targetMonth}월 ${selectedDay}일~${nextDay}일 휴무 신청이 완료되었습니다!\n\n관리자 승인 후 근무표에 반영됩니다.`);

    if (onComplete) onComplete();
  });
}
