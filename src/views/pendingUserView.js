// 가입 승인 대기 및 거절 상태 안내 화면
import { logoutUser } from '../services/authService';

export function renderPendingUserView(container, { userProfile }) {
  const isRejected = userProfile?.status === 'REJECTED';

  container.innerHTML = `
    <div class="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        <div class="w-16 h-16 rounded-3xl ${isRejected ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'} flex items-center justify-center mx-auto shadow-inner">
          <span class="material-symbols-outlined text-[36px]">
            ${isRejected ? 'block' : 'hourglass_top'}
          </span>
        </div>

        <div>
          <h2 class="text-xl font-extrabold text-slate-900">
            ${isRejected ? '가입이 거절되었거나 이용이 제한되었습니다' : '회원가입 절차가 진행 중입니다'}
          </h2>
          <p class="text-xs text-slate-500 mt-2 leading-relaxed">
            ${isRejected ? `
              죄송합니다. 관리자에 의해 접속 권한이 제한되었습니다.<br>
              사유: <b>${userProfile?.rejectReason || '관리자 권한 취소'}</b><br>
              문의 사항은 늘푸른요양병원 간호사실로 연락 바랍니다.
            ` : `
              환영합니다, <b>${userProfile?.displayName || userProfile?.email || '회원'}</b>님!<br>
              현재 <span class="text-amber-700 font-bold">관리자 승인 대기 상태</span>입니다.<br>
              <b>관리자가 승인 시 사용할 수 있습니다.</b>
            `}
          </p>
        </div>

        ${!isRejected ? `
          <div class="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-left text-xs space-y-2 text-slate-700">
            <div class="font-extrabold text-amber-900 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-amber-700 text-[18px]">verified_user</span>
              가입 승인 안내
            </div>
            <p>• 신청 계정: <b>${userProfile?.email || ''}</b></p>
            <p>• 신청 일시: ${userProfile?.appliedAt || '방금 전'}</p>
            <p class="text-[11px] text-amber-800 leading-normal pt-1 border-t border-amber-200/60">
              관리자가 정회원, 준회원 또는 임시회원으로 승인하면 즉시 본인의 근무표를 확인하실 수 있습니다.
            </p>
          </div>
        ` : ''}

        <div class="pt-2">
          <button id="btn-pending-logout" class="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            로그아웃 후 다른 계정으로 로그인
          </button>
        </div>

      </div>
    </div>
  `;

  container.querySelector('#btn-pending-logout')?.addEventListener('click', async () => {
    await logoutUser();
  });
}

