import { loadRosterData, saveRosterData } from './services/rosterService';
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
    this.currentView = 'editor';
    this.rosterData = null;
    this.violations = [];
    this.authState = { isLoggedIn: false, user: null, isAdmin: false };
    this.container = document.getElementById('view-content');
  }

  async init() {
    this.rosterData = await loadRosterData();
    this.recalculateViolations();
    this.setupNavigation();
    this.setupAuthListener();
  }

  setupAuthListener() {
    subscribeAuth((authInfo) => {
      this.authState = authInfo;
      this.updateHeaderUser();
      
      // 관리자가 아니고 일반 직원이면 기본 뷰를 모바일 뷰로 유도
      if (this.authState.isLoggedIn && !this.authState.isAdmin && this.currentView === 'editor') {
        this.currentView = 'mobile';
      }
      this.render();
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
        <div class="flex items-center gap-2">
          ${u.photoURL ? `<img src="${u.photoURL}" class="w-7 h-7 rounded-full object-cover border border-slate-300"/>` : `
            <div class="w-7 h-7 rounded-full bg-[#004349] flex items-center justify-center text-white text-xs font-bold">
              ${u.displayName.charAt(0)}
            </div>
          `}
          <div class="text-left">
            <div class="flex items-center gap-1">
              <span class="text-xs font-bold text-slate-900 leading-tight">${u.displayName}</span>
              ${roleBadge}
            </div>
            <span class="text-[10px] text-slate-500 block leading-tight truncate max-w-[130px]">${u.email}</span>
          </div>
          <button id="btn-logout" class="ml-1 text-[11px] text-slate-400 hover:text-slate-700 px-1.5 py-1 rounded hover:bg-slate-100" title="로그아웃">
            <span class="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>
      `;

      userContainer.querySelector('#btn-logout')?.addEventListener('click', async () => {
        await logoutUser();
      });
    } else {
      userContainer.innerHTML = `
        <button id="btn-header-login" class="px-3 py-1.5 bg-[#004349] hover:bg-[#0d5c63] text-white rounded-lg text-xs font-bold transition flex items-center gap-1">
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
        <span class="text-[11px] text-slate-500">실시간 검증</span>
        <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-bold">위반 ${errorCount}</span>
        <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold">주의 ${warnCount}</span>
      `;
    }
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('nav a[data-path]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = link.getAttribute('data-path');
        this.navigate(path);
      });
    });

    // 모바일 하단 탭 바 이벤트 연결
    const mobileButtons = document.querySelectorAll('.mobile-nav-btn');
    mobileButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        this.navigate(target);
      });
    });
  }

  navigate(viewName) {
    this.currentView = viewName;
    
    // PC 네비게이션 액티브 상태 갱신
    document.querySelectorAll('nav a[data-path]').forEach(link => {
      const path = link.getAttribute('data-path');
      if (path === viewName) {
        link.className = 'px-4 py-2 transition-colors flex items-center gap-1.5 text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60 rounded-t-lg text-sm';
      } else {
        link.className = 'px-4 py-2 font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-sm';
      }
    });

    // 모바일 하단 탭 바 액티브 상태 갱신
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

    // 로그인이 안 되어 있는 경우 로그인 화면 표시
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
        // 관리자가 아닐 경우 수정 차단
        if (!this.authState.isAdmin) {
          alert('⚠️ 근무표 수정 및 배포 권한은 관리자(hdcc6th@gmail.com, sunmoon.scc@gmail.com)에게만 부여되어 있습니다.');
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
