// 휴무 및 근무 맞교환 신청 전용 모바일 모달 팝업
import { saveRequest } from '../services/requestService';
import { getAppSettings } from '../services/settingsService';

export function openMobileRequestModal({ rosterData, staff, type = 'OFF', onComplete }) {
  let modal = document.getElementById('modal-mobile-request');
  if (modal) modal.remove();

  const settings = getAppSettings();
  const maxOffDays = settings.monthlyOffLimit || 2;
  const requireConsecutive = settings.requireConsecutiveOff;

  const otherStaffList = rosterData.staffList.filter(s => s.id !== staff.id);

  // 기본 선택 날짜 (연속 2일: 27일, 28일)
  let selectedDays = type === 'OFF' ? [27, 28] : [15];

  const renderDayChips = () => {
    return Array.from({ length: 30 }).map((_, i) => {
      const day = i + 1;
      const isSelected = selectedDays.includes(day);
      return `
        <button type="button" class="btn-day-chip py-2 rounded-lg font-extrabold text-xs transition ${isSelected ? 'bg-teal-700 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'}" data-day="${day}">
          ${day}일
        </button>
      `;
    }).join('');
  };

  const modalHtml = `
    <div id="modal-mobile-request" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto pb-safe">
        
        <!-- 모달 헤더 -->
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full ${type === 'OFF' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[18px]">${type === 'OFF' ? 'event_busy' : 'swap_horiz'}</span>
            </div>
            <div>
              <h3 class="font-extrabold text-slate-900 text-base">
                ${type === 'OFF' ? '희망 휴무(OFF) 신청' : '동료와 1:1 근무 맞교환'}
              </h3>
              <p class="text-[11px] text-slate-400">신청자: ${staff.name} 요양보호사</p>
            </div>
          </div>
          <button id="btn-close-mobile-req" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 flex items-center justify-center">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- 폼 필드 -->
        <div class="space-y-3.5 text-xs">
          <!-- 1. 날짜 선택 -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block font-bold text-slate-700">
                ${type === 'OFF' ? `희망 휴무 일자 선택 (최대 ${maxOffDays}일)` : '날짜 선택 (9월)'}
              </label>
              ${type === 'OFF' && requireConsecutive ? `
                <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  연속 ${maxOffDays}일 필수
                </span>
              ` : ''}
            </div>

            <div id="day-chips-grid" class="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              ${renderDayChips()}
            </div>
            <p id="day-selection-guide" class="text-[11px] text-slate-500 mt-1 font-medium">
              선택한 날짜: <b class="text-teal-800 font-extrabold">${selectedDays.map(d => `${d}일`).join(', ')}</b> (총 ${selectedDays.length}일)
            </p>
          </div>

          ${type === 'SWAP' ? `
            <!-- 2. 맞교환 대상 동료 선택 -->
            <div>
              <label class="block font-bold text-slate-700 mb-1">교환할 동료 선택</label>
              <select id="select-target-staff" class="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
                ${otherStaffList.map(s => `
                  <option value="${s.id}">${s.name} (${s.role || '요양보호사'})</option>
                `).join('')}
              </select>
            </div>

            <!-- 교환 근무 형태 -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-bold text-slate-700 mb-1">내 원래 근무</label>
                <select id="select-my-shift" class="w-full py-2 px-2.5 rounded-lg border border-slate-300 font-bold bg-white text-xs">
                  <option value="B">주간 (B)</option>
                  <option value="N">전반야 (N)</option>
                  <option value="N1">후반야 (N1)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">바꿀 근무</label>
                <select id="select-target-shift" class="w-full py-2 px-2.5 rounded-lg border border-slate-300 font-bold bg-white text-xs">
                  <option value="N">전반야 (N)</option>
                  <option value="N1">후반야 (N1)</option>
                  <option value="B">주간 (B)</option>
                  <option value="X">비번 (X)</option>
                </select>
              </div>
            </div>
          ` : ''}

          <!-- 3. 신청 사유 입력 -->
          <div>
            <label class="block font-bold text-slate-700 mb-1">신청 사유</label>
            <div class="flex flex-wrap gap-1.5 mb-1.5">
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">개인 경조사</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">병원 정기검진</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">가족 간병</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">건강상 휴식</button>
            </div>
            <input id="input-req-reason" type="text" placeholder="사유를 입력하거나 위 태그를 누르세요" value="개인 경조사" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600 font-medium"/>
          </div>
        </div>

        <!-- 하단 제출 버튼 -->
        <div class="pt-2">
          <button id="btn-submit-mobile-req" class="w-full py-3.5 bg-[#004349] hover:bg-[#0d5c63] active:bg-[#003035] text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">send</span>
            신청서 제출하기
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('modal-mobile-request');

  const updateChipsUI = () => {
    modal.querySelectorAll('.btn-day-chip').forEach(b => {
      const d = parseInt(b.dataset.day, 10);
      const isSel = selectedDays.includes(d);
      b.className = `btn-day-chip py-2 rounded-lg font-extrabold text-xs transition ${isSel ? 'bg-teal-700 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'}`;
    });

    const guideEl = modal.querySelector('#day-selection-guide');
    if (guideEl) {
      guideEl.innerHTML = `선택한 날짜: <b class="text-teal-800 font-extrabold">${selectedDays.sort((a,b)=>a-b).map(d => `${d}일`).join(', ')}</b> (총 ${selectedDays.length}일)`;
    }
  };

  // 날짜 칩 클릭 이벤트
  modal.querySelectorAll('.btn-day-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const clickedDay = parseInt(btn.dataset.day, 10);

      if (type === 'OFF') {
        if (requireConsecutive && maxOffDays > 1) {
          // 연속 일자 신청 필수 정책: 클릭한 날부터 연속으로 maxOffDays 일자 선택 (월 30일 초과 방지)
          let startDay = clickedDay;
          if (startDay + maxOffDays - 1 > 30) {
            startDay = 30 - maxOffDays + 1;
          }
          selectedDays = [];
          for (let i = 0; i < maxOffDays; i++) {
            selectedDays.push(startDay + i);
          }
        } else {
          // 단일 또는 토글
          if (selectedDays.includes(clickedDay)) {
            selectedDays = selectedDays.filter(d => d !== clickedDay);
          } else {
            if (selectedDays.length >= maxOffDays) {
              selectedDays.shift(); // 선입선출
            }
            selectedDays.push(clickedDay);
          }
        }
      } else {
        // 교환은 하루 기준
        selectedDays = [clickedDay];
      }

      updateChipsUI();
    });
  });

  // 사유 빠른 태그 클릭
  modal.querySelectorAll('.btn-reason-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      modal.querySelector('#input-req-reason').value = tag.innerText;
    });
  });

  // 닫기
  modal.querySelector('#btn-close-mobile-req')?.addEventListener('click', () => modal.remove());

  // 제출 이벤트
  modal.querySelector('#btn-submit-mobile-req')?.addEventListener('click', async () => {
    if (selectedDays.length === 0) {
      alert('신청할 날짜를 선택해주세요.');
      return;
    }

    // 연속성 검증
    if (type === 'OFF' && requireConsecutive && selectedDays.length > 1) {
      const sorted = [...selectedDays].sort((a,b)=>a-b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i-1] + 1) {
          alert(`⚠️ 희망 휴무는 연속된 날짜로만 신청 가능합니다.\n(예: 27~28일 2일 연속)`);
          return;
        }
      }
    }

    const reason = modal.querySelector('#input-req-reason').value.trim() || '개인 사정';

    if (type === 'OFF') {
      const dateDisplay = selectedDays.sort((a,b)=>a-b).map(d => `9월 ${d}일`).join(', ');
      
      for (const day of selectedDays) {
        const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
        await saveRequest({
          type: 'OFF',
          typeName: '희망 휴무(OFF)',
          requesterId: staff.id,
          requesterName: staff.name,
          targetId: '',
          targetName: '-',
          date: dateStr,
          fromShift: 'B',
          toShift: 'X',
          reason: `${reason} (${selectedDays.length}일 연속 신청)`,
          status: 'PENDING_ADMIN',
          statusText: '관리자(수간호사) 승인 대기중'
        });
      }

      modal.remove();
      alert(`🎉 [${dateDisplay}] 희망 휴무(OFF) ${selectedDays.length}일 신청이 등록되었습니다!\n관리자 승인 즉시 근무표에 자동 반영됩니다.`);
    } else {
      const day = selectedDays[0];
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
      const targetSelect = modal.querySelector('#select-target-staff');
      const targetStaff = otherStaffList.find(s => s.id === targetSelect.value) || otherStaffList[0];
      const myShift = modal.querySelector('#select-my-shift').value;
      const targetShift = modal.querySelector('#select-target-shift').value;

      await saveRequest({
        type: 'SWAP',
        typeName: '근무 맞교환',
        requesterId: staff.id,
        requesterName: staff.name,
        targetId: targetStaff.id,
        targetName: targetStaff.name,
        date: dateStr,
        fromShift: myShift,
        toShift: targetShift,
        reason: reason,
        status: 'PENDING_ADMIN',
        statusText: `동료(${targetStaff.name}) 및 관리자 승인 대기`
      });

      modal.remove();
      alert(`🎉 [9월 ${day}일] 근무 맞교환 신청이 등록되었습니다!\n관리자 승인 즉시 근무표에 자동 반영됩니다.`);
    }

    if (onComplete) onComplete();
  });
}


