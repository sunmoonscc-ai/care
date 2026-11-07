// 비로그인 사용자를 위한 구글 로그인 게이트웨이 뷰
import { loginWithGoogle, ADMIN_EMAILS } from '../services/authService';

export function renderLoginView(container, onLoginSuccess) {
  container.innerHTML = `
    <div class="min-h-[calc(100vh-5rem)] flex items-center justify-center p-6 bg-slate-100">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-6">
        <!-- 로고 및 서비스명 -->
        <div class="flex flex-col items-center">
          <div class="w-14 h-14 rounded-2xl bg-[#004349] flex items-center justify-center text-white font-extrabold text-2xl shadow-md mb-3">
            C
          </div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight">케어시프트</h1>
          <p class="text-xs text-slate-500 font-medium mt-1">늘푸른요양병원 간병인력 근무일정표 관리</p>
        </div>

        <!-- 로그인 안내 -->
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-left space-y-2">
          <div class="font-bold text-slate-800 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-teal-700 text-[18px]">verified_user</span>
            사용자 접근 권한 안내
          </div>
          <p>• <b>시스템 관리자</b>: ${ADMIN_EMAILS.join(', ')}<br>
             &nbsp;&nbsp;➔ 근무표 생성, 수정, 구글 시트 동기화, 최종 배포 권한
          </p>
          <p>• <b>일반 요양보호사/직원</b>:<br>
             &nbsp;&nbsp;➔ 구글 계정 로그인 후 본인 근무표 조회 및 희망휴무·교환 신청
          </p>
        </div>

        <!-- 구글 로그인 버튼 -->
        <button id="btn-google-login" class="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-300 rounded-xl shadow-sm flex items-center justify-center gap-3 text-sm font-bold text-slate-700 hover:border-slate-400 transition-all">
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Google 계정으로 로그인
        </button>

        <p class="text-[11px] text-slate-400">
          * 병원 전산망 및 개인정보보호 규정을 준수합니다.
        </p>
      </div>
    </div>
  `;

  container.querySelector('#btn-google-login')?.addEventListener('click', async () => {
    const res = await loginWithGoogle();
    if (res.success) {
      if (onLoginSuccess) onLoginSuccess(res);
    } else {
      alert(`로그인 실패: ${res.error}\n(Firebase Authentication에서 Google 로그인이 사용 설정되어 있는지 확인해 주세요)`);
    }
  });
}

