import { getLocalRosterData, syncRosterFromFirestore, saveRosterData } from './services/rosterService';
import { validateRoster } from './services/ruleEngine';
import { subscribeAuth, logoutUser, loginWithGoogle } from './services/authService';
import { getUserProfile, registerNewUserRequest, listAllUsers, subscribeUsersList } from './services/userService';
import { subscribeRosterChanges } from './services/realtimeSync';
import { DIAGNOSTICS } from './services/diagnostics';

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
    this.currentViewCleanup = null; // 이전 뷰의 정리 함수
  }

  init() {
    this.recalculateViolations();
    this.setupNavigation();

    // 1. Firebase Auth 감시
    subscribeAuth(async (authInfo) => {
      try {
        this.authState.isLoggedIn = authInfo.isLoggedIn;
        this.authState.user = authInfo.user;
        this.authState.isAdmin = authInfo.isAdmin;

        console.log("🔐 [auth] 인증 상태 변경:", {
          isLoggedIn: authInfo.isLoggedIn,
          email: authInfo.user?.email,
          isAdmin: authInfo.isAdmin
        });

        // 하단 탭바 및 상단 PC 네비게이션 노출/숨김 업데이트
        this.updateBottomNavVisibility();
        this.updatePcNavVisibility();

        if (!this.authState.isLoggedIn) {
          // 비로그인 상태 -> 로그인 화면 표시
          this.authState.userProfile = null;
          this.updateHeaderUser();
          this.updatePcNavVisibility();
          this.currentView = 'login';
          this.render();
          return;
        }

        // 2️⃣ 사용자 프로필 조회 (신규 사용자면 자동 가입 신청 생성)
        console.log("👤 [auth] 사용자 프로필 조회 시작:", authInfo.user.email);

        let profile = null;

        try {
          profile = await getUserProfile(authInfo.user.email);
          console.log("✅ [auth] 프로필 조회 성공:", profile);
        } catch (error) {
          console.error("❌ [auth] 프로필 조회 오류:", error.message);
        }

        // 신규 사용자 처리
        if (!profile && !authInfo.isAdmin) {
          console.log("📝 [auth] 신규 사용자 - 가입 신청 생성");
          try {
            profile = await registerNewUserRequest(authInfo.user);
            console.log("✅ [auth] 가입 신청 생성 완료:", profile);
          } catch (error) {
            console.error("❌ [auth] 가입 신청 생성 오류:", error.message);
          }
        }

        this.authState.userProfile = profile;
        this.updateHeaderUser();

        // 3️⃣ 권한별 화면 및 하단 탭바 분기
        if (this.authState.isAdmin) {
          console.log("👑 [auth] 관리자 계정 - editor 화면 전환");
          // 관리자: 회원 가입 실시간 감시 시작
          this.listenToPendingUsers();

          if (this.currentView === 'login' || this.currentView === 'loading' || this.currentView === 'pending') {
            this.currentView = 'editor';
          }
        } else if (profile?.status === 'PENDING' || profile?.status === 'REJECTED') {
          console.log("⏳ [auth] 승인 대기 사용자 - pending 화면 전환");
          // 승인 대기중 / 거절된 사용자: 접속 대기 화면
          this.currentView = 'pending';
        } else if (profile?.status === 'APPROVED') {
          console.log("✅ [auth] 승인된 사용자 - mobile 화면 전환");
          // 승인된 일반 회원 (정회원/준회원/임시회원): 모바일 내 근무 화면
          if (this.currentView === 'login' || this.currentView === 'loading' || this.currentView === 'pending') {
            this.currentView = 'mobile';
          }
        } else {
          console.warn("⚠️ [auth] 프로필 상태 불명: ", profile?.status);
          this.currentView = 'pending';
        }

        this.updateBottomNavVisibility();
        this.updatePcNavVisibility();
        this.render();

        // 4️⃣ 백그라운드 Firestore 근무표 동기화
        syncRosterFromFirestore().then((remoteData) => {
          if (remoteData) {
            this.rosterData = remoteData;
            this.recalculateViolations();
            if (this.currentView !== 'login' && this.currentView !== 'pending') {
              this.render();
            }
          }
        });
      } catch (error) {
        console.error("❌ [auth] 콜백 예외 발생:", error.message);
        this.currentView = 'login';
        this.render();
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

    this.updatePcNavVisibility();
    this.updateBottomNavVisibility();
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

  // 💻 PC 상단 탭바를 로그인 상태 및 권한에 따라 동적으로 구성
  updatePcNavVisibility() {
    const pcNavBar = document.getElementById('pc-top-nav-bar');
    const pcNavLinks = document.getElementById('pc-nav-links');
    if (!pcNavBar || !pcNavLinks) return;

    // 1. 비로그인 상태이거나 승인 대기(pending/rejected) 상태이면 PC 상단 탭바 완전 숨김
    if (!this.authState.isLoggedIn || this.authState.userProfile?.status === 'PENDING' || this.authState.userProfile?.status === 'REJECTED') {
      pcNavBar.classList.add('hidden');
      pcNavBar.classList.remove('md:flex');
      return;
    }

    // 로그인된 상태이면 md:flex 적용
    pcNavBar.classList.remove('hidden');
    pcNavBar.classList.add('md:flex');

    // 2. 권한별 메뉴 분기
    if (this.authState.isAdmin) {
      // 👑 관리자용 상단 메뉴
      pcNavLinks.innerHTML = `
        <a class="px-4 py-2 transition-colors flex items-center gap-1.5 ${this.currentView === 'editor' ? 'text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60' : 'text-slate-600 hover:text-slate-900'} rounded-t-lg text-sm" data-path="editor" href="#">
          <span class="material-symbols-outlined text-[17px]">table_chart</span>
          월간 근무표 편집
        </a>
        <a class="px-4 py-2 transition-colors flex items-center gap-1.5 ${this.currentView === 'user-mgmt' ? 'text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60' : 'text-slate-600 hover:text-slate-900'} rounded-t-lg text-sm relative" data-path="user-mgmt" href="#">
          <span class="material-symbols-outlined text-[17px]">how_to_reg</span>
          회원 가입 승인 관리
          ${this.pendingUsersCount > 0 ? `<span class="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">${this.pendingUsersCount}</span>` : ''}
        </a>
        <a class="px-4 py-2 transition-colors flex items-center gap-1.5 ${this.currentView === 'requests' ? 'text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60' : 'text-slate-600 hover:text-slate-900'} rounded-t-lg text-sm" data-path="requests" href="#">
          <span class="material-symbols-outlined text-[17px]">sync_alt</span>
          휴무·교환 신청 관리
        </a>
        <a class="px-4 py-2 transition-colors flex items-center gap-1.5 ${this.currentView === 'dashboard' ? 'text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60' : 'text-slate-600 hover:text-slate-900'} rounded-t-lg text-sm" data-path="dashboard" href="#">
          <span class="material-symbols-outlined text-[17px]">dashboard</span>
          운영 대시보드
        </a>
        <a class="px-3.5 py-1.5 bg-teal-50 text-teal-800 font-bold rounded-lg border border-teal-200 transition-colors flex items-center gap-1.5 text-xs hover:bg-teal-100 ml-2" data-path="mobile" href="#" title="요양보호사 모바일 뷰 미리보기">
          <span class="material-symbols-outlined text-[16px] text-teal-700">smartphone</span>
          [미리보기] 내 근무
        </a>
      `;
    } else {
      // 👩‍⚕️ 일반 요양보호사 (정회원/준회원/임시회원) PC 상단 메뉴
      pcNavLinks.innerHTML = `
        <a class="px-4 py-2 transition-colors flex items-center gap-1.5 ${this.currentView === 'mobile' ? 'text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60' : 'text-slate-600 hover:text-slate-900'} rounded-t-lg text-sm" data-path="mobile" href="#">
          <span class="material-symbols-outlined text-[17px]">calendar_today</span>
          내 오늘 근무 & 월간 일정
        </a>
        <a class="px-4 py-2 transition-colors flex items-center gap-1.5 ${this.currentView === 'requests' ? 'text-[#004349] font-bold border-b-2 border-[#004349] bg-[#eff4ff]/60' : 'text-slate-600 hover:text-slate-900'} rounded-t-lg text-sm" data-path="requests" href="#">
          <span class="material-symbols-outlined text-[17px]">event_busy</span>
          휴무·교환 신청
        </a>
      `;
    }

    // 클릭 이벤트 다시 연결
    pcNavLinks.querySelectorAll('a[data-path]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = link.getAttribute('data-path');
        this.navigate(path);
      });
    });
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
      let roleTitle = '승인 대기';
      if (this.authState.isAdmin) {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">관리자</span>`;
        roleTitle = '최고 관리자';
      } else if (profile?.role === 'REGULAR') {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">정회원</span>`;
        roleTitle = '정회원 요양보호사';
      } else if (profile?.role === 'ASSOCIATE') {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">준회원</span>`;
        roleTitle = '준회원 요양보호사';
      } else if (profile?.role === 'GUEST') {
        roleBadge = `<span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">임시회원</span>`;
        roleTitle = '임시회원 (둘러보기)';
      }

      userContainer.innerHTML = `
        <div class="relative" id="user-profile-menu-container">
          <!-- 사용자 프로필 아바타 버튼 -->
          <button id="btn-user-avatar" class="flex items-center gap-1.5 sm:gap-2 p-1 rounded-2xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200 focus:outline-none">
            ${u.photoURL ? `<img src="${u.photoURL}" class="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0"/>` : `
              <div class="w-8 h-8 rounded-full bg-[#004349] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                ${u.displayName.charAt(0)}
              </div>
            `}
            <div class="text-left hidden xs:block">
              <div class="flex items-center gap-1">
                <span class="text-xs font-bold text-slate-900 leading-tight">${u.displayName}</span>
                ${roleBadge}
              </div>
              <span class="text-[9px] text-slate-400 block leading-tight truncate max-w-[110px]">${u.email}</span>
            </div>
            <span class="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
          </button>

          <!-- 드롭다운 메뉴 (정보보기, 모드전환, 로그아웃) -->
          <div id="user-dropdown-menu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <!-- 사용자 상세 정보 헤더 -->
            <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div class="flex items-center gap-3">
                ${u.photoURL ? `<img src="${u.photoURL}" class="w-10 h-10 rounded-full object-cover border border-slate-200"/>` : `
                  <div class="w-10 h-10 rounded-full bg-[#004349] flex items-center justify-center text-white font-bold text-sm">
                    ${u.displayName.charAt(0)}
                  </div>
                `}
                <div class="overflow-hidden">
                  <div class="text-xs font-bold text-slate-900 truncate">${u.displayName}</div>
                  <div class="text-[10px] text-slate-400 truncate">${u.email}</div>
                  <div class="mt-1">${roleBadge}</div>
                </div>
              </div>
            </div>

            <!-- 정보보기 영역 -->
            <div class="px-4 py-2.5 border-b border-slate-100 text-[11px] text-slate-600 space-y-1">
              <div class="flex justify-between">
                <span class="text-slate-400">계정 권한</span>
                <span class="font-bold text-slate-800">${roleTitle}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">소속 병동</span>
                <span class="font-bold text-slate-800">늘푸른요양병원 2층</span>
              </div>
              ${profile?.staffName ? `
                <div class="flex justify-between">
                  <span class="text-slate-400">매칭 직원명</span>
                  <span class="font-bold text-teal-800">${profile.staffName}</span>
                </div>
              ` : ''}
            </div>

            <!-- 메뉴 링크들 -->
            <div class="py-1">
              ${this.authState.isAdmin ? `
                <button id="menu-btn-user-mgmt" class="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
                  <span class="material-symbols-outlined text-[17px] text-slate-500">how_to_reg</span>
                  회원 가입 승인 관리
                  ${this.pendingUsersCount > 0 ? `<span class="ml-auto px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">${this.pendingUsersCount}</span>` : ''}
                </button>
              ` : ''}

              <button id="menu-btn-logout" class="w-full px-4 py-2.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-bold transition">
                <span class="material-symbols-outlined text-[17px] text-rose-500">logout</span>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      `;

      const avatarBtn = userContainer.querySelector('#btn-user-avatar');
      const dropdown = userContainer.querySelector('#user-dropdown-menu');

      avatarBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('hidden');
      });

      // 바깥 영역 클릭 시 드롭다운 닫기
      document.addEventListener('click', (e) => {
        if (!userContainer.contains(e.target)) {
          dropdown?.classList.add('hidden');
        }
      });

      // 관리자 회원 승인 이동
      userContainer.querySelector('#menu-btn-user-mgmt')?.addEventListener('click', () => {
        dropdown?.classList.add('hidden');
        this.navigate('user-mgmt');
      });

      // 로그아웃 확인 및 실행
      userContainer.querySelector('#menu-btn-logout')?.addEventListener('click', async () => {
        dropdown?.classList.add('hidden');
        if (confirm('로그아웃 하시겠습니까?')) {
          await logoutUser();
        }
      });
    } else {
      userContainer.innerHTML = `
        <button id="btn-header-login" class="px-3 py-1.5 bg-[#004349] hover:bg-[#0d5c63] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95 touch-manipulation">
          <span class="material-symbols-outlined text-[15px]">login</span>
          로그인
        </button>
      `;
      userContainer.querySelector('#btn-header-login')?.addEventListener('click', async () => {
        const btn = userContainer.querySelector('#btn-header-login');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> 로그인 중...`;
        }
        const res = await loginWithGoogle();
        if (!res.success) {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-[15px]">login</span> 로그인`;
          }
          if (!res.isCancelled) {
            alert(`로그인 안내: ${res.error}\n(팝업이 차단되었거나 취소된 경우 다시 시도해 주세요)`);
          }
        }
      });
    }
  }

  recalculateViolations() {
    if (!this.rosterData) return;
    this.violations = validateRoster(this.rosterData.staffList, this.rosterData.assignments);
    this.updateHeaderStats();
  }

  updateHeaderStats() {
    const violationBadge = document.getElementById('header-violation-badge');
    if (!violationBadge) return;

    // 로그인 전이거나 승인 대기자에게는 위반 뱃지 숨김
    if (!this.authState.isLoggedIn || this.authState.userProfile?.status === 'PENDING' || this.authState.userProfile?.status === 'REJECTED') {
      violationBadge.classList.add('hidden');
      violationBadge.classList.remove('xs:flex');
      return;
    }

    const errorCount = this.violations.filter(v => v.type === 'error').length;
    const warnCount = this.violations.filter(v => v.type === 'warning').length;

    violationBadge.classList.remove('hidden');
    violationBadge.classList.add('xs:flex');
    violationBadge.innerHTML = `
      <span class="text-[10px] text-slate-500 hidden sm:inline">실시간 검증</span>
      <span class="inline-flex items-center px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[10px] font-bold">위반 ${errorCount}</span>
      <span class="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold hidden xs:inline-flex">주의 ${warnCount}</span>
    `;
  }

  setupNavigation() {
    this.bindBottomNavEvents();
  }

  navigate(viewName) {
    if (this.authState.isLoggedIn && !this.authState.isAdmin && (this.authState.userProfile?.status === 'PENDING' || this.authState.userProfile?.status === 'REJECTED')) {
      viewName = 'pending';
    }

    this.currentView = viewName;
    this.updatePcNavVisibility();
    this.updateBottomNavVisibility();
    
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
    // 이전 뷰의 정리 함수 호출
    if (this.currentViewCleanup && typeof this.currentViewCleanup === 'function') {
      try {
        this.currentViewCleanup();
      } catch (e) {
        console.warn("❌ 뷰 정리 중 오류:", e);
      }
    }
    this.currentViewCleanup = null;

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
        this.currentViewCleanup = renderUserManagementView(this.container, props);
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
