// 휴무 및 근무 맞교환 신청 전용 모바일 모달 팝업
import { saveRequest } from '../services/requestService';

export function openMobileRequestModal({ rosterData, staff, type = 'OFF', onComplete }) {
  let modal = document.getElementById('modal-mobile-request');
  if (modal) modal.remove();

  const otherStaffList = rosterData.staffList.filter(s => s.id !== staff.id);

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
            <label class="block font-bold text-slate-700 mb-1">날짜 선택 (9월)</label>
            <div class="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              ${Array.from({ length: 30 }).map((_, i) => {
                const day = i + 1;
                const isSelected = day === 15;
                return `
                  <button type="button" class="btn-day-chip py-2 rounded-lg font-extrabold text-xs transition ${isSelected ? 'bg-teal-700 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'}" data-day="${day}">
                    ${day}일
                  </button>
                `;
              }).join('')}
            </div>
            <input type="hidden" id="selected-day" value="15"/>
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
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">병원 정기검진</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">가족 경조사</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">개인 사정</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">건강상 휴식</button>
            </div>
            <input id="input-req-reason" type="text" placeholder="사유를 입력하거나 위 태그를 누르세요" value="병원 정기검진" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600 font-medium"/>
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

  // 날짜 칩 클릭 이벤트
  modal.querySelectorAll('.btn-day-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.btn-day-chip').forEach(b => {
        b.className = 'btn-day-chip py-2 rounded-lg font-extrabold text-xs transition bg-white text-slate-700 hover:bg-slate-100';
      });
      btn.className = 'btn-day-chip py-2 rounded-lg font-extrabold text-xs transition bg-teal-700 text-white shadow-xs';
      modal.querySelector('#selected-day').value = btn.dataset.day;
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
    const day = modal.querySelector('#selected-day').value;
    const reason = modal.querySelector('#input-req-reason').value.trim() || '개인 사정';
    const dateStr = `2026-09-${day.padStart(2, '0')}`;

    let reqData;
    if (type === 'OFF') {
      reqData = {
        type: 'OFF',
        typeName: '희망 휴무(OFF)',
        requesterId: staff.id,
        requesterName: staff.name,
        targetId: '',
        targetName: '-',
        date: dateStr,
        fromShift: 'B',
        toShift: 'X',
        reason: reason,
        status: 'PENDING_ADMIN',
        statusText: '관리자(수간호사) 승인 대기중'
      };
    } else {
      const targetSelect = modal.querySelector('#select-target-staff');
      const targetStaff = otherStaffList.find(s => s.id === targetSelect.value) || otherStaffList[0];
      const myShift = modal.querySelector('#select-my-shift').value;
      const targetShift = modal.querySelector('#select-target-shift').value;

      reqData = {
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
      };
    }

    await saveRequest(reqData);
    modal.remove();
    alert(`🎉 [9월 ${day}일] ${type === 'OFF' ? '희망 휴무' : '근무 맞교환'} 신청이 등록되었습니다!\n관리자 승인 즉시 근무표에 자동 반영됩니다.`);
    if (onComplete) onComplete();
  });
}

