import { getLocalRosterData, syncRosterFromFirestore, saveRosterData } from './services/rosterService';
import { validateRoster } from './services/ruleEngine';
import { subscribeAuth, logoutUser } from './services/authService';
import { subscribeRosterChanges } from './services/realtimeSync';
import { renderDashboardView } from './views/dashboardView';
import { renderRosterEditorView } from './views/rosterEditorView';
import { renderAutoGenerateView } from './views/autoGenerateView';
import { renderShiftExchangeView } from './views/shiftExchangeView';
import { renderCaregiverMobileView } from './views/caregiverMobileView';
import { renderLoginView } from './views/loginView';

class CareShiftApp {
  constructor() {
    this.currentView = 'loading'; // 초기 인증 확인 전 임시 상태
    this.rosterData = getLocalRosterData(); // ⚡ 지연 0ms: 인메모리/로컬 캐시 즉각 로드
    this.violations = [];
    this.authState = { isLoggedIn: false, user: null, isAdmin: false };
    this.container = document.getElementById('view-content');
  }

  init() {
    // 1. 규칙 검증 및 네비게이션 리스너 등록
    this.recalculateViolations();
    this.setupNavigation();

    // 2. 인증 상태 리스너 (Firebase Auth)
    subscribeAuth((authInfo) => {
      const prevLoggedIn = this.authState.isLoggedIn;
      this.authState = authInfo;
      this.updateHeaderUser();

      if (!this.authState.isLoggedIn) {
        // 비로그인 상태 (처음 온 사용자이거나 로그아웃 상태) ➔ 로그인 화면을 첫 화면으로 노출
        this.currentView = 'login';
        this.render();
      } else {
        // 기존 로그인 사용자거나 방금 로그인 성공 ➔ 관리자는 editor, 요양보호사는 mobile
        if (!prevLoggedIn || this.currentView === 'login' || this.currentView === 'loading') {
          this.currentView = this.authState.isAdmin ? 'editor' : 'mobile';
        }
        this.render();

        // 3. ⚡ 사용자 로그인 완료 후 백그라운드에서 조용히 Firestore 최신 데이터 동기화
        syncRosterFromFirestore().then((remoteData) => {
          if (remoteData) {
            this.rosterData = remoteData;
            this.recalculateViolations();
            // 현재 보고 있는 화면을 부드럽게 최신 데이터로 리프레시
            if (this.currentView !== 'login') {
              this.render();
            }
          }
        });
      }
    });

    // 4. Firestore 원격 변경사항 실시간 반영 리스너 (구글 시트나 다른 관리자가 수정 시)
    subscribeRosterChanges((remoteData) => {
      this.rosterData = remoteData;
      this.recalculateViolations();
      if (this.currentView !== 'login') {
        this.render();
      }
    });
  }

