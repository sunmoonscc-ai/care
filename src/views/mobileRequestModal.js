// 휴무 및 근무 맞교환 신청 전용 모바일 모달 팝업
import { saveRequest, replaceStaffMonthlyOffRequests } from '../services/requestService';
import { getAppSettings } from '../services/settingsService';

export function openMobileRequestModal({ rosterData, staff, type = 'OFF', existingSelections = null, onComplete }) {
  let modal = document.getElementById('modal-mobile-request');
  if (modal) modal.remove();

  const settings = getAppSettings();
  const maxOffDays = settings.monthlyOffLimit || 2;
  const requireConsecutive = false; // 개별 날짜 선택 모드 (연속 선택 안 함)

  const otherStaffList = rosterData.staffList.filter(s => s.id !== staff.id);

  // 대상 년월 (현재 11월이므로 신청 대상은 다음 달인 12월)
  let targetYear = 2026;
  let targetMonth = 12; // 12월
  const daysInMonth = 31; // 2026년 12월은 31일

  // 요일 이름 배열
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 각 일자별 요일 계산 (2026-12-01: 화요일)
  const getDayInfo = (day) => {
    const d = new Date(targetYear, targetMonth - 1, day);
    const dayOfWeek = d.getDay(); // 0(일) ~ 6(토)
    return {
      day,
      dayOfWeek,
      dayName: weekDayNames[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isSunday: dayOfWeek === 0,
      isSaturday: dayOfWeek === 6
    };
  };

  // 기존 신청 내역이 있으면 해당 값 복원, 없으면 사용자가 직접 선택할 수 있도록 빈 배열 []로 시작
  let activeRank = 1;
  const rankSelections = {
    1: (existingSelections && existingSelections[1] && existingSelections[1].length > 0) ? [...existingSelections[1]] : [],
    2: (existingSelections && existingSelections[2]) ? [...existingSelections[2]] : [],
    3: (existingSelections && existingSelections[3]) ? [...existingSelections[3]] : []
  };

  let swapSelectedDay = 15;
  let isSubmitting = false; // 중복 클릭 방지 플래그

  // 특정 순위의 시작일을 눌렀을 때 새 일자로 교체 배정 (연속 maxOffDays 일자)
  const selectDaysForRank = (rank, clickedDay) => {
    // 다른 순위에서 이미 선택된 날짜라면 해당 순위에서 자동 제거하여 순위 간 중복 방지
    [1, 2, 3].forEach(r => {
      if (r !== rank && rankSelections[r].includes(clickedDay)) {
        rankSelections[r] = [];
      }
    });

    if (requireConsecutive && maxOffDays > 1) {
      // 이미 현재 순위에 같은 시작일이 선택되어 있다면 토글(해제)
      if (rankSelections[rank].length > 0 && rankSelections[rank][0] === clickedDay) {
        rankSelections[rank] = [];
        return;
      }

      // 새 날짜를 누르면 기존 선택을 지우고 방금 누른 날짜를 기준으로 연속 maxOffDays 일자 선택
      let startDay = clickedDay;
      if (startDay + maxOffDays - 1 > daysInMonth) {
        startDay = daysInMonth - maxOffDays + 1;
      }
      const days = [];
      for (let i = 0; i < maxOffDays; i++) {
        days.push(startDay + i);
      }
      rankSelections[rank] = days;
    } else {
      if (rankSelections[rank].includes(clickedDay)) {
        rankSelections[rank] = rankSelections[rank].filter(d => d !== clickedDay);
      } else {
        if (rankSelections[rank].length >= maxOffDays) {
          rankSelections[rank].shift();
        }
        rankSelections[rank].push(clickedDay);
      }
    }
  };

  const renderCalendarGrid = () => {
    return Array.from({ length: daysInMonth }).map((_, i) => {
      const day = i + 1;
      const info = getDayInfo(day);

      // 어느 순위에 속해 있는지 확인
      let inRank = null;
      if (type === 'OFF') {
        if (rankSelections[1].includes(day)) inRank = 1;
        else if (rankSelections[2].includes(day)) inRank = 2;
        else if (rankSelections[3].includes(day)) inRank = 3;
      } else {
        if (swapSelectedDay === day) inRank = 1;
      }

      let btnStyle = 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200';
      let rankTag = '';

      if (inRank !== null) {
        if (inRank === 1) {
          btnStyle = 'bg-teal-700 text-white border-teal-800 shadow-sm font-black ring-2 ring-teal-300';
          rankTag = '<span class="text-[9px] block text-teal-100 font-bold">1순위</span>';
        } else if (inRank === 2) {
          btnStyle = 'bg-blue-600 text-white border-blue-700 shadow-sm font-black ring-2 ring-blue-300';
          rankTag = '<span class="text-[9px] block text-blue-100 font-bold">2순위</span>';
        } else if (inRank === 3) {
          btnStyle = 'bg-amber-600 text-white border-amber-700 shadow-sm font-black ring-2 ring-amber-300';
          rankTag = '<span class="text-[9px] block text-amber-100 font-bold">3순위</span>';
        }
      } else {
        if (info.isSunday) {
          btnStyle = 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200';
        } else if (info.isSaturday) {
          btnStyle = 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200';
        }
      }

      return `
        <button type="button" class="btn-calendar-day py-2 px-1 rounded-xl transition flex flex-col items-center justify-center ${btnStyle}" data-day="${day}">
          <span class="text-[11px] ${inRank ? 'text-white' : info.isSunday ? 'text-rose-600 font-extrabold' : info.isSaturday ? 'text-blue-600 font-extrabold' : 'text-slate-500 font-medium'} leading-none">
            ${info.dayName}
          </span>
          <span class="text-sm font-extrabold leading-tight mt-0.5">${day}</span>
          ${rankTag}
        </button>
      `;
    }).join('');
  };

  const modalHtml = `
    <div id="modal-mobile-request" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto pb-safe">
        
        <!-- 모달 헤더 -->
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl ${type === 'OFF' ? 'bg-teal-50 text-teal-800' : 'bg-blue-50 text-blue-800'} flex items-center justify-center font-bold border border-teal-200/50">
              <span class="material-symbols-outlined text-[20px]">${type === 'OFF' ? 'event_available' : 'swap_horiz'}</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h3 class="font-black text-slate-900 text-base">
                  ${type === 'OFF' ? '12월 희망 휴무(OFF) 신청' : '12월 근무 맞교환 신청'}
                </h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800">
                  2026년 12월
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-0.5">신청자: <b class="text-slate-700">${staff.name}</b> 요양보호사</p>
            </div>
          </div>
          <button id="btn-close-mobile-req" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 flex items-center justify-center transition">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- 폼 필드 -->
        <div class="space-y-4 text-xs">

          ${type === 'OFF' ? `
            <!-- 순위 탭 선택기 (1순위, 2순위, 3순위) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="font-extrabold text-slate-800 flex items-center gap-1">
                  <span>휴무 희망 순위 선택</span>
                  <span class="text-[10px] font-medium text-slate-500">(동료와 겹칠 경우 대비)</span>
                </label>
                <span class="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  연속 ${maxOffDays}일 자동선택
                </span>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <button type="button" id="tab-rank-1" class="btn-rank-tab py-2 px-2 rounded-xl font-black text-xs border transition flex flex-col items-center gap-0.5 bg-teal-700 text-white border-teal-800 shadow-sm" data-rank="1">
                  <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">star</span>
                    <span>1순위 (필수)</span>
                  </div>
                  <span id="rank-1-display" class="text-[10px] font-bold text-teal-100">
                    ${rankSelections[1].length ? `${rankSelections[1].map(d => `${d}일`).join('~')}` : '날짜 선택'}
                  </span>
                </button>

                <button type="button" id="tab-rank-2" class="btn-rank-tab py-2 px-2 rounded-xl font-bold text-xs border transition flex flex-col items-center gap-0.5 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" data-rank="2">
                  <div class="flex items-center gap-1">
                    <span>2순위 (선택)</span>
                  </div>
                  <span id="rank-2-display" class="text-[10px] font-bold text-slate-400">
                    ${rankSelections[2].length ? `${rankSelections[2].map(d => `${d}일`).join('~')}` : '미지정'}
                  </span>
                </button>

                <button type="button" id="tab-rank-3" class="btn-rank-tab py-2 px-2 rounded-xl font-bold text-xs border transition flex flex-col items-center gap-0.5 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" data-rank="3">
                  <div class="flex items-center gap-1">
                    <span>3순위 (선택)</span>
                  </div>
                  <span id="rank-3-display" class="text-[10px] font-bold text-slate-400">
                    ${rankSelections[3].length ? `${rankSelections[3].map(d => `${d}일`).join('~')}` : '미지정'}
                  </span>
                </button>
              </div>

              <!-- 현재 편집 중인 순위 안내 바 -->
              <div id="active-rank-banner" class="mt-2 py-1.5 px-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 flex items-center justify-between text-[11px] font-bold">
                <span class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px] text-teal-700">touch_app</span>
                  달력에서 하루를 누르면 <b class="underline">연속 ${maxOffDays}일</b>이 새로 선택됩니다.
                </span>
                <button type="button" id="btn-clear-current-rank" class="text-[10px] text-slate-500 hover:text-rose-600 underline font-semibold">선택 취소</button>
              </div>
            </div>
          ` : ''}

          <!-- 1. 달력 날짜 선택 (2026년 12월 1일~31일) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block font-black text-slate-800">
                2026년 12월 달력 (날짜 및 요일)
              </label>
              <span class="text-[11px] font-bold text-slate-500">
                12월 1일(화) ~ 12월 31일(목)
              </span>
            </div>

            <!-- 요일 헤더 -->
            <div class="grid grid-cols-7 gap-1 text-center font-bold text-[10px] mb-1">
              <div class="text-rose-600">일</div>
              <div class="text-slate-600">월</div>
              <div class="text-slate-600">화</div>
              <div class="text-slate-600">수</div>
              <div class="text-slate-600">목</div>
              <div class="text-slate-600">금</div>
              <div class="text-blue-600">토</div>
            </div>

            <div id="calendar-days-grid" class="grid grid-cols-7 gap-1 max-h-52 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
              ${renderCalendarGrid()}
            </div>

            <!-- 하단 선택 결과 요약 카드 -->
            <div class="mt-2.5 p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-1 text-[11px]">
              ${type === 'OFF' ? `
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-teal-800 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-teal-600 inline-block"></span>
                    1순위: <b id="summary-rank-1">${formatRankSummary(rankSelections[1])}</b>
                  </span>
                  <span class="text-slate-500 font-medium">가장 쉬고 싶은 날</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-blue-700 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                    2순위: <b id="summary-rank-2">${formatRankSummary(rankSelections[2])}</b>
                  </span>
                  <span class="text-slate-400 font-medium">겹칠 때 대안</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-amber-700 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
                    3순위: <b id="summary-rank-3">${formatRankSummary(rankSelections[3])}</b>
                  </span>
                  <span class="text-slate-400 font-medium">추가 대안</span>
                </div>
              ` : `
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-slate-800">
                    선택한 교환 일자: <b class="text-teal-800">${formatSingleDay(swapSelectedDay)}</b>
                  </span>
                </div>
              `}
            </div>
          </div>

          ${type === 'SWAP' ? `
            <!-- 맞교환 대상 동료 및 근무 형태 -->
            <div>
              <label class="block font-bold text-slate-700 mb-1">교환할 동료 선택</label>
              <select id="select-target-staff" class="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
                ${otherStaffList.map(s => `
                  <option value="${s.id}">${s.name} (${s.role || '요양보호사'})</option>
                `).join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-bold text-slate-700 mb-1">내 원래 근무</label>
                <select id="select-my-shift" class="w-full py-2 px-2.5 rounded-lg border border-slate-300 font-bold bg-white text-xs">
                  <option value="D">주간 (D)</option>
                  <option value="E">저녁 (E)</option>
                  <option value="N">야간 (N)</option>
                  <option value="B">주간 12H (B)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">바꿀 근무</label>
                <select id="select-target-shift" class="w-full py-2 px-2.5 rounded-lg border border-slate-300 font-bold bg-white text-xs">
                  <option value="OFF">휴무 (OFF)</option>
                  <option value="D">주간 (D)</option>
                  <option value="E">저녁 (E)</option>
                  <option value="N">야간 (N)</option>
                </select>
              </div>
            </div>
          ` : ''}

          <!-- 사유 입력 -->
          <div>
            <label class="block font-bold text-slate-700 mb-1">신청 사유</label>
            <div class="flex flex-wrap gap-1.5 mb-1.5">
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">개인 경조사</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">병원 정기검진</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">가족 행사/간병</button>
              <button type="button" class="btn-reason-tag px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold">건강상 휴식</button>
            </div>
            <input id="input-req-reason" type="text" placeholder="사유를 입력하거나 위 태그를 누르세요" value="개인 경조사" class="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600 font-medium"/>
          </div>

        </div>

        <!-- 하단 제출 버튼 (스피너 및 즉각 반응) -->
        <div class="pt-2">
          <button id="btn-submit-mobile-req" class="w-full py-3.5 bg-[#004349] hover:bg-[#0d5c63] active:bg-[#003035] text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 touch-manipulation">
            <span id="btn-submit-icon" class="material-symbols-outlined text-[18px]">send</span>
            <span id="btn-submit-label">12월 휴무 신청서 제출하기</span>
          </button>
        </div>

      </div>
    </div>
  `;

  function formatSingleDay(day) {
    if (!day) return '미지정';
    const info = getDayInfo(day);
    return `12월 ${day}일(${info.dayName})`;
  }

  function formatRankSummary(days) {
    if (!days || days.length === 0) return '미지정';
    const sorted = [...days].sort((a,b)=>a-b);
    return sorted.map(d => `${d}일(${getDayInfo(d).dayName})`).join(', ');
  }

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('modal-mobile-request');

  const updateUI = () => {
    // 1. 달력 렌더링 갱신
    const grid = modal.querySelector('#calendar-days-grid');
    if (grid) grid.innerHTML = renderCalendarGrid();

    // 2. 순위 탭 갱신
    if (type === 'OFF') {
      [1, 2, 3].forEach(rank => {
        const tab = modal.querySelector(`#tab-rank-${rank}`);
        const disp = modal.querySelector(`#rank-display-${rank}`) || modal.querySelector(`#rank-${rank}-display`);
        const days = rankSelections[rank];

        if (disp) {
          disp.innerText = days.length ? `${days.map(d => `${d}일`).join('~')}` : rank === 1 ? '날짜 선택' : '미지정';
        }

        if (tab) {
          if (activeRank === rank) {
            if (rank === 1) tab.className = 'btn-rank-tab py-2 px-2 rounded-xl font-black text-xs border transition flex flex-col items-center gap-0.5 bg-teal-700 text-white border-teal-800 shadow-sm ring-2 ring-teal-300';
            else if (rank === 2) tab.className = 'btn-rank-tab py-2 px-2 rounded-xl font-black text-xs border transition flex flex-col items-center gap-0.5 bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300';
            else tab.className = 'btn-rank-tab py-2 px-2 rounded-xl font-black text-xs border transition flex flex-col items-center gap-0.5 bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300';
          } else {
            tab.className = 'btn-rank-tab py-2 px-2 rounded-xl font-bold text-xs border transition flex flex-col items-center gap-0.5 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
          }
        }
      });

      // 3. 요약 카드 갱신
      const s1 = modal.querySelector('#summary-rank-1');
      const s2 = modal.querySelector('#summary-rank-2');
      const s3 = modal.querySelector('#summary-rank-3');
      if (s1) s1.innerText = formatRankSummary(rankSelections[1]);
      if (s2) s2.innerText = formatRankSummary(rankSelections[2]);
      if (s3) s3.innerText = formatRankSummary(rankSelections[3]);

      // 4. 활성 순위 안내 배너
      const banner = modal.querySelector('#active-rank-banner');
      if (banner) {
        const rankName = activeRank === 1 ? '1순위' : activeRank === 2 ? '2순위' : '3순위';
        const colorClass = activeRank === 1 ? 'bg-teal-50 border-teal-200 text-teal-900' : activeRank === 2 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-amber-50 border-amber-200 text-amber-900';
        banner.className = `mt-2 py-1.5 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-between ${colorClass}`;
        banner.innerHTML = `
          <span class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">touch_app</span>
            <b>[${rankName}]</b> 날짜를 누르면 <span class="underline">연속 ${maxOffDays}일</span>이 새로 선택됩니다.
          </span>
          <button type="button" id="btn-clear-current-rank" class="text-[10px] text-slate-500 hover:text-rose-600 underline font-semibold">선택 취소</button>
        `;
        banner.querySelector('#btn-clear-current-rank')?.addEventListener('click', () => {
          rankSelections[activeRank] = [];
          updateUI();
        });
      }
    }

    // 날짜 클릭 리스너 재바인딩
    modal.querySelectorAll('.btn-calendar-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const clickedDay = parseInt(btn.dataset.day, 10);
        if (type === 'OFF') {
          selectDaysForRank(activeRank, clickedDay);
        } else {
          swapSelectedDay = clickedDay;
        }
        updateUI();
      });
    });
  };

  // 순위 탭 클릭 이벤트 바인딩
  modal.querySelectorAll('.btn-rank-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeRank = parseInt(tab.dataset.rank, 10);
      updateUI();
    });
  });

  // 초기 렌더링 리스너 등록
  updateUI();

  // 사유 빠른 태그 클릭
  modal.querySelectorAll('.btn-reason-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      modal.querySelector('#input-req-reason').value = tag.innerText;
    });
  });

  // 닫기
  modal.querySelector('#btn-close-mobile-req')?.addEventListener('click', () => modal.remove());

  // 제출 이벤트 (중복 클릭 방지 및 즉시 처리)
  modal.querySelector('#btn-submit-mobile-req')?.addEventListener('click', async () => {
    if (isSubmitting) return; // 이미 제출 진행 중이면 차단

    const submitBtn = modal.querySelector('#btn-submit-mobile-req');
    const submitIcon = modal.querySelector('#btn-submit-icon');
    const submitLabel = modal.querySelector('#btn-submit-label');

    const reason = modal.querySelector('#input-req-reason').value.trim() || '개인 사정';

    if (type === 'OFF') {
      if (rankSelections[1].length === 0) {
        alert('⚠️ 1순위 희망 휴무 날짜를 선택해주세요.');
        return;
      }

      // UI 즉각 피드백: 버튼 비활성화 및 로딩 표시
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.className = 'w-full py-3.5 bg-slate-400 text-white font-black text-sm rounded-xl cursor-not-allowed flex items-center justify-center gap-2';
      }
      if (submitIcon) {
        submitIcon.innerText = 'sync';
        submitIcon.classList.add('animate-spin');
      }
      if (submitLabel) {
        submitLabel.innerText = '휴무 신청 등록 중...';
      }

      // 신청 데이터에 maxOffDays 초과하는 날짜가 있으면 제거 (방어)
      const validRank1 = rankSelections[1].slice(0, maxOffDays);
      const validRank2 = rankSelections[2].slice(0, maxOffDays);
      const validRank3 = rankSelections[3].slice(0, maxOffDays);

      if (validRank1.length !== rankSelections[1].length) {
        console.warn(`[선택 초과 보정] 1순위: ${rankSelections[1].length}일 -> ${validRank1.length}일`);
      }

      const newItems = [];

      // 1순위 항목들 - 각 개별 날짜마다 신청 생성 (rank 필드만 사용)
      for (const day of validRank1) {
        newItems.push({
          type: 'OFF',
          typeName: '희망 휴무(OFF)',
          requesterId: staff.id || '',
          requesterName: staff.name || '',
          requesterEmail: (staff.email || '').toLowerCase().trim(),
          requesterPhone: (staff.phoneNumber || '').replace(/[^0-9]/g, ''),
          targetId: '',
          targetName: '-',
          date: `2026-12-${String(day).padStart(2, '0')}`,
          fromShift: 'D',
          toShift: 'OFF',
          reason: `${reason}`,
          rank: 1,
          month: '2026-12',
          status: 'PENDING_ADMIN',
          statusText: '관리자(수간호사) 승인 대기중'
        });
      }

      // 2순위 항목들
      if (validRank2.length > 0) {
        for (const day of validRank2) {
          newItems.push({
            type: 'OFF',
            typeName: '희망 휴무(OFF) - 2순위',
            requesterId: staff.id || '',
            requesterName: staff.name || '',
            requesterEmail: (staff.email || '').toLowerCase().trim(),
            requesterPhone: (staff.phoneNumber || '').replace(/[^0-9]/g, ''),
            targetId: '',
            targetName: '-',
            date: `2026-12-${String(day).padStart(2, '0')}`,
            fromShift: 'D',
            toShift: 'OFF',
            reason: `${reason} (2순위 예비)`,
            rank: 2,
            month: '2026-12',
            status: 'PENDING_ADMIN',
            statusText: '2순위 예비 휴무 (조정 대기)'
          });
        }
      }

      // 3순위 항목들
      if (validRank3.length > 0) {
        for (const day of validRank3) {
          newItems.push({
            type: 'OFF',
            typeName: '희망 휴무(OFF) - 3순위',
            requesterId: staff.id || '',
            requesterName: staff.name || '',
            requesterEmail: (staff.email || '').toLowerCase().trim(),
            requesterPhone: (staff.phoneNumber || '').replace(/[^0-9]/g, ''),
            targetId: '',
            targetName: '-',
            date: `2026-12-${String(day).padStart(2, '0')}`,
            fromShift: 'D',
            toShift: 'OFF',
            reason: `${reason} (3순위 예비)`,
            rank: 3,
            month: '2026-12',
            status: 'PENDING_ADMIN',
            statusText: '3순위 예비 휴무 (조정 대기)'
          });
        }
      }

      // 기존 12월 신청 내역을 깔끔하게 새 신청 내역으로 대체 (중복 누적 원천 차단)
      await replaceStaffMonthlyOffRequests(staff.id, staff.name, '2026-12', newItems);

      modal.remove();
      alert(`🎉 2026년 12월 희망 휴무 신청이 정상 접수되었습니다!\n\n• 1순위: ${formatRankSummary(validRank1)}\n• 2순위: ${formatRankSummary(validRank2)}\n• 3순위: ${formatRankSummary(validRank3)}\n\n모바일 메인 화면의 [내 12월 희망 휴무 신청 현황] 카드에서 언제든 확인 및 변경할 수 있습니다.`);
    } else {
      // SWAP (맞교환)
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.className = 'w-full py-3.5 bg-slate-400 text-white font-black text-sm rounded-xl cursor-not-allowed flex items-center justify-center gap-2';
      }
      if (submitIcon) {
        submitIcon.innerText = 'sync';
        submitIcon.classList.add('animate-spin');
      }
      if (submitLabel) {
        submitLabel.innerText = '교환 요청 등록 중...';
      }

      const dateStr = `2026-12-${String(swapSelectedDay).padStart(2, '0')}`;
      const targetSelect = modal.querySelector('#select-target-staff');
      const targetStaff = otherStaffList.find(s => s.id === targetSelect.value) || otherStaffList[0];
      const myShift = modal.querySelector('#select-my-shift').value;
      const targetShift = modal.querySelector('#select-target-shift').value;

      await saveRequest({
        type: 'SWAP',
        typeName: '근무 맞교환',
        requesterId: staff.id,
        requesterName: staff.name,
        targetId: targetStaff.id,
        targetName: targetStaff.name,
        date: dateStr,
        month: '2026-12',
        fromShift: myShift,
        toShift: targetShift,
        reason: reason,
        status: 'PENDING_ADMIN',
        statusText: `동료(${targetStaff.name}) 및 관리자 승인 대기`
      });

      modal.remove();
      alert(`🎉 [12월 ${swapSelectedDay}일] 근무 맞교환 신청이 등록되었습니다!\n관리자 승인 즉시 근무표에 자동 반영됩니다.`);
    }

    if (onComplete) onComplete();
  });
}
