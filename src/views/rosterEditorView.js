// 실제 요양병원 양식 그대로 재현한 월간 근무기록지 편집 & 배포 뷰
import { realShiftTypes } from '../services/realRosterData';
import { saveRosterData, syncRosterFromFirestore } from '../services/rosterService';
import { getSheetConfig, saveSheetConfig, syncRosterToGoogleSheet } from '../services/googleSheetService';
import { setupGoogleSheetModal } from '../services/googleSheetModal';
import { exportRosterToCSV } from '../services/excelService';

export function renderRosterEditorView(container, { rosterData, violations, onUpdateRoster, navigate }) {
  const daysInMonth = 30;
  const staffList = rosterData.staffList;
  const assignments = rosterData.assignments;
  const changeLogs = rosterData.changeLogs || [];

  // 2026년 9월 1일은 화요일
  const dayNames = ['화', '수', '목', '금', '토', '일', '월', '화', '수', '목', '금', '토', '일', '월', '화', '수', '목', '금', '토', '일', '월', '화', '수', '목', '금', '토', '일', '월', '화', '수'];

  container.innerHTML = `
    <div class="flex flex-col w-full h-[calc(100vh-8.5rem)] md:h-[calc(100vh-5rem)] overflow-hidden bg-slate-100">
      <!-- 엑셀 스타일 조작 툴바 -->
      <section class="w-full px-3 sm:px-6 py-2 bg-white flex flex-wrap items-center justify-between border-b border-slate-300 shrink-0 gap-2 shadow-sm">
        <div class="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1">
          <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 shrink-0">
            ${rosterData.status === 'published' ? '공식 배포본' : '작성중 초안'}
          </span>
          <h1 class="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight shrink-0">
            ${rosterData.title}
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto py-1">
          <!-- 월별 새로 작성 바로가기 버튼 -->
          <button id="btn-goto-monthly-from-editor" class="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-black rounded-lg border border-teal-300 flex items-center gap-1 transition shadow-xs shrink-0" title="환자 수 및 법정 기준에 맞춰 새 달의 근무표를 생성합니다">
            <span class="material-symbols-outlined text-[15px] text-teal-700">calendar_month</span>
            새 달 근무표 작성
          </button>
          <!-- DB 비교 및 최신 동기화 버튼 -->
          <button id="btn-sync-roster-db" class="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold rounded-lg border border-sky-300 flex items-center gap-1 transition shadow-xs shrink-0" title="자체 캐시와 실시간 DB를 비교하여 근무표를 최신화합니다">
            <span class="material-symbols-outlined text-[15px] text-sky-700">sync</span>
            DB 실시간 동기화
          </button>
          <!-- 구글 시트 연동 버튼 -->
          <button id="btn-sync-gsheet" class="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-300 flex items-center gap-1 transition shadow-xs shrink-0">
            <span class="material-symbols-outlined text-[15px] text-emerald-700">table_view</span>
            구글시트 동기화
          </button>
          <a id="link-open-gsheet" href="https://docs.google.com/spreadsheets/u/0/" target="_blank" class="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-300 flex items-center gap-1 transition shrink-0" title="작업 중인 구글 시트 웹으로 열기">
            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
            시트 열기
          </a>
          <button id="btn-publish-roster" class="px-2.5 py-1.5 bg-[#004349] hover:bg-[#0d5c63] text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition shrink-0">
            <span class="material-symbols-outlined text-[15px]">send</span>
            공식 배포
          </button>
          <button id="btn-print-excel" class="hidden sm:flex px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg shadow-sm items-center gap-1 transition shrink-0">
            <span class="material-symbols-outlined text-[15px]">print</span>
            인쇄/PDF
          </button>
        </div>
      </section>

      <!-- 실제 서식 규칙 안내 바 (모바일 가로 스크롤 가능) -->
      <section class="w-full px-3 sm:px-6 py-1 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap gap-3">
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-800">📋 근무코드:</span>
          <span><b>B/D</b>(주간)</span>
          <span><b>N</b>(전반야 4H)</span>
          <span><b>N1</b>(후반야 4H)</span>
          <span><b>X</b>(비번)</span>
          <span class="text-rose-600 font-bold">• 빨간색: 희망휴무/변경</span>
        </div>
        <div class="text-[10px] text-slate-400">
          * 셀 클릭 시 순환 수정
        </div>
      </section>

      <!-- 엑셀 서식 완벽 구현 테이블 (가로/세로 독립 터치 스크롤) -->
      <div class="flex-1 flex overflow-hidden p-2 sm:p-4">
        <div class="flex-1 overflow-auto bg-white rounded-lg border border-slate-400 shadow relative touch-pan-x touch-pan-y">
          <table class="w-full border-collapse text-xs text-center border-slate-400 select-none">
            <!-- 상단 헤더 -->
            <thead>
              <!-- 제목 및 날짜 라인 -->
              <tr class="bg-slate-100 border-b border-slate-400 font-bold text-slate-800">
                <th rowspan="2" class="border-r border-slate-400 w-10 py-1 bg-slate-200">B<br><span class="text-[10px] text-slate-500 font-normal">(주간)</span></th>
                <th rowspan="2" class="border-r border-slate-400 w-8 py-1 bg-slate-200">B2</th>
                <th rowspan="2" class="border-r border-slate-400 w-12 py-1 bg-slate-200">N근무<br><span class="text-[10px] text-slate-500 font-normal">(야간)</span></th>
                <th rowspan="2" class="border-r-2 border-slate-500 w-20 py-1 bg-slate-200 sticky left-0 z-30">성명</th>
                ${Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayName = dayNames[i];
                  const isWeekend = (dayName === '토' || dayName === '일');
                  const colBg = isWeekend ? 'bg-sky-100 font-bold text-sky-900' : 'bg-slate-50 text-slate-800';
                  return `
                    <th class="border-r border-slate-300 w-7 py-0.5 ${colBg}">
                      ${day}
                    </th>
                  `;
                }).join('')}
                <th rowspan="2" class="border-l-2 border-slate-500 w-16 py-1 bg-slate-200 sticky right-0 z-30">서명란</th>
              </tr>
              <!-- 요일 라인 -->
              <tr class="bg-slate-100 border-b-2 border-slate-500 font-bold text-slate-700">
                ${Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayName = dayNames[i];
                  const isWeekend = (dayName === '토' || dayName === '일');
                  const colBg = isWeekend ? 'bg-sky-100 text-sky-900 font-bold' : 'bg-slate-50';
                  return `
                    <th class="border-r border-slate-300 py-0.5 text-[11px] ${colBg}">
                      ${dayName}
                    </th>
                  `;
                }).join('')}
              </tr>
            </thead>

            <!-- 직원별 근무표 행 -->
            <tbody class="divide-y divide-slate-300">
              ${staffList.map((staff) => {
                const staffAssign = assignments[staff.id] || [];
                let bCount = 0;
                let b2Count = 0;
                let nCount = 0;

                staffAssign.forEach(a => {
                  if (a.code === 'B' || a.code === 'D') bCount++;
                  if (a.code === 'B2' || a.code === 'D2') b2Count++;
                  if (a.code === 'N' || a.code === 'N1') nCount++;
                });

                return `
                  <tr class="hover:bg-amber-50/40 transition-colors h-7 text-xs">
                    <!-- 좌측 고정 요약 (B, B2, N근무, 성명) -->
                    <td class="border-r border-slate-400 font-bold text-slate-700 bg-slate-50">${bCount}</td>
                    <td class="border-r border-slate-400 text-slate-500 bg-slate-50">${b2Count > 0 ? b2Count : ''}</td>
                    <td class="border-r border-slate-400 font-bold text-slate-700 bg-slate-50">${nCount}</td>
                    <td class="border-r-2 border-slate-500 font-bold text-slate-900 bg-white sticky left-0 z-20 px-2 text-left shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                      ${staff.name}
                    </td>

                    <!-- 1~30일 셀 -->
                    ${Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const assign = staffAssign.find(a => a.day === day) || { day, code: 'X' };
                      const code = assign.code;
                      const dayName = dayNames[i];
                      const isWeekend = (dayName === '토' || dayName === '일');
                      
                      // 실제 서식 색상: 주말은 옅은 하늘색 배경, 빨간 글자는 신청/변경
                      const isRedText = assign.isRequested;
                      const isNight = (code === 'N' || code === 'N1');
                      const cellBg = isWeekend ? 'bg-sky-50/80' : 'bg-white';

                      return `
                        <td 
                          class="border-r border-slate-300 p-0 cursor-pointer ${cellBg} relative hospital-cell hover:ring-1 hover:ring-teal-500"
                          data-staff-id="${staff.id}"
                          data-day="${day}"
                          data-code="${code}"
                          data-requested="${isRedText ? 'true' : 'false'}"
                          title="${staff.name} 9/${day}: ${code}${isRedText ? ' (요청/대체변경)' : ''}"
                        >
                          <span class="inline-block w-full py-1 text-xs font-bold leading-none ${isRedText ? 'text-red-600 font-extrabold' : isNight ? 'text-slate-900 font-bold' : 'text-slate-800'}">
                            ${code}
                          </span>
                        </td>
                      `;
                    }).join('')}

                    <!-- 서명란 -->
                    <td class="border-l-2 border-slate-500 bg-slate-50 sticky right-0 z-20 text-[10px] text-slate-400">
                      인
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>

            <!-- 하단 통계 합계 행 (실제 병원 서식 기준: B, B2, N1, N) -->
            <tfoot class="border-t-2 border-slate-500 font-bold text-slate-900 bg-slate-100">
              <!-- 주간 B 행 -->
              <tr class="h-6">
                <td colspan="4" class="border-r-2 border-slate-500 font-bold bg-slate-200">B (주간)</td>
                ${Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  let sum = 0;
                  staffList.forEach(s => {
                    const c = (assignments[s.id] || []).find(a => a.day === day)?.code;
                    if (c === 'B' || c === 'D') sum++;
                  });
                  return `<td class="border-r border-slate-300 text-xs">${sum}</td>`;
                }).join('')}
                <td class="border-l-2 border-slate-500"></td>
              </tr>
              <!-- B2 행 -->
              <tr class="h-6">
                <td colspan="4" class="border-r-2 border-slate-500 font-bold bg-slate-200">B2 (지원)</td>
                ${Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  let sum = 0;
                  staffList.forEach(s => {
                    const c = (assignments[s.id] || []).find(a => a.day === day)?.code;
                    if (c === 'B2' || c === 'D2') sum++;
                  });
                  return `<td class="border-r border-slate-300 text-xs text-slate-500">${sum}</td>`;
                }).join('')}
                <td class="border-l-2 border-slate-500"></td>
              </tr>
              <!-- N1 행 (후반야) -->
              <tr class="h-6">
                <td colspan="4" class="border-r-2 border-slate-500 font-bold bg-slate-200">N1 (후반야 4H)</td>
                ${Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  let sum = 0;
                  staffList.forEach(s => {
                    const c = (assignments[s.id] || []).find(a => a.day === day)?.code;
                    if (c === 'N1') sum++;
                  });
                  return `<td class="border-r border-slate-300 text-xs ${sum < 1 ? 'bg-red-100 text-red-700' : ''}">${sum}</td>`;
                }).join('')}
                <td class="border-l-2 border-slate-500"></td>
              </tr>
              <!-- N 행 (전반야) -->
              <tr class="h-6">
                <td colspan="4" class="border-r-2 border-slate-500 font-bold bg-slate-200">N (전반야 4H)</td>
                ${Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  let sum = 0;
                  staffList.forEach(s => {
                    const c = (assignments[s.id] || []).find(a => a.day === day)?.code;
                    if (c === 'N') sum++;
                  });
                  return `<td class="border-r border-slate-300 text-xs ${sum < 1 ? 'bg-red-100 text-red-700' : ''}">${sum}</td>`;
                }).join('')}
                <td class="border-l-2 border-slate-500"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 우측 변경 이력 및 규칙 알림 패널 (모바일에서는 숨김, PC에서만 표시) -->
        <div id="panel-changelog" class="hidden xl:flex w-80 ml-4 bg-white rounded-lg border border-slate-300 shadow flex-col shrink-0">
          <div class="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-teal-700">history_edu</span>
              근무표 변경 및 배포 이력
            </h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
              ${changeLogs.length}건
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
            ${changeLogs.map(log => `
              <div class="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                <div class="flex items-center justify-between font-bold text-slate-800">
                  <span>${log.author}</span>
                  <span class="text-[10px] text-slate-400 font-normal">${log.date}</span>
                </div>
                <p class="text-[11px] text-slate-600 leading-snug">${log.content}</p>
              </div>
            `).join('')}
          </div>

          <!-- 변경 사유 입력 및 기록 추가 폼 -->
          <div class="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
            <label class="text-[11px] font-bold text-slate-700 block">수정·대체 사유 기록</label>
            <input id="input-changelog-reason" type="text" placeholder="예: 윤인국 결근에 따른 남기현 대체" class="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-teal-600"/>
            <button id="btn-add-changelog" class="w-full py-1.5 bg-[#004349] hover:bg-[#0d5c63] text-white text-xs font-bold rounded transition">
              변경 사유 등록 & 배포
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 구글 시트 동기화 모달 설정
  const openSheetModal = setupGoogleSheetModal(container, rosterData);

  // 구글 시트 동기화 버튼 이벤트
  container.querySelector('#btn-sync-gsheet')?.addEventListener('click', async () => {
    openSheetModal();
  });

  // 셀 클릭 시 순환 변경 (B ➔ N ➔ N1 ➔ X ➔ 빨간색 신청X)
  const cycleList = [
    { code: 'B', isRequested: false },
    { code: 'N', isRequested: false },
    { code: 'N1', isRequested: false },
    { code: 'X', isRequested: false },
    { code: 'X', isRequested: true },  // 빨간색 X (희망휴무)
    { code: 'N', isRequested: true }   // 빨간색 N (대체야간)
  ];

  container.querySelectorAll('.hospital-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const staffId = cell.dataset.staffId;
      const day = parseInt(cell.dataset.day, 10);
      const curCode = cell.dataset.code;
      const curReq = cell.dataset.requested === 'true';

      const curIdx = cycleList.findIndex(c => c.code === curCode && c.isRequested === curReq);
      const nextItem = cycleList[(curIdx + 1) % cycleList.length];

      // 변경 반영
      const staffAssignments = assignments[staffId];
      const target = staffAssignments.find(a => a.day === day);
      if (target) {
        target.code = nextItem.code;
        target.isRequested = nextItem.isRequested;
        target.note = nextItem.isRequested ? '수동 변경/신청' : '';
      }

      onUpdateRoster(rosterData);
    });
  });

  // 변경 사유 등록 및 재배포
  container.querySelector('#btn-add-changelog')?.addEventListener('click', () => {
    const input = container.querySelector('#input-changelog-reason');
    const reason = input?.value.trim();
    if (!reason) {
      alert('변경 사유를 입력해 주세요.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    rosterData.changeLogs.unshift({
      id: `log_${Date.now()}`,
      date: todayStr,
      content: reason,
      author: '수간호사(책임자)'
    });
    rosterData.version = `개정본 (${todayStr})`;
    onUpdateRoster(rosterData);
    input.value = '';
    alert('✅ 변경 이력이 등록되고 직원들에게 개정 근무표가 재배포되었습니다!');
  });

  // 공식 재배포 버튼
  container.querySelector('#btn-publish-roster')?.addEventListener('click', () => {
    const reason = prompt('근무기록지 공식 배포 사유를 입력하세요:', '2026년 9월 개정 근무표 배포');
    if (reason) {
      const todayStr = new Date().toISOString().split('T')[0];
      rosterData.changeLogs.unshift({
        id: `log_${Date.now()}`,
        date: todayStr,
        content: reason,
        author: '수간호사'
      });
      rosterData.status = 'published';
      onUpdateRoster(rosterData);
      alert('📢 요양병원 2층 요양보호사 전원에게 개정 근무기록지가 모바일로 배포되었습니다.');
    }
  });

  // A4 가로 인쇄 기능
  container.querySelector('#btn-print-excel')?.addEventListener('click', () => {
    window.print();
  });

  // 새 달 근무표 작성 이동 이벤트
  container.querySelector('#btn-goto-monthly-from-editor')?.addEventListener('click', () => {
    navigate('monthly-generator');
  });

  // DB 실시간 동기화 버튼 이벤트
  container.querySelector('#btn-sync-roster-db')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-sync-roster-db');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block w-3 h-3 border-2 border-sky-700 border-t-transparent rounded-full animate-spin"></span> 동기화 중...`;

    try {
      const res = await syncRosterFromFirestore(true);
      if (res.data) {
        onUpdateRoster(res.data);
      }
      if (res.updated) {
        alert('🔄 실시간 데이터베이스의 최신 근무표를 캐시에 업데이트했습니다.');
      } else {
        alert('✅ 캐시와 실시간 데이터베이스가 이미 완벽하게 일치합니다.');
      }
    } catch (e) {
      alert(`동기화 실패: ${e.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  });
}
