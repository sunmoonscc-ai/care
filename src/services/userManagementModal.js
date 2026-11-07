// 관리자 전용 신규 사용자 승인 및 권한 관리 팝업/모달
import { listAllUsers, approveUser, rejectOrRevokeUser } from './userService';

export function setupUserManagementModal(staffList, onUpdated) {
  let modal = document.getElementById('modal-user-mgmt');
  if (modal) modal.remove();

  const modalHtml = `
    <div id="modal-user-mgmt" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs hidden p-4 font-sans animate-in fade-in duration-150">
      <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        <!-- 헤더 -->
        <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[20px]">manage_accounts</span>
            </div>
            <div>
              <h3 class="font-extrabold text-slate-900 text-sm">신규 사용자 접속 승인 & 회원 관리</h3>
              <p class="text-[11px] text-slate-400">정회원, 준회원(가입취소 가능), 임시회원(둘러보기) 승인 및 거절</p>
            </div>
          </div>
          <button id="btn-close-user-mgmt" class="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- 사용자 리스트 영역 -->
        <div id="user-mgmt-list" class="flex-1 overflow-y-auto p-6 space-y-4">
          <!-- Dynamically populated -->
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('modal-user-mgmt');

  modal.querySelector('#btn-close-user-mgmt')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  const openModal = async () => {
    modal.classList.remove('hidden');
    await renderList();
  };

  const renderList = async () => {
    const listContainer = modal.querySelector('#user-mgmt-list');
    const users = await listAllUsers();

    if (users.length === 0) {
      listContainer.innerHTML = `
        <div class="py-12 text-center text-slate-400 text-xs">
          <span class="material-symbols-outlined text-[36px] text-slate-300 mb-2">person_off</span>
          <p>접속 신청 중이거나 등록된 사용자가 없습니다.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = users.map(u => {
      const isPending = u.status === 'PENDING';
      const isRejected = u.status === 'REJECTED';
      const isAssociate = u.role === 'ASSOCIATE';
      const isRegular = u.role === 'REGULAR';
      const isGuest = u.role === 'GUEST';

      return `
        <div class="p-4 rounded-2xl border ${isPending ? 'bg-amber-50/70 border-amber-200' : isRejected ? 'bg-red-50/50 border-red-200 opacity-60' : 'bg-white border-slate-200'} shadow-sm space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm">
                ${(u.displayName || u.email).charAt(0)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-sm text-slate-900">${u.displayName || '이름 없음'}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isPending ? 'bg-amber-200 text-amber-900' :
                    isRejected ? 'bg-red-200 text-red-900' :
                    isRegular ? 'bg-emerald-100 text-emerald-800' :
                    isAssociate ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-200 text-slate-700'
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

            <!-- 매핑할 요양보호사 직원 선택 (정회원/준회원용) -->
            ${!isRejected ? `
              <div class="flex items-center gap-1.5 text-xs">
                <span class="text-slate-400 font-medium">직원 매핑:</span>
                <select class="select-staff-mapping text-xs font-bold py-1 px-2 rounded-lg border border-slate-300 bg-white" data-email="${u.email}">
                  <option value="">(매핑 안함 / 둘러보기)</option>
                  ${staffList.map(s => `
                    <option value="${s.id}" ${u.staffId === s.id ? 'selected' : ''}>${s.name} (${s.role || '요양보호사'})</option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          <!-- 승인 및 관리 액션 버튼들 -->
          <div class="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100 text-xs">
            ${isPending ? `
              <button class="btn-approve-role px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition" data-email="${u.email}" data-role="REGULAR">
                정회원 승인
              </button>
              <button class="btn-approve-role px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg transition" data-email="${u.email}" data-role="ASSOCIATE">
                준회원 승인
              </button>
              <button class="btn-approve-role px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg transition" data-email="${u.email}" data-role="GUEST">
                임시회원 (둘러보기만)
              </button>
              <button class="btn-reject-user px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg transition" data-email="${u.email}">
                가입 거절
              </button>
            ` : isAssociate ? `
              <button class="btn-revoke-associate px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition" data-email="${u.email}">
                준회원 가입 취소
              </button>
              <button class="btn-approve-role px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition" data-email="${u.email}" data-role="REGULAR">
                정회원으로 승격
              </button>
            ` : isRegular ? `
              <span class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">check_circle</span> 정회원 이용 중
              </span>
              <button class="btn-reject-user ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition" data-email="${u.email}">
                이용 중단
              </button>
            ` : isGuest ? `
              <span class="text-xs text-slate-500 font-bold">임시회원 (둘러보기)</span>
              <button class="btn-approve-role ml-2 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition" data-email="${u.email}" data-role="REGULAR">
                정회원 전환
              </button>
            ` : `
              <button class="btn-approve-role px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition" data-email="${u.email}" data-role="ASSOCIATE">
                재승인 처리
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // 이벤트 리스너 부착
    listContainer.querySelectorAll('.btn-approve-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.dataset.email;
        const role = btn.dataset.role;
        const mappingSelect = listContainer.querySelector(`.select-staff-mapping[data-email="${email}"]`);
        const staffId = mappingSelect ? mappingSelect.value : null;

        await approveUser({ email, role, staffId });
        alert(`✅ [${email}] 사용자가 [${role === 'REGULAR' ? '정회원' : role === 'ASSOCIATE' ? '준회원' : '임시회원'}]으로 승인되었습니다.`);
        await renderList();
        if (onUpdated) onUpdated();
      });
    });

    listContainer.querySelectorAll('.btn-reject-user, .btn-revoke-associate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.dataset.email;
        const reason = prompt('가입 거절 / 취소 사유를 입력하세요:', '병원 인력 확인 불가 또는 권한 회수') || '관리자 권한 회수';
        await rejectOrRevokeUser(email, reason);
        alert(`🚫 [${email}] 사용자의 권한이 제한되었습니다.`);
        await renderList();
        if (onUpdated) onUpdated();
      });
    });
  };

  return openModal;
}

