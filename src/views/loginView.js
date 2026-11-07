// 첫 방문자를 위한 직관적 로그인 및 웰컴 게이트웨이 뷰
import { loginWithGoogle, ADMIN_EMAILS } from '../services/authService';

export function renderLoginView(container, onLoginSuccess) {
  container.innerHTML = `
    <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-b from-[#f8f9ff] to-slate-100">
      <div class="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        <!-- 서비스 로고 & 웰컴 타이틀 -->
        <div class="flex flex-col items-center">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#004349] to-[#0d5c63] flex items-center justify-center text-white font-black text-2xl shadow-lg mb-3">
            C
          </div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight">케어시프트</h1>
          <p class="text-xs text-slate-500 font-medium mt-1">늘푸른요양병원 간병인력 근무일정표 포털</p>
        </div>

        <!-- 안내 카드 (처음 방문자 & 역할 안내) -->
        <div class="p-4 bg-teal-50/70 rounded-2xl border border-teal-100 text-left space-y-2.5">
          <div class="flex items-center gap-1.5 text-xs font-extrabold text-teal-900">
            <span class="material-symbols-outlined text-[18px] text-teal-700">waving_hand</span>
            처음 오셨나요? 로그인 안내
          </div>
          <div class="text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
            <p>• <b>별도 회원가입 없이</b> 보유하신 <b>구글 계정</b>으로 1초 만에 바로 로그인하실 수 있습니다.</p>
            <p>• <b>관리자</b>: 근무표 생성, 수정, 구글 시트 동기화 및 최종 배포</p>
            <p>• <b>요양보호사</b>: 오늘/내일 내 근무 조회 및 희망휴무·맞교환 원클릭 신청</p>
          </div>
        </div>

        <!-- 원클릭 Google 로그인 버튼 -->
        <div class="space-y-3 pt-1">
          <button id="btn-google-login-action" class="w-full py-4 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300 rounded-2xl shadow-sm flex items-center justify-center gap-3 text-sm font-extrabold text-slate-800 hover:border-slate-400 transition-all touch-manipulation">
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google 계정으로 시작하기
          </button>

          <p class="text-[11px] text-slate-400">
            로그인 시 병원 전산 데이터가 백그라운드에서 실시간 동기화됩니다.
          </p>
        </div>

      </div>
    </div>
  `;

  container.querySelector('#btn-google-login-action')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-google-login-action');
    btn.disabled = true;
    btn.innerHTML = `
      <span class="inline-block w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
      로그인 처리 중...
    `;

    const res = await loginWithGoogle();
    if (res.success) {
      if (onLoginSuccess) onLoginSuccess(res);
    } else {
      btn.disabled = false;
      btn.innerHTML = `Google 계정으로 시작하기`;
      alert(`로그인 안내: ${res.error}\n(팝업이 차단되었거나 취소된 경우 다시 시도해 주세요)`);
    }
  });
}
