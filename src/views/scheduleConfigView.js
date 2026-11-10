// 관리자 전용 시간표 작성 기준 & 근무 형태 설정 뷰
import { getAppSettings, saveAppSettings, SHIFT_DEFINITION_PRESETS, calculateStaffingRequirements } from '../services/settingsService';

export function renderScheduleConfigView(container, { onSaved, navigate }) {
  const currentSettings = getAppSettings();
  const activeCodes = new Set(currentSettings.activeShiftTypes || ['D', 'E', 'N', 'OFF']);
  const rules = currentSettings.rosterRules || {
    noReverseDuty: true,
    maxConsecutiveNight: 2,
    nightOffRestDays: 2,
    balanceWeekendShifts: true
  };

  const initialCalc = calculateStaffingRequirements(
    currentSettings.patientCount || 60,
    currentSettings.targetRatio || 4.5
  );

  container.innerHTML = `
    <div class="px-4 sm:px-6 py-4 sm:py-6 max-w-6xl mx-auto space-y-6 font-sans">
      
      <!-- 상단 헤더 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-bold">보건복지부 간호등급 & 노동법 기준</span>
            <span class="text-xs text-slate-400">환자 수 기반 과학적 인력 산출</span>
          </div>
          <h1 class="text-xl font-black text-slate-900 mt-1">시간표 작성 & 근무 형태 설정</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            <b>환자 수와 목표 등급</b>을 입력하면 일일 주간/야간/밤샘 인원이 자동 계산되며, 적용할 <b>근무 형태 및 준수 규칙</b>을 설정합니다.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button id="btn-save-schedule-config" class="px-4 py-2.5 bg-[#004349] hover:bg-[#0d5c63] active:bg-[#002f34] text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm">
            <span class="material-symbols-outlined text-[17px]">save</span>
            <span>설정 저장하기</span>
          </button>
          <button id="btn-goto-monthly-generator" class="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm">
            <span class="material-symbols-outlined text-[17px]">calendar_month</span>
            <span>월별 근무표 작성 메뉴로 이동 ➔</span>
          </button>
        </div>
      </div>

      <!-- 1. 보건복지부 간호등급 및 환자 수 기반 인력 자동 산출 카드 -->
      <div class="bg-gradient-to-br from-white to-teal-50/40 rounded-2xl border-2 border-teal-600/60 p-5 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100 pb-3">
          <div>
            <h2 class="text-base font-black text-slate-900 flex items-center gap-2">
              <span class="material-symbols-outlined text-teal-700 text-[22px]">calculate</span>
              1단계: 병동 환자 수 및 목표 간호등급 기반 인력 산정
            </h2>
            <p class="text-xs text-slate-500">환자 수와 등급 목표를 입력하면 노동법(주 5일, 월 22일 근무)에 따라 하루 출근 인원이 자동 산출됩니다.</p>
          </div>
          <span class="px-2.5 py-1 bg-teal-700 text-white text-[11px] font-extrabold rounded-lg shrink-0">
            법적 기준 공식 적용
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <!-- 환자 수 입력 -->
          <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <label class="block font-black text-slate-800">병동 입원 환자 수</label>
            <div class="flex items-center gap-2">
              <input id="input-patient-count" type="number" min="10" max="300" value="${currentSettings.patientCount || 60}" 
                class="w-full px-3 py-2 border-2 border-slate-200 focus:border-teal-700 rounded-xl font-extrabold text-sm text-slate-900 text-center"/>
              <span class="font-bold text-slate-600 shrink-0">명</span>
            </div>
            <p class="text-[10px] text-slate-400">병동 전체 입원 어르신 수</p>
          </div>

          <!-- 목표 간호등급 비율 -->
          <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <label class="block font-black text-slate-800">목표 등급 (1인당 환자수)</label>
            <div class="flex items-center gap-2">
              <input id="input-target-ratio" type="number" step="0.1" min="2.0" max="10.0" value="${currentSettings.targetRatio || 4.5}" 
                class="w-full px-3 py-2 border-2 border-slate-200 focus:border-teal-700 rounded-xl font-extrabold text-sm text-slate-900 text-center"/>
              <span class="font-bold text-slate-600 shrink-0">명당 1인</span>
            </div>
            <p class="text-[10px] text-slate-400">상위 1등급: 4.5~5.0명 미만</p>
          </div>

          <!-- 산출: 총 채용 필요 인원 -->
          <div class="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200 text-center flex flex-col justify-center">
            <span class="text-slate-500 font-bold text-[11px]">총 필요 채용 인원 (정원)</span>
            <div class="mt-1">
              <b id="display-total-staff" class="text-2xl font-black text-teal-900">${initialCalc.totalStaff}</b>
              <span class="text-xs font-bold text-teal-800">명</span>
            </div>
            <span class="text-[10px] text-teal-700 font-medium">환자 ${initialCalc.patientCount}명 ÷ ${initialCalc.targetRatio}</span>
          </div>

          <!-- 산출: 하루 총 출근 인원 -->
          <div class="bg-teal-800 text-white p-3.5 rounded-xl border border-teal-900 text-center flex flex-col justify-center shadow-sm">
            <span class="text-teal-200 font-bold text-[11px]">하루 총 출근 인원 (24시간)</span>
            <div class="mt-1">
              <b id="display-daily-staff" class="text-2xl font-black text-white">${initialCalc.dailyStaff}</b>
              <span class="text-xs font-bold text-teal-100">명/일</span>
            </div>
            <span class="text-[10px] text-teal-200 font-medium">주 5일(월 22일 근무) 적용</span>
          </div>
        </div>

        <!-- 3교대 5:3:2 배분 시각화 바 -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-800 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-teal-700">schedule</span>
              하루 3교대 시간대별 실제 배치 인원 (50% : 30% : 20% 공식)
            </span>
            <span class="text-[11px] text-slate-400">※ 밤샘(Night)은 의료법 및 응급대처로 최소 2인 필수 고정</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span class="font-black text-emerald-900 text-xs">D (Day 낮 근무)</span>
                <p class="text-[10px] text-emerald-700">07:00 ~ 15:00 (식사/처치 집중)</p>
              </div>
              <span id="display-day-count" class="text-xl font-black text-emerald-800">${initialCalc.dayCount}명</span>
            </div>

            <div class="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
              <div>
                <span class="font-black text-blue-900 text-xs">E (Evening 저녁)</span>
                <p class="text-[10px] text-blue-700">15:00 ~ 23:00 (취침/투약/보고)</p>
              </div>
              <span id="display-evening-count" class="text-xl font-black text-blue-800">${initialCalc.eveningCount}명</span>
            </div>

            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <span class="font-black text-amber-900 text-xs">N (Night 밤샘)</span>
                <p class="text-[10px] text-amber-700">23:00 ~ 07:00 (순찰/낙상방지)</p>
              </div>
              <span id="display-night-count" class="text-xl font-black text-amber-900">${initialCalc.nightCount}명</span>
            </div>

            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span class="font-black text-slate-800 text-xs">OFF (당일 휴무)</span>
                <p class="text-[10px] text-slate-500">정원 외 비번 인력</p>
              </div>
              <span id="display-off-count" class="text-xl font-black text-slate-700">${initialCalc.offCount}명</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 메인 설정 그리드 (근무 형태 선택 & 필수 준수 규칙) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- 좌측 2열: 근무 형태 선택/해제 -->
        <div class="lg:col-span-2 space-y-5">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 class="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-teal-700 text-[20px]">tune</span>
                  적용할 근무 형태 선택 (체크/해제)
                </h2>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  우리 병동에서 사용할 듀티 코드만 체크하세요. 선택된 코드만 월별 근무표 작성 시 배치됩니다.
                </p>
              </div>
              <span id="active-shift-count-badge" class="px-2.5 py-1 bg-teal-50 text-teal-800 text-xs font-extrabold rounded-lg border border-teal-200">
                선택됨: ${activeCodes.size}종
              </span>
            </div>

            <!-- 프리셋 리스트 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="shift-preset-list">
              ${SHIFT_DEFINITION_PRESETS.map(preset => {
                const isChecked = activeCodes.has(preset.code);
                const isLocked = preset.locked;
                return `
                  <div class="p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                    isChecked ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-600' : 'border-slate-200 bg-slate-50/60 opacity-75'
                  }" data-code="${preset.code}">
                    <div class="flex items-start justify-between">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" id="check-shift-${preset.code}" class="w-4 h-4 rounded text-teal-700 border-slate-300 focus:ring-teal-600 shift-checkbox" 
                          data-code="${preset.code}" ${isChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}/>
                        <div>
                          <span class="inline-block px-2 py-0.5 rounded font-black text-xs ${
                            preset.code === 'D' ? 'bg-emerald-100 text-emerald-800' :
                            preset.code === 'E' ? 'bg-blue-100 text-blue-800' :
                            preset.code === 'N' || preset.code === 'N1' ? 'bg-amber-100 text-amber-900' :
                            preset.code === 'MID' ? 'bg-purple-100 text-purple-800' :
                            preset.code === 'B' ? 'bg-teal-100 text-teal-900' : 'bg-slate-200 text-slate-700'
                          }">${preset.code}</span>
                          <span class="font-extrabold text-xs text-slate-800 ml-1.5">${preset.name}</span>
                        </div>
                      </div>
                      <span class="text-[10px] text-slate-400 font-bold">${preset.category}</span>
                    </div>

                    <div class="mt-2 text-[11px] text-slate-600 space-y-0.5">
                      <div class="font-bold text-slate-800 flex items-center gap-1">
                        <span class="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                        ${preset.time}
                      </div>
                      <p class="text-slate-500 leading-tight pt-0.5">${preset.description}</p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 우측 1열: 필수 준수 규칙 (역듀티 금지, 연속 야간 상한 등) -->
        <div class="space-y-5">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 class="text-sm font-black text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <span class="material-symbols-outlined text-rose-600 text-[20px]">verified</span>
              근무표 필수 규칙 제어
            </h2>

            <div class="space-y-4 text-xs">
              <!-- 1. 역듀티 금지 -->
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-slate-900">역듀티(Reverse Duty) 금지</span>
                  <input type="checkbox" id="check-rule-reverse" class="w-4 h-4 rounded text-teal-700" ${rules.noReverseDuty ? 'checked' : ''}/>
                </div>
                <p class="text-[11px] text-slate-500 leading-normal">
                  E(저녁 23시 퇴근) 후 다음날 D(낮 07시 출근) 배치를 엄격히 차단하여 직원의 최소 수면 시간을 보장합니다.
                </p>
              </div>

              <!-- 2. 연속 야간(Night) 상한 -->
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-slate-900">연속 야간(N) 상한</span>
                  <select id="select-rule-max-night" class="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold">
                    <option value="2" ${rules.maxConsecutiveNight === 2 ? 'selected' : ''}>최대 2일 연속 (권장)</option>
                    <option value="3" ${rules.maxConsecutiveNight === 3 ? 'selected' : ''}>최대 3일 연속</option>
                  </select>
                </div>
                <p class="text-[11px] text-slate-500 leading-normal">
                  야간 근무는 신체 피로도가 극심하므로 설정 일수 초과 배치를 방지합니다.
                </p>
              </div>

              <!-- 3. 야간 후 휴식 보장 -->
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-slate-900">야간 후 48시간(오프) 보장</span>
                  <input type="checkbox" id="check-rule-night-rest" class="w-4 h-4 rounded text-teal-700" ${rules.nightOffRestDays >= 2 ? 'checked' : ''}/>
                </div>
                <p class="text-[11px] text-slate-500 leading-normal">
                  N근무 종료 후 최소 48시간 이상 충분한 휴무(Off)를 배정합니다.
                </p>
              </div>

              <!-- 4. 주말/야간 균등 분배 -->
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-slate-900">주말·야간 횟수 평준화</span>
                  <input type="checkbox" id="check-rule-balance" class="w-4 h-4 rounded text-teal-700" ${rules.balanceWeekendShifts ? 'checked' : ''}/>
                </div>
                <p class="text-[11px] text-slate-500 leading-normal">
                  특정 직원에게 주말이나 밤 근무가 편중되지 않도록 인원별 공정성을 점검합니다.
                </p>
              </div>

              <!-- 5. 월 희망 휴무 신청 한도 -->
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-slate-900">월 희망휴무(OFF) 한도</span>
                  <div class="flex items-center gap-1">
                    <input id="input-config-monthly-off" type="number" min="1" max="10" value="${currentSettings.monthlyOffLimit || 2}" 
                      class="w-14 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white text-xs"/>
                    <span class="text-xs font-bold text-slate-600">일</span>
                  </div>
                </div>
                <p class="text-[11px] text-slate-500 leading-normal">
                  직원 1인이 한 달에 신청할 수 있는 희망 휴무일수 (현재 2일 연속 신청 필수 적용)
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;

  // 실시간 환자수/목표등급 입력 시 인력 재계산 함수
  const updateStaffCalculation = () => {
    const pCount = parseInt(container.querySelector('#input-patient-count').value, 10) || 60;
    const ratio = parseFloat(container.querySelector('#input-target-ratio').value) || 4.5;
    const calc = calculateStaffingRequirements(pCount, ratio);

    container.querySelector('#display-total-staff').innerText = calc.totalStaff;
    container.querySelector('#display-daily-staff').innerText = calc.dailyStaff;
    container.querySelector('#display-day-count').innerText = `${calc.dayCount}명`;
    container.querySelector('#display-evening-count').innerText = `${calc.eveningCount}명`;
    container.querySelector('#display-night-count').innerText = `${calc.nightCount}명`;
    container.querySelector('#display-off-count').innerText = `${calc.offCount}명`;
  };

  container.querySelector('#input-patient-count')?.addEventListener('input', updateStaffCalculation);
  container.querySelector('#input-target-ratio')?.addEventListener('input', updateStaffCalculation);

  // 체크박스 클릭 핸들러
  container.querySelectorAll('.shift-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const code = cb.dataset.code;
      if (cb.checked) {
        activeCodes.add(code);
      } else {
        if (code === 'OFF') {
          cb.checked = true;
          return;
        }
        activeCodes.delete(code);
      }

      // 카드 하이라이트 반영
      const card = container.querySelector(`[data-code="${code}"]`);
      if (card) {
        if (cb.checked) {
          card.className = 'p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none border-teal-700 bg-teal-50/40 ring-1 ring-teal-600';
        } else {
          card.className = 'p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none border-slate-200 bg-slate-50/60 opacity-75';
        }
      }

      const badge = container.querySelector('#active-shift-count-badge');
      if (badge) badge.innerText = `선택됨: ${activeCodes.size}종`;
    });
  });

  // 저장 함수
  const handleSave = async () => {
    const patientCount = parseInt(container.querySelector('#input-patient-count').value, 10) || 60;
    const targetRatio = parseFloat(container.querySelector('#input-target-ratio').value) || 4.5;
    const monthlyOffLimit = parseInt(container.querySelector('#input-config-monthly-off').value, 10) || 2;
    const noReverseDuty = container.querySelector('#check-rule-reverse').checked;
    const maxConsecutiveNight = parseInt(container.querySelector('#select-rule-max-night').value, 10) || 2;
    const nightOffRestDays = container.querySelector('#check-rule-night-rest').checked ? 2 : 1;
    const balanceWeekendShifts = container.querySelector('#check-rule-balance').checked;

    const calc = calculateStaffingRequirements(patientCount, targetRatio);

    const newSettings = {
      patientCount,
      targetRatio,
      totalStaffCount: calc.totalStaff,
      dailyStaffCount: calc.dailyStaff,
      monthlyOffLimit,
      activeShiftTypes: Array.from(activeCodes),
      rosterRules: {
        noReverseDuty,
        maxConsecutiveNight,
        nightOffRestDays,
        balanceWeekendShifts
      }
    };

    await saveAppSettings(newSettings);
    alert(`✅ 간호등급 및 시간표 기준이 성공적으로 저장되었습니다.\n• 입원 환자 수: ${patientCount}명 (목표 등급: ${targetRatio}명당 1인)\n• 필요 채용 인원: ${calc.totalStaff}명 (하루 출근: ${calc.dailyStaff}명)\n• 일일 배분: Day ${calc.dayCount}명, Evening ${calc.eveningCount}명, Night ${calc.nightCount}명`);
    if (onSaved) onSaved(newSettings);
  };

  container.querySelector('#btn-save-schedule-config')?.addEventListener('click', handleSave);

  // 월별 근무표 작성 메뉴로 바로 이동
  container.querySelector('#btn-goto-monthly-generator')?.addEventListener('click', async () => {
    await handleSave();
    navigate('monthly-generator');
  });
}


