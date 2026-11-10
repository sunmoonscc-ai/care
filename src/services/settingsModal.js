// 관리자 전용 근무표 및 휴무 정책 설정 모달
import { getAppSettings, saveAppSettings } from './settingsService';

export function openSettingsModal({ onSaved }) {
  let modal = document.getElementById('modal-app-settings');
  if (modal) modal.remove();

  const currentSettings = getAppSettings();

  const modalHtml = `
    <div id="modal-app-settings" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans animate-in fade-in duration-150">
      <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <!-- 헤더 -->
        <div class="px-6 py-5 bg-gradient-to-r from-[#004349] to-[#0d5c63] text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px]">tune</span>
            </div>
            <div>
              <h3 class="font-extrabold text-base tracking-tight">근무 및 휴무 정책 설정</h3>
              <p class="text-[11px] text-teal-100/80">병동 인력 규모 및 직원의 휴무 신청 규칙을 조정합니다</p>
            </div>
          </div>
          <button id="btn-close-settings-modal" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- 설정 폼 -->
        <form id="form-app-settings" class="p-6 space-y-5">
          <!-- 1. 2층 전체 직원 수 설정 -->
          <div class="space-y-1.5">
            <label class="block text-xs font-black text-slate-800">
              2층 필요 전체 직원 수 (정원) <span class="text-rose-500">*</span>
            </label>
            <div class="flex items-center gap-3">
              <div class="relative flex-1">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">groups</span>
                <input id="input-total-staff" type="number" min="1" max="30" required value="${currentSettings.totalStaffCount}" 
                  class="w-full pl-9 pr-3.5 py-2.5 border-2 border-slate-200 focus:border-[#004349] focus:outline-none rounded-xl text-xs font-bold text-slate-900 transition"/>
              </div>
              <span class="text-xs font-bold text-slate-600">명</span>
            </div>
            <p class="text-[11px] text-slate-400">
              현재 가입된 정규 직원을 우선 배치하고, 부족한 인원은 <b>'직원4(외부 프리랜서)'</b> 형태로 자동 할당됩니다.
            </p>
          </div>

          <!-- 2. 한 달 희망 휴무 신청 가능 일수 -->
          <div class="space-y-1.5">
            <label class="block text-xs font-black text-slate-800">
              월 희망 휴무(OFF) 신청 가능 일수 <span class="text-rose-500">*</span>
            </label>
            <div class="flex items-center gap-3">
              <div class="relative flex-1">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">event_available</span>
                <input id="input-monthly-off-limit" type="number" min="1" max="10" required value="${currentSettings.monthlyOffLimit}" 
                  class="w-full pl-9 pr-3.5 py-2.5 border-2 border-slate-200 focus:border-[#004349] focus:outline-none rounded-xl text-xs font-bold text-slate-900 transition"/>
              </div>
              <span class="text-xs font-bold text-slate-600">일</span>
            </div>
            <p class="text-[11px] text-slate-400">
              직원이 모바일에서 한 달 동안 신청할 수 있는 휴무 일수 상한입니다. (현재 ${currentSettings.monthlyOffLimit}일)
            </p>
          </div>

          <!-- 3. 연속 일자 신청 필수 옵션 -->
          <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-teal-700">date_range</span>
                <span class="text-xs font-extrabold text-slate-800">연속 일자로만 휴무 신청 허용</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="check-consecutive-off" class="sr-only peer" ${currentSettings.requireConsecutiveOff ? 'checked' : ''}>
                <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004349]"></div>
              </label>
            </div>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              활성화 시 직원은 떨어져 있는 날짜를 신청할 수 없으며, <b>예: 11월 27~28일 2일 연속</b>처럼 붙어있는 날짜로만 묶어서 신청해야 합니다.
            </p>
          </div>

          <!-- 버튼 -->
          <div class="pt-2 flex gap-2">
            <button type="button" id="btn-cancel-settings" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition">
              취소
            </button>
            <button type="submit" id="btn-submit-settings" class="flex-[2] py-3 bg-[#004349] hover:bg-[#0d5c63] active:bg-[#002f34] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">save</span>
              설정값 저장 및 적용
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('modal-app-settings');

  const closeModal = () => {
    modal.classList.add('opacity-0');
    setTimeout(() => modal.remove(), 150);
  };

  modal.querySelector('#btn-close-settings-modal')?.addEventListener('click', closeModal);
  modal.querySelector('#btn-cancel-settings')?.addEventListener('click', closeModal);

  // 저장 처리
  modal.querySelector('#form-app-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const totalStaffCount = parseInt(modal.querySelector('#input-total-staff').value, 10) || 10;
    const monthlyOffLimit = parseInt(modal.querySelector('#input-monthly-off-limit').value, 10) || 2;
    const requireConsecutiveOff = modal.querySelector('#check-consecutive-off').checked;

    const submitBtn = modal.querySelector('#btn-submit-settings');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      저장 중...
    `;

    try {
      const updated = await saveAppSettings({
        totalStaffCount,
        monthlyOffLimit,
        requireConsecutiveOff
      });

      alert(`✅ 설정값이 성공적으로 저장되었습니다.\n• 전체 직원 수: ${updated.totalStaffCount}명\n• 월 희망휴무: ${updated.monthlyOffLimit}일 (연속 신청: ${updated.requireConsecutiveOff ? '필수' : '선택'})`);
      closeModal();
      if (onSaved) onSaved(updated);
    } catch (err) {
      alert(`설정 저장 실패: ${err.message}`);
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">save</span> 설정값 저장 및 적용`;
    }
  });
}

