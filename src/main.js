import { getLocalRosterData, syncRosterFromFirestore, saveRosterData } from './services/rosterService';
import { validateRoster } from './services/ruleEngine';
import { subscribeAuth, logoutUser } from './services/authService';
import { getUserProfile, registerNewUserRequest, listAllUsers, subscribeUsersList } from './services/userService';
import { subscribeRosterChanges } from './services/realtimeSync';

import { renderDashboardView } from './views/dashboardView';
import { renderRosterEditorView } from './views/rosterEditorView';
import { renderAutoGenerateView } from './views/autoGenerateView';
import { renderShiftExchangeView } from './views/shiftExchangeView';
import { renderCaregiverMobileView } from './views/caregiverMobileView';
import { renderLoginView } from './views/loginView';
import { renderPendingUserView } from './views/pendingUserView';
import { renderUserManagementView } from './views/userManagementView';

class CareShiftApp {
  constructor() {
    this.currentView = 'loading';
    this.rosterData = getLocalRosterData();
    this.violations = [];
    this.authState = { isLoggedIn: false, user: null, isAdmin: false, userProfile: null };
    this.container = document.getElementById('view-content');
    this.pendingUsersCount = 0;
  }

  init() {
    this.recalculateViolations();
    this.setupNavigation();

    // 1. Firebase Auth 감시
    subscribeAuth(async (authInfo) => {
      this.authState.isLoggedIn = authInfo.isLoggedIn;
      this.authState.user = authInfo.user;
      this.authState.isAdmin = authInfo.isAdmin;

      // 하단 탭바 노출/숨김 및 모드 업데이트
      this.updateBottomNavVisibility();

      if (!this.authState.isLoggedIn) {
        // 비로그인 상태 -> 로그인 화면 표시
        this.authState.userProfile = null;
        this.updateHeaderUser();
        this.currentView = 'login';
        this.render();
      } else {
        // 2. 사용자 프로필 조회 (신규 사용자면 자동 가입 신청 생성)
        let profile = await getUserProfile(authInfo.user.email);
        if (!profile && !authInfo.isAdmin) {
          profile = await registerNewUserRequest(authInfo.user);
        }

        this.authState.userProfile = profile;
        this.updateHeaderUser();

        // 3. 권한별 화면 및 하단 탭바 분기
        if (this.authState.isAdmin) {
          // 관리자: 회원 가입 실시간 감시 시작
          this.listenToPendingUsers();

          if (this.currentView === 'login' || this.currentView === 'loading' || this.currentView === 'pending') {
            this.currentView = 'editor';
          }
        } else if (profile?.status === 'PENDING' || profile?.status === 'REJECTED') {
          // 승인 대기중 / 거절된 사용자: 접속 대기 화면
          this.currentView = 'pending';
        } else {
          // 승인된 일반 회원 (정회원/준회원/임시회원): 모바일 내 근무 화면
          if (this.currentView === 'login' || this.currentView === 'loading' || this.currentView === 'pending') {
            this.currentView = 'mobile';
          }
        }

        this.updateBottomNavVisibility();
        this.render();

        // 4. 백그라운드 Firestore 근무표 동기화
        syncRosterFromFirestore().then((remoteData) => {
          if (remoteData) {
            this.rosterData = remoteData;
            this.recalculateViolations();
            if (this.currentView !== 'login' && this.currentView !== 'pending') {
              this.render();
            }
          }
        });
      }
    });

    // 5. 원격 근무표 변경 감시
    subscribeRosterChanges((remoteData) => {
      this.rosterData = remoteData;
      this.recalculateViolations();
      if (this.currentView !== 'login' && this.currentView !== 'pending') {
        this.render();
      }
    });
  }

  // 관리자 전용: 실시간 신규 가입 신청자 감시
  listenToPendingUsers() {
    subscribeUsersList((users) => {
      const pending = users.filter(u => u.status === 'PENDING');
      this.pendingUsersCount = pending.length;
      this.updateAdminHeaderBadge();
    });
    // 최초 1회 목록 조회
    listAllUsers().then(users => {
      const pending = users.filter(u => u.status === 'PENDING');
      this.pendingUsersCount = pending.length;
      this.updateAdminHeaderBadge();
    });
  }

  // 관리자 상단 헤더 뱃지 갱신
  updateAdminHeaderBadge() {
    const badge = document.getElementById('admin-new-user-badge');
    if (!badge || !this.authState.isAdmin) {
      if (badge) badge.innerHTML = '';
      return;
    }

    if (this.pendingUsersCount > 0) {
      badge.innerHTML = `
        <button id="btn-goto-user-mgmt" class="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition animate-bounce">
          <span class="material-symbols-outlined text-[17px]">person_add</span>
          가입 승인 대기 <span class="bg-white text-rose-700 rounded-full px-1.5 py-0.2 text-[11px] font-black">${this.pendingUsersCount}</span>
        </button>
      `;
    } else {
      badge.innerHTML = `
        <button id="btn-goto-user-mgmt" class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition">
          <span class="material-symbols-outlined text-[16px]">group</span>
          회원 승인·관리
        </button>
      `;
    }

    badge.querySelector('#btn-goto-user-mgmt')?.addEventListener('click', () => {
      this.navigate('user-mgmt');
    });
  }

