// 휴무 및 근무 교환 관리 뷰 (파이어베이스 실시간 연동 및 승인 시 근무표 자동 반영)
import { loadRequests, updateRequestStatus, saveRequest } from '../services/requestService';

export function renderShiftExchangeView(container, { rosterData, authState, onUpdateRoster, navigate }) {
  let activeTab = 'ALL'; // 'ALL', 'PENDING', 'APPROVED'

  const loadAndRender = async () => {
    const requests = await loadRequests();
    const filtered = requests.filter(r => {
      if (activeTab === 'PENDING') return r.status.includes('PENDING');
      if (activeTab === 'APPROVED') return r.status === 'APPROVED';
      return true;
    });

    const pendingCount = requests.filter(r => r.status.includes('PENDING')).length;
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length;

    container.innerHTML = `
      <div class="px-6 py-6 max-w-7xl mx-auto space-y-6">
        <!-- 헤더 바 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-bold">실시간 처리 연동</span>
              <span class="text-xs text-slate-400">파이어베이스 Firestore 동기화 가동</span>
            </div>
            <h1 class="text-xl font-bold text-slate-900 mt-1">휴무 신청 및 1:1 근무 교환 관리</h1>
            <p class="text-xs text-slate-500 mt-0.5">요양보호사 모바일에서 접수된 희망 휴무(OFF) 및 동료 간 맞교환을 관리자 권한으로 승인/반려합니다.</p>
          </div>

          <div class="flex items-center gap-2">
            ${authState.isAdmin ? `
              <button id="btn-batch-approve-all" class="px-3.5 py-2 bg-[#004349] hover:bg-[#0d5c63] text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">done_all</span>
                대기 건 전체 일괄 승인
              </button>
            ` : `
              <span class="text-xs text-slate-400 font-medium">관리자 전용 승인 화면</span>
            `}
          </div>
        </div>

        <!-- 필터 탭 & 목록 카드 -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
            <span class="text-xs text-slate-400">승인 즉시 월간 근무표에 빨간색(요청)으로 자동 반영</span>
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
                    ${req.targetName !== '-' ? `<span class="text-slate-400">➔ 상대방: <b>${req.targetName}</b></span>` : ''}
                    <span class="text-slate-400">| 날짜: <b>${req.date}</b></span>
                    <span class="text-[10px] text-slate-400">(${req.createdAt})</span>
                  </div>

                  <div class="text-slate-800 font-semibold flex items-center gap-2">
                    <span>변경 내용: <b>${req.fromShift}</b> ➔ <b>${req.toShift}</b></span>
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
                      <span class="text-[11px] text-slate-400">관리자 승인 대기</span>
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

    // 개별 승인 이벤트
    container.querySelectorAll('.btn-approve-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const targetReq = requests.find(r => r.id === id);
        if (!targetReq) return;

        // 근무표에 반영 (빨간색 요청 셀로 자동 주입)
        applyRequestToRoster(targetReq);

        await updateRequestStatus(id, 'APPROVED', '승인 완료 (근무표 반영됨)');
        alert(`✅ [${targetReq.requesterName}님]의 신청이 승인되어 9월 근무표에 빨간색으로 자동 반영되었습니다.`);
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

  // 신청 내용을 실제 근무표에 반영하는 함수
  const applyRequestToRoster = (req) => {
    // 예: "2026-09-17" 에서 일자 추출
    const day = parseInt(req.date.split('-')[2], 10);
    const staffAssignments = rosterData.assignments[req.requesterId];

    if (staffAssignments) {
      const targetCell = staffAssignments.find(a => a.day === day);
      if (targetCell) {
        targetCell.code = req.toShift;
        targetCell.isRequested = true; // 빨간색 표기
        targetCell.note = `신청 반영: ${req.reason}`;
      }
    }

    // 맞교환인 경우 상대방도 교환 반영
    if (req.type === 'SWAP' && req.targetId) {
      const targetStaffAssign = rosterData.assignments[req.targetId];
      if (targetStaffAssign) {
        const targetCell2 = targetStaffAssign.find(a => a.day === day);
        if (targetCell2) {
          targetCell2.code = req.fromShift;
          targetCell2.isRequested = true;
          targetCell2.note = `맞교환 반영 (${req.requesterName})`;
        }
      }
    }

    // 근무표 업데이트 트리거
    onUpdateRoster(rosterData);
  };

  loadAndRender();
}
