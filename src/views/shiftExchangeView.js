// 휴무 및 근무 교환 관리 뷰 (파이어베이스 실시간 연동 및 승인 시 근무표 자동 반영)
import { loadRequests, updateRequestStatus, saveRequest } from '../services/requestService';

export function renderShiftExchangeView(container, { rosterData, authState, onUpdateRoster, navigate }) {
  let activeTab = 'ALL'; // 'ALL', 'PENDING', 'APPROVED'

  const loadAndRender = async () => {
    const allRequests = await loadRequests();

    // 일반 직원인 경우 본인과 관련된 신청 내역만 필터링하여 노출
    const requests = authState.isAdmin
      ? allRequests
      : allRequests.filter(r => 
          r.requesterId === authState.userProfile?.staffId ||
          r.requesterName === authState.userProfile?.realName ||
          r.requesterName === authState.user?.displayName ||
          r.targetId === authState.userProfile?.staffId
        );

    const filtered = requests.filter(r => {
      if (activeTab === 'PENDING') return r.status.includes('PENDING');
      if (activeTab === 'APPROVED') return r.status === 'APPROVED';
      return true;
    });

    const pendingCount = requests.filter(r => r.status.includes('PENDING')).length;
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length;

    container.innerHTML = `
      <div class="px-4 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto space-y-6 pb-24">
        <!-- 헤더 바 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-bold">
                ${authState.isAdmin ? '관리자 승인 모드' : '내 신청 내역 현황'}
              </span>
              <span class="text-xs text-slate-400">실시간 연동</span>
            </div>
            <h1 class="text-xl font-bold text-slate-900 mt-1">
              ${authState.isAdmin ? '휴무 신청 및 1:1 근무 교환 관리' : '내 희망 휴무 및 근무 맞교환 내역'}
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              ${authState.isAdmin 
                ? '요양보호사 모바일에서 접수된 희망 휴무(OFF) 및 동료 간 맞교환을 관리자 권한으로 승인/반려합니다.'
                : '내가 접수한 12월 희망 휴무(1~3순위) 및 동료와의 맞교환 신청 진행 상태를 확인합니다.'}
            </p>
          </div>

          <div class="flex items-center gap-2">
            ${authState.isAdmin ? `
              <button id="btn-batch-approve-all" class="px-3.5 py-2 bg-[#004349] hover:bg-[#0d5c63] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">done_all</span>
                대기 건 전체 일괄 승인
              </button>
            ` : `
              <button id="btn-goto-my-mobile-view" class="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl border border-teal-200 transition flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">calendar_today</span>
                내 오늘 근무 보기
              </button>
            `}
          </div>
        </div>

        <!-- 필터 탭 & 목록 카드 -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div class="flex gap-4 text-xs font-bold text-slate-600">
              <button class="tab-btn pb-2 ${activeTab === 'ALL' ? 'text-teal-800 border-b-2 border-teal-800' : 'hover:text-slate-900'}" data-tab="ALL">
                전체 내역 (${requests.length})
              </button>
              <button class="tab-btn pb-2 ${activeTab === 'PENDING' ? 'text-teal-800 border-b-2 border-teal-800' : 'hover:text-slate-900'}" data-tab="PENDING">
                승인 대기 (${pendingCount})
              </button>
              <button class="tab-btn pb-2 ${activeTab === 'APPROVED' ? 'text-teal-800 border-b-2 border-teal-800' : 'hover:text-slate-900'}" data-tab="APPROVED">
                승인 완료 (${approvedCount})
              </button>
            </div>
            <span class="text-xs text-slate-400">
              ${authState.isAdmin ? '승인 시 월간 근무표에 자동 반영' : '관리자 승인 대기 중'}
            </span>
          </div>

          <div class="divide-y divide-slate-200">
            ${filtered.length === 0 ? `
              <div class="p-10 text-center text-xs text-slate-400">
                <span class="material-symbols-outlined text-[36px] text-slate-300 mb-1">inbox</span>
                <p>해당 상태의 신청 내역이 없습니다.</p>
              </div>
            ` : filtered.map(req => `
              <div class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition">
                <div class="space-y-1.5 text-xs">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold ${
                      req.type === 'SWAP' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }">${req.typeName}</span>
                    <span class="font-bold text-sm text-slate-900">${req.requesterName}</span>
                    ${req.targetName && req.targetName !== '-' ? `<span class="text-slate-400">➔ 상대방: <b>${req.targetName}</b></span>` : ''}
                    <span class="text-slate-400">| 날짜: <b>${req.date}</b></span>
                    <span class="text-[10px] text-slate-400">(${req.createdAt})</span>
                  </div>

                  <div class="text-slate-800 font-semibold flex items-center gap-2">
                    <span>구분/변경: <b>${req.fromShift}</b> ➔ <b>${req.toShift}</b></span>
                    ${req.rank ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 font-bold">${req.rank}순위 희망</span>` : ''}
                  </div>
                  <div class="text-slate-500">신청 사유: ${req.reason}</div>
                </div>

                <div class="flex items-center gap-3 shrink-0">
                  <span class="text-xs font-bold ${req.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}">
                    ${req.statusText}
                  </span>

                  ${req.status !== 'APPROVED' ? `
                    ${authState.isAdmin ? `
                      <button class="btn-approve-single px-3 py-1.5 bg-[#004349] hover:bg-[#0d5c63] text-white text-xs font-bold rounded shadow-sm transition" data-id="${req.id}">
                        최종 승인
                      </button>
                      <button class="btn-reject-single px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 transition" data-id="${req.id}">
                        반려
                      </button>
                    ` : `
                      <span class="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">승인 대기중</span>
                    `}
                  ` : `
                    <span class="material-symbols-outlined text-emerald-600 text-[20px]" title="근무표 반영 완료">check_circle</span>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // 탭 전환 이벤트
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeTab = e.currentTarget.dataset.tab;
        loadAndRender();
      });
    });

    container.querySelector('#btn-goto-my-mobile-view')?.addEventListener('click', () => {
      navigate('mobile');
    });

    // 개별 승인 이벤트
    container.querySelectorAll('.btn-approve-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const targetReq = requests.find(r => r.id === id);
        if (!targetReq) return;

        applyRequestToRoster(targetReq);
        await updateRequestStatus(id, 'APPROVED', '승인 완료 (근무표 반영됨)');
        alert(`✅ [${targetReq.requesterName}님]의 신청이 승인되어 근무표에 자동 반영되었습니다.`);
        loadAndRender();
      });
    });

    // 개별 반려 이벤트
    container.querySelectorAll('.btn-reject-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await updateRequestStatus(id, 'REJECTED', '반려됨');
        alert('신청이 반려 처리되었습니다.');
        loadAndRender();
      });
    });

    // 일괄 승인 이벤트
    container.querySelector('#btn-batch-approve-all')?.addEventListener('click', async () => {
      const pendingList = requests.filter(r => r.status.includes('PENDING'));
      if (pendingList.length === 0) {
        alert('승인 대기 중인 신청이 없습니다.');
        return;
      }

      for (const req of pendingList) {
        applyRequestToRoster(req);
        await updateRequestStatus(req.id, 'APPROVED', '승인 완료 (근무표 반영됨)');
      }

      alert(`✅ 대기 중인 ${pendingList.length}건의 신청이 모두 승인되어 근무표에 반영되었습니다.`);
      loadAndRender();
    });
  };

  const applyRequestToRoster = (req) => {
    const day = parseInt(req.date.split('-')[2], 10);
    const staffAssignments = rosterData.assignments[req.requesterId];

    if (staffAssignments) {
      const cell = staffAssignments.find(a => a.day === day);
      if (cell) {
        cell.code = req.toShift;
        cell.isRequested = true;
        cell.note = `[신청승인] ${req.reason}`;
      }
    }

    if (req.type === 'SWAP' && req.targetId) {
      const targetStaffAssign = rosterData.assignments[req.targetId];
      if (targetStaffAssign) {
        const targetCell = targetStaffAssign.find(a => a.day === day);
        if (targetCell) {
          targetCell.code = req.fromShift;
          targetCell.isRequested = true;
          targetCell.note = `[맞교환] ${req.requesterName}와 변경`;
        }
      }
    }

    onUpdateRoster(rosterData);
  };

  loadAndRender();
}
