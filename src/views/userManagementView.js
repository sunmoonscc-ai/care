// 회원 승인 및 가입 관리 전용 뷰 (관리자 상단 및 탭에서 언제든 바로 접근 가능)
import { listAllUsers, approveUser, rejectOrRevokeUser, subscribeUsersList } from '../services/userService';

export function renderUserManagementView(container, { staffList, onUpdated, navigate }) {
  let activeTab = 'PENDING'; // 'PENDING', 'APPROVED', 'ALL'

  container.innerHTML = `
    <div class="px-4 sm:px-6 py-4 sm:py-6 max-w-6xl mx-auto space-y-5 font-sans">
      <!-- 헤더 카드 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-xs font-bold">관리자 전용</span>
            <span class="text-xs text-slate-400">인력 보안 및 권한 제어</span>
          </div>
          <h1 class="text-xl font-black text-slate-900 mt-1">회원 가입 승인 & 접속 권한 관리</h1>
          <p class="text-xs text-slate-500 mt-0.5">신규 가입 신청자를 확인하고 <b>정회원, 준회원(가입취소 가능), 임시회원(둘러보기)</b> 등급으로 승인합니다.</p>
        </div>

        <button id="btn-back-to-editor" class="self-start sm:self-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          근무표로 돌아가기
        </button>
      </div>

      <!-- 탭 & 사용자 목록 컨테이너 -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div class="flex gap-4 text-xs font-bold text-slate-600">
            <button class="user-tab-btn pb-2 border-b-2 border-transparent transition" data-tab="PENDING">
              가입 승인 대기 <span id="tab-count-pending" class="ml-1 px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px]">0</span>
            </button>
            <button class="user-tab-btn pb-2 border-b-2 border-transparent transition" data-tab="APPROVED">
              승인된 회원 <span id="tab-count-approved" class="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">0</span>
            </button>
            <button class="user-tab-btn pb-2 border-b-2 border-transparent transition" data-tab="ALL">
              전체 내역
            </button>
          </div>
          <span class="text-[11px] text-slate-400 hidden sm:inline">실시간 자동 갱신 중</span>
        </div>

        <div id="users-list-content" class="divide-y divide-slate-200 p-2 sm:p-4 space-y-3">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-back-to-editor')?.addEventListener('click', () => {
    navigate('editor');
  });

  const loadAndRenderList = async () => {
    try {
      const users = await listAllUsers();

      // 카운트 갱신
      const pendingList = users.filter(u => u.status === 'PENDING');
      const approvedList = users.filter(u => u.status === 'APPROVED');

      const countPendingEl = container.querySelector('#tab-count-pending');
      const countApprovedEl = container.querySelector('#tab-count-approved');
      if (countPendingEl) countPendingEl.innerText = pendingList.length;
      if (countApprovedEl) countApprovedEl.innerText = approvedList.length;

      // 탭 스타일 갱신
      container.querySelectorAll('.user-tab-btn').forEach(btn => {
        const tab = btn.dataset.tab;
        if (tab === activeTab) {
          btn.className = 'user-tab-btn pb-2 font-black text-teal-800 border-b-2 border-teal-800';
        } else {
          btn.className = 'user-tab-btn pb-2 font-bold text-slate-500 hover:text-slate-800 border-b-2 border-transparent';
        }
      });

      const listContent = container.querySelector('#users-list-content');
      const filtered = users.filter(u => {
        if (activeTab === 'PENDING') return u.status === 'PENDING';
        if (activeTab === 'APPROVED') return u.status === 'APPROVED';
        return true;
      });

      if (filtered.length === 0) {
        listContent.innerHTML = `
          <div class="py-12 text-center text-slate-400 text-xs">
            <span class="material-symbols-outlined text-[36px] text-slate-300 mb-2">person_search</span>
            <p>${activeTab === 'PENDING' ? '현재 가입 승인 대기 중인 사용자가 없습니다.' : '해당 목록의 사용자가 없습니다.'}</p>
          </div>
        `;
        return;
      }

      listContent.innerHTML = filtered.map(u => {
        const isPending = u.status === 'PENDING';
        const isRejected = u.status === 'REJECTED';
        const isRegular = u.role === 'REGULAR';
        const isAssociate = u.role === 'ASSOCIATE';
        const isGuest = u.role === 'GUEST';

        return `
          <div class="p-4 rounded-2xl border ${isPending ? 'bg-amber-50/70 border-amber-200 ring-1 ring-amber-300' : isRejected ? 'bg-red-50/50 border-red-200 opacity-60' : 'bg-white border-slate-200'} shadow-sm space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0">
                  ${(u.displayName || u.email).charAt(0)}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-sm text-slate-900">${u.displayName || '이름 미설정'}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isPending ? 'bg-amber-200 text-amber-900' :
                      isRejected ? 'bg-red-200 text-red-900' :
                      isRegular ? 'bg-emerald-100 text-emerald-800' :
                      isAssociate ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                    }">
                      ${
                        isPending ? '가입 대기' :
                        isRejected ? '가입 거절됨' :
                        isRegular ? '정회원' :
                        isAssociate ? '준회원 (취소가능)' : '임시회원 (둘러보기)'
                      }
                    </span>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">${u.email} · 신청일: ${u.appliedAt || '-'}</p>
                </div>
              </div>

              <!-- 매핑할 요양보호사 직원 선택 -->
              ${!isRejected ? `
                <div class="flex items-center gap-1.5 text-xs bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <span class="text-slate-500 font-bold">직원 매핑:</span>
                  <select class="select-staff-mapping text-xs font-bold py-1 px-2 rounded-lg border border-slate-300 bg-white" data-email="${u.email}">
                    <option value="">(매핑 안함 / 둘러보기)</option>
                    ${staffList.map(s => `
                      <option value="${s.id}" ${u.staffId === s.id ? 'selected' : ''}>${s.name} (${s.role || '요양보호사'})</option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}
            </div>

            <!-- 승인 액션 버튼 그룹 -->
            <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              ${isPending ? `
                <button class="btn-approve-role px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-lg shadow-sm transition" data-email="${u.email}" data-role="REGULAR">
                  정회원 승인
                </button>
                <button class="btn-approve-role px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-extrabold rounded-lg shadow-sm transition" data-email="${u.email}" data-role="ASSOCIATE">
                  준회원 승인
                </button>
                <button class="btn-approve-role px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-extrabold rounded-lg shadow-sm transition" data-email="${u.email}" data-role="GUEST">
                  임시회원 (둘러보기만)
                </button>
                <button class="btn-reject-user px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-extrabold rounded-lg transition" data-email="${u.email}">
                  가입 거절
                </button>
              ` : isAssociate ? `
                <button class="btn-revoke-associate px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg shadow-sm transition" data-email="${u.email}">
                  준회원 가입 취소
                </button>
                <button class="btn-approve-role px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-lg transition" data-email="${u.email}" data-role="REGULAR">
                  정회원으로 승격
                </button>
              ` : isRegular ? `
                <span class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">check_circle</span> 정회원 이용 중
                </span>
                <button class="btn-reject-user ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition" data-email="${u.email}">
                  권한 회수
                </button>
              ` : isGuest ? `
                <span class="text-xs text-slate-500 font-bold">임시회원 (둘러보기)</span>
                <button class="btn-approve-role ml-2 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-lg transition" data-email="${u.email}" data-role="REGULAR">
                  정회원 전환
                </button>
              ` : `
                <button class="btn-approve-role px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-extrabold rounded-lg transition" data-email="${u.email}" data-role="ASSOCIATE">
                  재승인 처리
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');

      // 승인 이벤트
      listContent.querySelectorAll('.btn-approve-role').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.dataset.email;
          const role = btn.dataset.role;
          const mappingSelect = listContent.querySelector(`.select-staff-mapping[data-email="${email}"]`);
          const staffId = mappingSelect ? mappingSelect.value : null;

          await approveUser({ email, role, staffId });
          alert(`✅ [${email}] 사용자가 [${role === 'REGULAR' ? '정회원' : role === 'ASSOCIATE' ? '준회원' : '임시회원'}]으로 승인되었습니다.`);
          await loadAndRenderList();
          if (onUpdated) onUpdated();
        });
      });

      // 거절/취소 이벤트
      listContent.querySelectorAll('.btn-reject-user, .btn-revoke-associate').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.dataset.email;
          const reason = prompt('가입 거절 / 취소 사유를 입력하세요:', '병원 인력 확인 불가 또는 권한 회수') || '관리자 권한 회수';
          await rejectOrRevokeUser(email, reason);
          alert(`🚫 [${email}] 사용자의 권한이 제한되었습니다.`);
          await loadAndRenderList();
          if (onUpdated) onUpdated();
        });
      });
    } catch (error) {
      console.error("❌ [userManagementView] 오류:", error);
      const listContent = container.querySelector('#users-list-content');
      if (listContent) {
        listContent.innerHTML = `<div class="p-4 text-red-600 text-sm">오류 발생: ${error.message}</div>`;
      }
    }
  };

  // 탭 클릭
  container.querySelectorAll('.user-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeTab = e.currentTarget.dataset.tab;
      loadAndRenderList();
    });
  });

  loadAndRenderList();

  // 자동 갱신
  const autoRefreshInterval = setInterval(async () => {
    await loadAndRenderList();
  }, 5000);

  return () => clearInterval(autoRefreshInterval);
}