  updateHeaderUser() {
    const userContainer = document.getElementById('header-user-info');
    if (!userContainer) return;

    if (this.authState.isLoggedIn && this.authState.user) {
      const u = this.authState.user;
      const roleBadge = this.authState.isAdmin 
        ? `<span class="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">관리자</span>`
        : `<span class="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">요양보호사</span>`;

      userContainer.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2">
          ${u.photoURL ? `<img src="${u.photoURL}" class="w-7 h-7 rounded-full object-cover border border-slate-300 shrink-0"/>` : `
            <div class="w-7 h-7 rounded-full bg-[#004349] flex items-center justify-center text-white text-xs font-bold shrink-0">
              ${u.displayName.charAt(0)}
            </div>
          `}
          <div class="text-left hidden xs:block">
            <div class="flex items-center gap-1">
              <span class="text-xs font-bold text-slate-900 leading-tight">${u.displayName}</span>
              ${roleBadge}
            </div>
            <span class="text-[9px] text-slate-400 block leading-tight truncate max-w-[120px]">${u.email}</span>
          </div>
          <button id="btn-logout" class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100" title="로그아웃">
            <span class="material-symbols-outlined text-[17px]">logout</span>
          </button>
        </div>
      `;

      userContainer.querySelector('#btn-logout')?.addEventListener('click', async () => {
        await logoutUser();
      });
    } else {
      userContainer.innerHTML = `
        <button id="btn-header-login" class="px-3 py-1.5 bg-[#004349] hover:bg-[#0d5c63] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
          <span class="material-symbols-outlined text-[15px]">login</span>
          로그인
        </button>
      `;
      userContainer.querySelector('#btn-header-login')?.addEventListener('click', () => {
        this.currentView = 'login';
        this.render();
      });
    }
  }

  recalculateViolations() {
    if (!this.rosterData) return;
    this.violations = validateRoster(this.rosterData.staffList, this.rosterData.assignments);
    this.updateHeaderStats();
  }

  updateHeaderStats() {
    const errorCount = this.violations.filter(v => v.type === 'error').length;
    const warnCount = this.violations.filter(v => v.type === 'warning').length;
    
    const violationBadge = document.getElementById('header-violation-badge');
    if (violationBadge) {
      violationBadge.innerHTML = `
        <span class="text-[10px] text-slate-500 hidden sm:inline">실시간 검증</span>
        <span class="inline-flex items-center px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[10px] font-bold">위반 ${errorCount}</span>
        <span class="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold hidden xs:inline-flex">주의 ${warnCount}</span>
      `;
    }
  }

  setupNavigation() {
    // PC 네비게이션
    document.querySelectorAll('nav a[data-path]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = link.getAttribute('data-path');
        this.navigate(path);
      });
    });

    // 모바일 하단 탭바
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        this.navigate(target);
      });
    });
  }

  navigate(viewName) {
    this.currentView = viewName;
    
    // PC 헤더 탭 스타일
    document.querySelectorAll('nav a[data-path]').forEach(link => {
      const path = link.getAttribute('data-path');
      if (path === viewName) {
        link.className = 'px-4 py-2 transition-colors flex items-center gap-1.5 text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60 rounded-t-lg text-sm';
      } else {
        link.className = 'px-4 py-2 font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-sm';
      }
    });

    // 모바일 하단 탭 스타일
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const target = btn.dataset.target;
      if (target === viewName) {
        btn.classList.add('text-[#004349]', 'font-extrabold');
        btn.classList.remove('text-slate-500');
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('scale-110');
      } else {
        btn.classList.remove('text-[#004349]', 'font-extrabold');
        btn.classList.add('text-slate-500');
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('scale-110');
      }
    });

    this.render();
  }

  render() {
    this.container.innerHTML = '';

    // 1. 비로그인 상태일 때 로그인 화면 표시
    if (!this.authState.isLoggedIn && this.currentView === 'login') {
      renderLoginView(this.container, () => {
        this.currentView = this.authState.isAdmin ? 'editor' : 'mobile';
        this.render();
      });
      return;
    }

    const props = {
      rosterData: this.rosterData,
      violations: this.violations,
      authState: this.authState,
      navigate: (v) => this.navigate(v),
      onUpdateRoster: (newData) => {
        if (!this.authState.isAdmin) {
          alert('⚠️ 근무표 수정 및 배포 권한은 관리자에게만 부여되어 있습니다.');
          return;
        }
        this.rosterData = newData;
        this.recalculateViolations();
        saveRosterData(newData);
        this.render();
      },
      onApplyRoster: (newData) => {
        if (!this.authState.isAdmin) {
          alert('⚠️ 자동생성 초안 적용 권한은 관리자에게만 부여되어 있습니다.');
          return;
        }
        this.rosterData = newData;
        this.recalculateViolations();
        saveRosterData(newData);
      }
    };

    switch (this.currentView) {
      case 'dashboard':
      case 'operations-dashboard':
        renderDashboardView(this.container, props);
        break;
      case 'editor':
      case 'roster-editor':
        renderRosterEditorView(this.container, props);
        break;
      case 'autogen':
      case 'rule-simulation':
        renderAutoGenerateView(this.container, props);
        break;
      case 'requests':
      case 'requests-management':
        renderShiftExchangeView(this.container, props);
        break;
      case 'mobile':
      case 'caregiver-mobile':
        renderCaregiverMobileView(this.container, props);
        break;
      default:
        renderRosterEditorView(this.container, props);
        break;
    }
  }
}

// 앱 실행
const app = new CareShiftApp();
app.init();