  // 📱 모바일 하단 탭바를 로그인 상태 및 권한에 따라 동적으로 구성
  updateBottomNavVisibility() {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav) return;

    // 1. 비로그인 상태이거나 승인 대기(pending) 상태이면 하단 탭바 완전 숨김
    if (!this.authState.isLoggedIn || this.authState.userProfile?.status === 'PENDING' || this.authState.userProfile?.status === 'REJECTED') {
      nav.classList.add('hidden');
      return;
    }

    nav.classList.remove('hidden');

    // 2. 권한별 메뉴 분기
    if (this.authState.isAdmin) {
      // 👑 관리자용 하단 메뉴 4개: [근무표편집, 가입승인관리, 휴무교환, 대시보드]
      nav.innerHTML = `
        <div class="grid grid-cols-4 h-14">
          <button class="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-[#004349]" data-target="editor">
            <span class="material-symbols-outlined text-[20px]">table_chart</span>
            <span class="text-[10px] font-bold">근무표편집</span>
          </button>
          <button class="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-[#004349] relative" data-target="user-mgmt">
            <span class="material-symbols-outlined text-[20px]">how_to_reg</span>
            <span class="text-[10px] font-bold">회원승인</span>
            ${this.pendingUsersCount > 0 ? `<span class="absolute top-1 right-5 w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>` : ''}
          </button>
          <button class="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-[#004349]" data-target="requests">
            <span class="material-symbols-outlined text-[20px]">sync_alt</span>
            <span class="text-[10px] font-bold">휴무승인</span>
          </button>
          <button class="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-[#004349]" data-target="dashboard">
            <span class="material-symbols-outlined text-[20px]">analytics</span>
            <span class="text-[10px] font-bold">대시보드</span>
          </button>
        </div>
      `;
    } else {
      // 👩‍⚕️ 일반 요양보호사용 하단 메뉴 2개만 깔끔하게 노출: [내 오늘근무, 휴무·교환신청]
      nav.innerHTML = `
        <div class="grid grid-cols-2 h-14 max-w-sm mx-auto">
          <button class="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-[#004349]" data-target="mobile">
            <span class="material-symbols-outlined text-[22px]">calendar_today</span>
            <span class="text-[11px] font-bold">내 오늘근무</span>
          </button>
          <button class="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-[#004349]" data-target="requests">
            <span class="material-symbols-outlined text-[22px]">event_busy</span>
            <span class="text-[11px] font-bold">휴무·교환 신청</span>
          </button>
        </div>
      `;
    }

    this.bindBottomNavEvents();
  }

  bindBottomNavEvents() {
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        this.navigate(target);
      });
    });
  }

  updateHeaderUser() {
    const userContainer = document.getElementById('header-user-info');
    if (!userContainer) return;

    if (this.authState.isLoggedIn && this.authState.user) {
      const u = this.authState.user;
      const profile = this.authState.userProfile;
      
      let roleBadge = `<span class="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">대기중</span>`;
      if (this.authState.isAdmin) {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">관리자</span>`;
      } else if (profile?.role === 'REGULAR') {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">정회원</span>`;
      } else if (profile?.role === 'ASSOCIATE') {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">준회원</span>`;
      } else if (profile?.role === 'GUEST') {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">임시회원</span>`;
      }

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
    document.querySelectorAll('nav a[data-path]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = link.getAttribute('data-path');
        this.navigate(path);
      });
    });

    this.bindBottomNavEvents();
  }

  navigate(viewName) {
    if (this.authState.isLoggedIn && !this.authState.isAdmin && (this.authState.userProfile?.status === 'PENDING' || this.authState.userProfile?.status === 'REJECTED')) {
      viewName = 'pending';
    }

    this.currentView = viewName;
    
    document.querySelectorAll('nav a[data-path]').forEach(link => {
      const path = link.getAttribute('data-path');
      if (path === viewName) {
        link.className = 'px-4 py-2 transition-colors flex items-center gap-1.5 text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60 rounded-t-lg text-sm';
      } else {
        link.className = 'px-4 py-2 font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-sm';
      }
    });

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

    // 1. 비로그인 화면
    if (!this.authState.isLoggedIn && this.currentView === 'login') {
      renderLoginView(this.container, () => {});
      return;
    }

    // 2. 가입 대기 / 거절 화면
    if (this.currentView === 'pending') {
      renderPendingUserView(this.container, { userProfile: this.authState.userProfile });
      return;
    }

    const props = {
      rosterData: this.rosterData,
      violations: this.violations,
      authState: this.authState,
      staffList: this.rosterData.staffList,
      navigate: (v) => this.navigate(v),
      onUpdated: () => {
        this.listenToPendingUsers();
      },
      onUpdateRoster: (newData) => {
        if (!this.authState.isAdmin) {
          alert('⚠️ 근무표 수정 권한은 관리자에게만 부여되어 있습니다.');
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
      case 'user-mgmt':
        renderUserManagementView(this.container, props);
        break;
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

const app = new CareShiftApp();
app.init();
