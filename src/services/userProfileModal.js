// 사용자 프로필 입력 및 정보 수정 모달 컴포넌트
import { updateUserProfileInfo, registerNewUserRequest } from './userService';
import { logoutUser } from './authService';

let activeHistoryListener = null;

export function openUserProfileModal({
  user,
  userProfile,
  isFirstRegistration = false,
  onSaveSuccess,
  onCancel
}) {
  const existingModal = document.getElementById('modal-user-profile');
  if (existingModal) existingModal.remove();

  // 기존 브라우저 뒤로가기 리스너 정리
  if (activeHistoryListener) {
    window.removeEventListener('popstate', activeHistoryListener);
    activeHistoryListener = null;
  }

  const currentName = userProfile?.realName || userProfile?.displayName || user?.displayName || '';
  const currentPhone = userProfile?.phoneNumber || '';
  const email = userProfile?.email || user?.email || '';

  const modalHtml = `
    <div id="modal-user-profile" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans animate-in fade-in duration-150">
      <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <!-- 헤더 -->
        <div class="px-6 py-5 bg-gradient-to-r from-[#004349] to-[#0d5c63] text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px]">
                ${isFirstRegistration ? 'badge' : 'person'}
              </span>
            </div>
            <div>
              <h3 class="font-extrabold text-base tracking-tight">
                ${isFirstRegistration ? '회원가입 정보 입력' : '내 정보 보기 및 수정'}
              </h3>
              <p class="text-[11px] text-teal-100/80">
                ${isFirstRegistration ? '근무표 편성을 위해 실제 성함과 연락처를 입력해주세요' : '등록된 성함과 연락처를 확인하고 수정합니다'}
              </p>
            </div>
          </div>
          ${!isFirstRegistration ? `
            <button id="btn-close-profile-modal" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          ` : `
            <button id="btn-cancel-top-profile-modal" class="text-xs font-bold text-teal-200 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition">
              신청 취소
            </button>
          `}
        </div>

        <!-- 본문 폼 -->
        <form id="form-user-profile" class="p-6 space-y-4">
          <!-- 계정 이메일 (읽기 전용) -->
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">구글 계정 이메일</label>
            <input type="text" value="${email}" disabled class="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-not-allowed"/>
          </div>

          <!-- 실제 한글 이름 -->
          <div>
            <label class="block text-xs font-black text-slate-800 mb-1">
              실제 한글 이름 <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">person</span>
              <input id="input-real-name" type="text" required placeholder="예: 홍길동" value="${currentName}" 
                class="w-full pl-9 pr-3.5 py-2.5 border-2 border-slate-200 focus:border-[#004349] focus:outline-none rounded-xl text-xs font-bold text-slate-900 transition"/>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">병원 근무표에 표기될 본인 실명을 정확히 적어주세요.</p>
          </div>

          <!-- 휴대전화번호 -->
          <div>
            <label class="block text-xs font-black text-slate-800 mb-1">
              휴대전화번호 <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">phone_iphone</span>
              <input id="input-phone-number" type="tel" required placeholder="예: 010-1234-5678" value="${currentPhone}" 
                class="w-full pl-9 pr-3.5 py-2.5 border-2 border-slate-200 focus:border-[#004349] focus:outline-none rounded-xl text-xs font-bold text-slate-900 transition"/>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">근무 변경 및 긴급 연락 시 사용됩니다 (숫자 또는 하이픈 입력).</p>
          </div>

          <!-- 상태 및 안내 -->
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400">계정 상태</span>
              <span class="font-bold text-slate-800">
                ${isFirstRegistration ? '신규 가입 신청' : userProfile?.role === 'ADMIN' ? '최고 관리자' : userProfile?.role === 'REGULAR' ? '정회원' : userProfile?.role === 'ASSOCIATE' ? '준회원' : '가입 승인 대기'}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">소속</span>
              <span class="font-bold text-slate-800">늘푸른요양병원 2층</span>
            </div>
          </div>

          <!-- 에러/알림 메시지 -->
          <div id="profile-form-error" class="hidden p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl text-center"></div>

          <!-- 액션 버튼 -->
          <div class="pt-2 flex gap-2">
            ${isFirstRegistration ? `
              <button type="button" id="btn-cancel-registration" class="flex-1 py-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 transition flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[16px]">close</span>
                신청 취소
              </button>
            ` : `
              <button type="button" id="btn-cancel-profile" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition">
                닫기
              </button>
            `}
            <button type="submit" id="btn-submit-profile" class="flex-[2] py-3 bg-[#004349] hover:bg-[#0d5c63] active:bg-[#002f34] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">save</span>
              ${isFirstRegistration ? '가입 신청 완료하기' : '변경사항 저장'}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('modal-user-profile');
  const form = modal.querySelector('#form-user-profile');
  const errorEl = modal.querySelector('#profile-form-error');

  const cleanupListeners = () => {
    if (activeHistoryListener) {
      window.removeEventListener('popstate', activeHistoryListener);
      activeHistoryListener = null;
    }
  };

  const closeModal = () => {
    cleanupListeners();
    modal.classList.add('opacity-0');
    setTimeout(() => modal.remove(), 150);
  };

  // 모바일 안드로이드 백버튼 대응: 모달이 열릴 때 가상 history state 푸시
  const modalStateId = 'modal_open_' + Date.now();
  window.history.pushState({ modalOpen: true, id: modalStateId }, '');

  // 취소/로그아웃 처리 함수
  const handleCancelRegistration = async () => {
    cleanupListeners();
    modal.remove();
    if (isFirstRegistration) {
      // 신규 가입 취소 시: 로그아웃 처리하고 로그인 첫 화면으로 복귀
      if (confirm('가입 신청을 취소하고 로그인 화면으로 돌아가시겠습니까?')) {
        await logoutUser();
        if (onCancel) onCancel();
      } else {
        // 다시 팝업 복구
        openUserProfileModal({ user, userProfile, isFirstRegistration, onSaveSuccess, onCancel });
      }
    } else {
      if (onCancel) onCancel();
    }
  };

  // 안드로이드 하드웨어/제스처 백 버튼 이벤트 감지
  activeHistoryListener = (e) => {
    cleanupListeners();
    modal.remove();
    if (isFirstRegistration) {
      // 안드로이드 백 버튼 눌렀을 때도 물어보고 취소/로그아웃
      logoutUser().then(() => {
        if (onCancel) onCancel();
      });
    } else {
      if (onCancel) onCancel();
    }
  };
  window.addEventListener('popstate', activeHistoryListener);

  modal.querySelector('#btn-close-profile-modal')?.addEventListener('click', () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      closeModal();
    }
  });

  modal.querySelector('#btn-cancel-profile')?.addEventListener('click', () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      closeModal();
    }
  });

  modal.querySelector('#btn-cancel-registration')?.addEventListener('click', handleCancelRegistration);
  modal.querySelector('#btn-cancel-top-profile-modal')?.addEventListener('click', handleCancelRegistration);

  // 전화번호 자동 하이픈 포맷팅
  const phoneInput = modal.querySelector('#input-phone-number');
  phoneInput?.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 3 && val.length <= 7) {
      val = val.slice(0, 3) + '-' + val.slice(3);
    } else if (val.length > 7) {
      val = val.slice(0, 3) + '-' + val.slice(3, 7) + '-' + val.slice(7, 11);
    }
    e.target.value = val;
  });

  // 폼 제출 이벤트
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const realName = modal.querySelector('#input-real-name').value.trim();
    const phoneNumber = modal.querySelector('#input-phone-number').value.trim();

    if (!realName) {
      errorEl.textContent = '실제 한글 이름을 입력해주세요.';
      errorEl.classList.remove('hidden');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      errorEl.textContent = '올바른 휴대전화번호를 입력해주세요.';
      errorEl.classList.remove('hidden');
      return;
    }

    const submitBtn = modal.querySelector('#btn-submit-profile');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      저장 중...
    `;

    try {
      let updatedProfile;
      if (isFirstRegistration || !userProfile?.status) {
        // 최초 가입 신청인 경우: registerNewUserRequest를 호출하여 status: 'PENDING'으로 등록
        updatedProfile = await registerNewUserRequest(user || { email, uid: userProfile?.uid }, {
          realName: realName,
          phoneNumber: phoneNumber
        });
      } else {
        // 기존 정보 수정인 경우: updateUserProfileInfo 호출
        updatedProfile = await updateUserProfileInfo({
          email: email,
          uid: user?.uid || userProfile?.uid,
          realName: realName,
          displayName: realName,
          phoneNumber: phoneNumber
        });
      }

      alert(`✅ 정보가 성공적으로 저장되었습니다.\n성함: ${realName}\n연락처: ${phoneNumber}`);
      cleanupListeners();
      closeModal();

      if (onSaveSuccess) {
        onSaveSuccess(updatedProfile);
      }
    } catch (err) {
      console.error("❌ 프로필 저장 오류:", err);
      errorEl.textContent = `저장 실패: ${err.message}`;
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-[16px]">save</span>
        ${isFirstRegistration ? '가입 신청 완료하기' : '변경사항 저장'}
      `;
    }
  });
}


