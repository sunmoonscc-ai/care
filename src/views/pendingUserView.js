// 가입 승인 대기 및 거절 상태 안내 화면
import { logoutUser } from '../services/authService';

export function renderPendingUserView(container, { userProfile }) {
  const isRejected = userProfile?.status === 'REJECTED';

  container.innerHTML = `
    <div class="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
        
        <div class="w-16 h-16 rounded-3xl ${isRejected ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'} flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-[36px]">
            ${isRejected ? 'block' : 'hourglass_top'}
          </span>
        </div>

        <div>
          <h2 class="text-xl font-extrabold text-slate-900">
            ${isRejected ? '가입이 거절되었거나 이용이 제한되었습니다' : '관리자 승인 대기 중입니다'}
          </h2>
          <p class="text-xs text-slate-500 mt-2 leading-relaxed">
            ${isRejected ? `
              죄송합니다. 관리자에 의해 접속 권한이 제한되었습니다.<br>
              사유: <b>${userProfile.rejectReason || '관리자 권한 취소'}</b><br>
              문의 사항은 늘푸른요양병원 수간호사실로 연락 바랍니다.
            ` : `
              환영합니다, <b>${userProfile.displayName || userProfile.email}</b>님!<br>
              본 시스템은 늘푸른요양병원 인력 보안 규정에 따라<br>
              <b>관리자 승인 후</b> 본인의 근무표 조회 및 이용이 가능합니다.
            `}
          </p>
        </div>

        ${!isRejected ? `
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2 text-slate-600">
            <div class="font-bold text-slate-800 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-teal-700 text-[16px]">info</span>
              신청 현황
            </div>
            <p>• 신청 계정: <b>${userProfile.email}</b></p>
            <p>• 신청 일시: ${userProfile.appliedAt || '방금 전'}</p>
            <p>• 현재 상태: <span class="text-amber-700 font-bold">관리자 확인 대기</span> (정회원/준회원/임시회원)</p>
          </div>
        ` : ''}

        <div class="pt-2">
          <button id="btn-pending-logout" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">
            다른 계정으로 로그인 또는 로그아웃
          </button>
        </div>

      </div>
    </div>
  `;

  container.querySelector('#btn-pending-logout')?.addEventListener('click', async () => {
    await logoutUser();
  });
}
