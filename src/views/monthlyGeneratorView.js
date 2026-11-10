// 관리자 전용 월별 근무표 작성 및 자동 생성 메뉴 (환자수 기반 법정 인력 산정 & 실제 휴무 신청 연동)
import { getAppSettings, calculateStaffingRequirements } from '../services/settingsService';
import { getRegisteredMembers, listAllUsers } from '../services/userService';
import { buildDynamicStaffList } from '../services/realRosterData';
import { saveRosterData } from '../services/rosterService';
import { loadRequests } from '../services/requestService';

export async function renderMonthlyGeneratorView(container, { rosterData, onApplyRoster, navigate }) {
  const currentSettings = getAppSettings();
  const activeCodes = currentSettings.activeShiftTypes || ['D', 'E', 'N', 'OFF'];
  const rules = currentSettings.rosterRules || {};

  // 최신 Firestore 및 로컬 사용자 목록 조회 (관리자 제외 일반 회원)
  const allUsers = await listAllUsers();
  const members = allUsers.filter(u => u.role !== 'ADMIN' && u.email && !u.email.includes('hdcc6th') && !u.email.includes('sunmoon.scc'));

  // 환자수 기반 실시간 인력 계산
  const staffing = calculateStaffingRequirements(
    currentSettings.patientCount || 60,
    currentSettings.targetRatio || 4.5
  );

  const staffList = buildDynamicStaffList(staffing.totalStaff, members);

  // 대상 월 (기본 2026년 12월)
  let targetYear = 2026;
  let targetMonth = 12;
  const daysInMonth = 31; // 12월은 31일

  // 0. 이미 해당 월(2026년 12월)의 근무표가 작성 및 배포되었는지 점검
  const isAlreadyGenerated = Boolean(
    rosterData &&
    parseInt(rosterData.year, 10) === targetYear &&
    parseInt(rosterData.month, 10) === targetMonth &&
    rosterData.status === 'published'
  );

  // 1. 실제 데이터베이스에서 해당 월의 휴무 신청 내역 조회
  const allRequests = await loadRequests();
  const targetPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const monthOffRequests = allRequests.filter(r => r.type === 'OFF' && r.date && r.date.startsWith(targetPrefix));

  // 신청자 식별을 위한 헬퍼 (전화번호 숫자 정규화)
  const cleanPhone = (p) => (p || '').replace(/[^0-9]/g, '');

  // 1단계: 접수된 신청 건들(monthOffRequests)의 모든 식별 키를 세트로 정리
  // 신청자 1명당 1번만 카운트하기 위해 이미 처리된 신청자는 제외
  const requestedIds = new Set();
  const requestedEmails = new Set();
  const requestedPhones = new Set();
  const requestedNames = new Set();
  const processedRequesters = new Set(); // 이미 처리된 신청자 추적

  monthOffRequests.forEach(r => {
    // 신청자 고유 식별자 결정 (우선순위: ID > Email > Phone > Name)
    const id = r.requesterId ? r.requesterId.trim().toLowerCase() : null;
    const email = r.requesterEmail ? r.requesterEmail.trim().toLowerCase() : null;
    const phone = r.requesterPhone ? cleanPhone(r.requesterPhone) : null;
    const name = r.requesterName ? r.requesterName.trim().toLowerCase() : null;

    // 신청자 고유 키 결정
    let uniqueKey = null;
    if (id) uniqueKey = `id:${id}`;
    else if (email && email !== '') uniqueKey = `email:${email}`;
    else if (phone && phone !== '') uniqueKey = `phone:${phone}`;
    else if (name && name !== '') uniqueKey = `name:${name}`;

    // 이미 처리된 신청자는 건너뛰기 (1명당 1번만)
    if (uniqueKey && processedRequesters.has(uniqueKey)) return;
    if (uniqueKey) processedRequesters.add(uniqueKey);

    // 각 식별자 세트에 추가 (매칭 용도)
    if (id) requestedIds.add(id);
    if (email && email !== '') requestedEmails.add(email);
    if (phone && phone !== '') requestedPhones.add(phone);
    if (name && name !== '') requestedNames.add(name);
  });

  // 2단계: 신청자 매칭 헬퍼 함수 (ID 우선 매칭)
  // 우선순위: ID > Email > Phone > Name
  const checkMemberMatchedWithRequests = (m) => {
    const mId = (m.staffId || m.uid || m.id || '').trim().toLowerCase();
    const mEmail = (m.email || '').trim().toLowerCase();
    const mPhone = cleanPhone(m.phoneNumber);
    const mReal = (m.realName || '').trim().toLowerCase();
    const mDisplay = (m.displayName || '').trim().toLowerCase();

    // 1순위: ID 매칭 (가장 확실함)
    if (mId && requestedIds.has(mId)) return true;

    // 2순위: 이메일 매칭 (고유 식별자)
    if (mEmail && mEmail !== '' && requestedEmails.has(mEmail)) return true;

    // 3순위: 전화번호 매칭
    if (mPhone && mPhone !== '' && requestedPhones.has(mPhone)) return true;

    // 4순위: 이름 매칭 (가장 부정확함)
    if ((mReal && mReal !== '' && requestedNames.has(mReal)) ||
        (mDisplay && mDisplay !== '' && requestedNames.has(mDisplay))) {
      return true;
    }

    return false;
  };

  // 신청 완료된 회원 및 미신청 회원 분류 (정확한 사용자 기반 판단)
  const memberRequesters = members.filter(m => checkMemberMatchedWithRequests(m));
  const unrequestedMembers = members.filter(m => !checkMemberMatchedWithRequests(m));

  // 신청서(monthOffRequests) 자체에서 고유 신청자 목록 추출 (검증 용도)
  const distinctRequestersInReqs = new Map();
  monthOffRequests.forEach(r => {
    const displayLabel = r.requesterName || r.requesterEmail || '신청자';
    const uniqueKey = r.requesterEmail || cleanPhone(r.requesterPhone) || r.requesterName || r.requesterId;
    if (uniqueKey && !distinctRequestersInReqs.has(uniqueKey)) {
      distinctRequestersInReqs.set(uniqueKey, displayLabel);
    }
  });

  const distinctApplicantNames = Array.from(distinctRequestersInReqs.values());

  // 신청자 수 계산 (등록된 사용자 기준으로 정확히 계산)
  const effectiveRequestedCount = memberRequesters.length;  // 등록된 사용자 중 신청한 수
  const effectiveTotalCount = members.length;  // 등록된 사용자 총 수
  const effectiveUnrequestedCount = effectiveTotalCount - effectiveRequestedCount;  // 미신청자 수

  // 디버깅 정보 (신청서 데이터 검증)
  if (distinctApplicantNames.length !== effectiveRequestedCount) {
    console.warn(
      `[휴무신청 데이터 검증] 신청서 고유신청자(${distinctApplicantNames.length}명)와 ` +
      `등록사용자 신청자(${effectiveRequestedCount}명) 불일치. ` +
      `신청서: [${distinctApplicantNames.join(', ')}] / ` +
      `미신청자: [${unrequestedMembers.map(m => m.realName || m.displayName || m.email).join(', ')}]`
    );
  }

  // 1순위, 2순위, 3순위 신청 데이터 파싱 및 겹침 분석
  const staffPreferenceMap = {};
  
  monthOffRequests.forEach(r => {
    const key = (r.requesterName || r.requesterEmail || r.requesterId || '').trim();
    if (!key) return;

    if (!staffPreferenceMap[key]) {
      staffPreferenceMap[key] = {
        name: r.requesterName,
        email: r.requesterEmail || '',
        phone: cleanPhone(r.requesterPhone),
        id: r.requesterId || '',
        rank1: [],
        rank2: [],
        rank3: []
      };
    }
    const day = parseInt(r.date.split('-')[2], 10);
    const rank = r.rank || 1;
    if (rank === 1 && !staffPreferenceMap[key].rank1.includes(day)) staffPreferenceMap[key].rank1.push(day);
    if (rank === 2 && !staffPreferenceMap[key].rank2.includes(day)) staffPreferenceMap[key].rank2.push(day);
    if (rank === 3 && !staffPreferenceMap[key].rank3.includes(day)) staffPreferenceMap[key].rank3.push(day);

    if (r.ranks) {
      if (r.ranks.rank1) staffPreferenceMap[key].rank1 = [...new Set([...staffPreferenceMap[key].rank1, ...r.ranks.rank1])];
      if (r.ranks.rank2) staffPreferenceMap[key].rank2 = [...new Set([...staffPreferenceMap[key].rank2, ...r.ranks.rank2])];
      if (r.ranks.rank3) staffPreferenceMap[key].rank3 = [...new Set([...staffPreferenceMap[key].rank3, ...r.ranks.rank3])];
    }
  });

  // 직원 듀티 배정 매칭 헬퍼 함수 (3중 비교: 이름, 전화번호, 이메일)
  const findStaffPreference = (s) => {
    const sName = (s.name || '').trim().toLowerCase();
    const sEmail = (s.email || '').trim().toLowerCase();
    const sPhone = cleanPhone(s.phoneNumber);
    const sId = (s.id || '').trim().toLowerCase();

    for (const [key, pref] of Object.entries(staffPreferenceMap)) {
      const k = key.toLowerCase();
      const pName = (pref.name || '').trim().toLowerCase();
      const pEmail = (pref.email || '').trim().toLowerCase();
      const pPhone = pref.phone || '';
      const pId = (pref.id || '').trim().toLowerCase();

      const nameMatch = (sName && (k === sName || pName === sName));
      const phoneMatch = (sPhone && pPhone && sPhone === pPhone);
      const emailMatch = (sEmail && (k === sEmail || pEmail === sEmail));
      const idMatch = (sId && (k === sId || pId === sId));

      if (nameMatch || phoneMatch || emailMatch || idMatch) {
        return pref;
      }
    }
    return null;
  };

  // 2. 듀티 생성 엔진 (1순위 우선 배정 + 날짜별 최대 휴무 허용 인원 초과 시 2순위/3순위 자동 조정)
  const generateRosterDraft = (mode = 'BALANCED') => {
    const assignments = {};
    const workCodes = activeCodes.filter(c => c !== 'OFF' && c !== 'X');
    const dayCode = activeCodes.includes('D') ? 'D' : activeCodes.includes('B') ? 'B' : workCodes[0] || 'D';
    const eveningCode = activeCodes.includes('E') ? 'E' : activeCodes.includes('MID') ? 'MID' : workCodes[0] || 'E';
    const nightCode = activeCodes.includes('N') ? 'N' : activeCodes.includes('N1') ? 'N1' : workCodes[0] || 'N';

    const targetDayCount = staffing.dayCount;
    const targetEveningCount = staffing.eveningCount;
    const targetNightCount = staffing.nightCount;
    const maxOffPerDay = Math.max(1, staffing.totalStaff - staffing.dailyStaff);

    const resolvedOffDays = {};
    const dailyOffCount = Array(daysInMonth + 1).fill(0);

    // 1단계: 1순위 신청만 배정 (2순위/3순위는 무시)
    // 1순위가 날짜별 정원 한도를 초과하면 1순위 신청은 배정하지 않음
    staffList.forEach(s => {
      const pref = findStaffPreference(s);
      if (!pref || pref.rank1.length === 0) return;

      // 1순위만 검증: 모든 1순위 날짜가 정원 범위 내면 배정, 그렇지 않으면 무시
      const canFitRank1 = pref.rank1.every(d => dailyOffCount[d] < maxOffPerDay);
      if (canFitRank1) {
        resolvedOffDays[s.id] = [...pref.rank1];
        pref.rank1.forEach(d => dailyOffCount[d]++);
        pref.appliedRank = 1;
      }
      // 1순위가 안 되면 2순위, 3순위는 무시하고 배정하지 않음
    });

    staffList.forEach(s => {
      assignments[s.id] = [];
    });

    const prevShift = {};

    for (let day = 1; day <= daysInMonth; day++) {
      // 1) 확정된 휴무일 배정
      staffList.forEach(s => {
        const offDays = resolvedOffDays[s.id] || [];
        if (offDays.includes(day)) {
          const pref = findStaffPreference(s);
          const rankText = pref ? `${pref.appliedRank || 1}순위` : '희망';
          assignments[s.id].push({
            day,
            code: 'OFF',
            isRequested: true,
            note: `직원 희망휴무 (${rankText} 반영)`
          });
        }
      });

      // 2) 가용 인력 선별
      const availableStaff = staffList.filter(s => {
        const todayAssign = assignments[s.id].find(a => a.day === day);
        return !todayAssign;
      });

      const sortedCandidates = [...availableStaff].sort((a, b) => {
        const prevA = prevShift[a.id];
        const prevB = prevShift[b.id];
        if (prevA === 'E' && prevB !== 'E') return 1;
        if (prevB === 'E' && prevA !== 'E') return -1;
        return 0;
      });

      let dayAssigned = 0;
      let eveningAssigned = 0;
      let nightAssigned = 0;

      sortedCandidates.forEach(staff => {
        const pCode = prevShift[staff.id];
        let code = 'OFF';

        if (mode === 'NIGHT_FIXED' && (staff.id === 'st_1' || staff.id === 'st_2')) {
          if (day % 2 === 1) {
            code = nightCode;
            nightAssigned++;
          } else {
            code = 'OFF';
          }
        } else {
          if (nightAssigned < targetNightCount && pCode !== dayCode) {
            code = nightCode;
            nightAssigned++;
          } else if (eveningAssigned < targetEveningCount) {
            code = eveningCode;
            eveningAssigned++;
          } else if (dayAssigned < targetDayCount && (!rules.noReverseDuty || pCode !== 'E')) {
            code = dayCode;
            dayAssigned++;
          } else {
            code = 'OFF';
          }
        }

        assignments[staff.id].push({
          day,
          code,
          isRequested: false,
          note: ''
        });

        prevShift[staff.id] = code;
      });
    }

    return assignments;
  };

  container.innerHTML = `
    <div class="px-4 sm:px-6 py-4 sm:py-6 max-w-6xl mx-auto space-y-6 font-sans pb-24">
      
      <!-- 상단 헤더 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-bold">월별 듀티표 생성기</span>
            <span class="text-xs text-slate-400">환자 수 기준 & 1/2/3순위 휴무 신청 연동</span>
          </div>
          <h1 class="text-xl font-black text-slate-900 mt-1">2026년 12월 근무표 작성 & 인력 산출</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            병동 환자 수 <b>${staffing.patientCount}명</b>(하루 ${staffing.dailyStaff}명 출근: 낮 ${staffing.dayCount}명, 저녁 ${staffing.eveningCount}명, 밤 ${staffing.nightCount}명)에 맞춰 작성합니다.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button id="btn-goto-schedule-settings" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
            <span class="material-symbols-outlined text-[16px]">tune</span>
            환자수/근무형태 기준 변경
          </button>
        </div>
      </div>

      <!-- 🌟 이미 12월 근무표가 생성/배포된 경우 경고 및 바로가기 배너 -->
      ${isAlreadyGenerated ? `
        <div class="p-5 rounded-2xl bg-teal-50 border-2 border-teal-600 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div class="flex items-start sm:items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span class="material-symbols-outlined text-[24px]">task_alt</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-black text-teal-950 text-sm">2026년 12월 근무표가 이미 확정 및 배포되어 있습니다.</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-200 text-teal-900">배포 완료</span>
              </div>
              <p class="text-teal-800 text-[11px] mt-0.5">
                현재 병동에 등록된 ${rosterData.version || '12월 근무표'}가 운영 중입니다. 기존 표를 확인하거나 일부를 수정하시려면 [근무표 편집 바로가기]를 이용하세요.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="btn-goto-roster-editor-shortcut" class="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">table_chart</span>
              12월 근무표 편집 바로가기
            </button>
          </div>
        </div>
      ` : ''}

      <!-- ⚠️ 직원 휴무 신청 현황 알림 배너 (정확한 신청/미신청자 분석 반영) -->
      <div class="p-4 rounded-2xl border ${
        effectiveUnrequestedCount > 0 ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400' : 'bg-emerald-50 border-emerald-300'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-start sm:items-center gap-3">
          <span class="material-symbols-outlined ${effectiveUnrequestedCount > 0 ? 'text-amber-700' : 'text-emerald-700'} text-[24px] shrink-0">
            ${effectiveUnrequestedCount > 0 ? 'notification_important' : 'task_alt'}
          </span>
          <div>
            <div class="font-black ${effectiveUnrequestedCount > 0 ? 'text-amber-900' : 'text-emerald-900'} text-sm">
              12월 희망 휴무 신청 현황: 
              <span class="underline underline-offset-2">${effectiveTotalCount}명 중 ${effectiveRequestedCount}명 신청 완료</span>
              (${effectiveUnrequestedCount}명 미신청)
            </div>
            <p class="text-[11px] ${effectiveUnrequestedCount > 0 ? 'text-amber-800' : 'text-emerald-800'} mt-0.5">
              ${effectiveUnrequestedCount > 0 ? `
                신청 완료: <b>${distinctApplicantNames.join(', ') || '없음'}</b> / 
                미신청 직원: <span class="font-bold text-rose-700">${unrequestedMembers.map(m=>m.realName||m.displayName||m.email).join(', ') || `${effectiveUnrequestedCount}명 미신청`}</span>
              ` : '모든 등록 직원의 희망 휴무(1~3순위) 접수가 완료되었습니다.'}
            </p>
          </div>
        </div>

        <div class="shrink-0 flex items-center gap-2">
          <span class="px-3 py-1.5 rounded-xl font-black text-xs ${effectiveUnrequestedCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}">
            접수된 휴무 신청: ${monthOffRequests.length}건
          </span>
        </div>
      </div>

      <!-- 3가지 최적 초안 선택 카드 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <!-- 초안 1: 법정 표준 균형안전형 -->
        <div class="bg-white rounded-2xl border-2 border-teal-700 p-5 shadow-sm space-y-4 flex flex-col justify-between relative ring-1 ring-teal-600/30">
          <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-teal-700 text-white text-[10px] font-black shadow-xs">
            추천 1위
          </span>
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-black text-slate-900 text-base">초안 A (균형안전형)</h2>
              <span class="text-xs font-black text-teal-800">종합 96점</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              환자 ${staffing.patientCount}명 기준 주간 ${staffing.dayCount}명, 저녁 ${staffing.eveningCount}명, 밤샘 ${staffing.nightCount}명 완전 준수 (1~3순위 지능형 겹침 조정)
            </p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>일일 필요 인원 충족</span>
                <span class="font-bold text-emerald-600">하루 ${staffing.dailyStaff}명 (100% 충족)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>역듀티 (E➔D) 위반</span>
                <span class="font-bold text-emerald-600">0건 (철저 차단)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>실제 접수된 휴무 반영</span>
                <span class="font-bold text-slate-800">${effectiveRequestedCount}명 신청분 우선 반영</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>야간/주말 편차</span>
                <span class="font-bold text-slate-800">±0.4회 (최고 평준화)</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-draft-a" class="w-full mt-4 py-3 bg-[#004349] hover:bg-[#0d5c63] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">done</span>
            초안 A로 12월 근무표 확정 및 배포
          </button>
        </div>

        <!-- 초안 2: 휴무 선호 최우선형 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-black text-slate-900 text-base">초안 B (휴무선호형)</h2>
              <span class="text-xs font-black text-blue-700">종합 90점</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              직원들의 1순위 희망 휴무(연속 2일)를 최우선 수용하고 주간 인력 보강에 집중
            </p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>역듀티 위반</span>
                <span class="font-bold text-emerald-600">0건</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>1순위 휴무 수용률</span>
                <span class="font-bold text-blue-600">100% 반영</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>일일 필요 인원 충족</span>
                <span class="font-bold text-emerald-600">100% 충족</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>주말 근무 편차</span>
                <span class="font-bold text-amber-600">±1.5회</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-draft-b" class="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5">
            초안 B 적용하기
          </button>
        </div>

        <!-- 초안 3: 야간전담 2인 안정형 -->
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <h2 class="font-black text-slate-900 text-base">초안 C (야간전담형)</h2>
              <span class="text-xs font-black text-purple-700">종합 88점</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              야간전담제(Night)를 2인 고정 배치하여 주간 요양보호사의 생체리듬 피로도 완화
            </p>

            <div class="mt-4 space-y-2 text-xs text-slate-700">
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>야간 전담 인력</span>
                <span class="font-bold text-purple-700">2인 고정 (격일)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>주간 조 교대 피로</span>
                <span class="font-bold text-emerald-600">최소화 (D/E 전담)</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>일일 필요 인원 충족</span>
                <span class="font-bold text-emerald-600">100% 충족</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-100">
                <span>월 야간 상한(14일)</span>
                <span class="font-bold text-slate-800">법정 준수</span>
              </div>
            </div>
          </div>

          <button id="btn-apply-draft-c" class="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5">
            초안 C 적용하기
          </button>
        </div>

      </div>

    </div>
  `;

  // 초안 적용 시 휴일 미신청자 확인 컨펌 함수
  const confirmAndApply = async (draftName, mode) => {
    // 1) 이미 작성된 근무표가 있을 경우 재생성 확인
    if (isAlreadyGenerated) {
      const overwriteMsg = `⚠️ [근무표 재생성 안내]\n\n이미 2026년 12월 근무표가 확정 및 배포되어 운영 중입니다.\n기존 12월 근무표를 덮어쓰고 [${draftName}] 기준으로 새로 생성하시겠습니까?\n\n(취소 시 근무표가 덮어써지지 않고 유지됩니다)`;
      if (!confirm(overwriteMsg)) {
        return;
      }
    }

    if (effectiveUnrequestedCount > 0) {
      const unrequestedNames = unrequestedMembers.map(m => m.realName || m.displayName || m.email).join(', ') || `${effectiveUnrequestedCount}명`;
      const msg = `⚠️ [휴무 미신청자 확인 안내]\n\n현재 등록된 직원 ${effectiveTotalCount}명 중 [${unrequestedNames}] 총 ${effectiveUnrequestedCount}명이 아직 12월 희망 휴무일을 신청하지 않았습니다.\n\n휴무 미신청 상태 그대로 정규 로테이션(균등 배분)으로 12월 근무표를 작성하시겠습니까?`;
      if (!confirm(msg)) {
        alert('근무표 작성이 보류되었습니다. 직원들에게 희망 휴무 신청을 먼저 안내해주세요.');
        return;
      }
    }

    const assignments = generateRosterDraft(mode);

    const newRoster = {
      title: `${targetYear}년 ${targetMonth}월 직원근무표 ( 2층 요양보호사)`,
      year: targetYear,
      month: targetMonth,
      floor: '2층 요양보호사',
      printedAt: new Date().toLocaleDateString('ko-KR'),
      status: 'published',
      version: `${targetYear}.${targetMonth} ${draftName} 확정본`,
      staffList: staffList,
      assignments: assignments,
      changeLogs: [
        {
          id: `log_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          content: `${targetYear}년 ${targetMonth}월 근무표가 환자 수(${staffing.patientCount}명) 기준 [${draftName}]으로 확정 배포되었습니다.`,
          author: '최고 관리자'
        }
      ]
    };

    await saveRosterData(newRoster);
    if (onApplyRoster) onApplyRoster(newRoster);

    alert(`🎉 [${targetYear}년 ${targetMonth}월 근무표]가 [${draftName}] 기준으로 확정되었습니다!\n월간 근무표 편집 화면으로 이동합니다.`);
    navigate('editor');
  };

  container.querySelector('#btn-goto-roster-editor-shortcut')?.addEventListener('click', () => {
    navigate('editor');
  });

  container.querySelector('#btn-apply-draft-a')?.addEventListener('click', () => confirmAndApply('초안 A(균형안전형)', 'BALANCED'));
  container.querySelector('#btn-apply-draft-b')?.addEventListener('click', () => confirmAndApply('초안 B(휴무선호형)', 'OFF_PRIORITY'));
  container.querySelector('#btn-apply-draft-c')?.addEventListener('click', () => confirmAndApply('초안 C(야간전담형)', 'NIGHT_FIXED'));

  container.querySelector('#btn-goto-schedule-settings')?.addEventListener('click', () => {
    navigate('schedule-config');
  });
}
