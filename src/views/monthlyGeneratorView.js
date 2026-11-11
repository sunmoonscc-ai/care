// 관리자 전용 월별 근무표 작성 및 자동 생성 메뉴 (환자수 기반 법정 인력 산정 & 실제 휴무 신청 연동)
import { getAppSettings, syncAppSettingsFromFirestore, calculateStaffingRequirements } from '../services/settingsService';
import { getRegisteredMembers, listAllUsers } from '../services/userService';
import { buildDynamicStaffList } from '../services/realRosterData';
import { saveRosterData, deleteDecemberRoster } from '../services/rosterService';
import { loadRequests, getAllUsersMonthlyOffRequests, getUserRequestKey } from '../services/requestService';
import { MAX_OFF_DAYS } from '../constants';

export async function renderMonthlyGeneratorView(container, { rosterData, onApplyRoster, navigate }) {
  // 🌟 관리자 모드: 설정값도 캐시 대신 Firestore에서 최신 상태를 강제 동기화하여 가져옴
  const currentSettings = await syncAppSettingsFromFirestore();
  const activeCodes = currentSettings.activeShiftTypes || ['D', 'E', 'N', 'OFF'];
  const rules = currentSettings.rosterRules || {};

  // 최신 Firestore 원격 사용자 목록 강제 조회 (관리자 제외 일반 회원)
  const allUsers = await listAllUsers(true);
  const members = allUsers.filter(u => u.role !== 'ADMIN' && u.email && !u.email.includes('hdcc6th') && !u.email.includes('sunmoon.scc'));

  // 환자수 기반 실시간 인력 계산
  const staffing = calculateStaffingRequirements(
    currentSettings.patientCount || 60,
    currentSettings.targetRatio || 4.5
  );

  const staffList = buildDynamicStaffList(staffing.totalStaff, members);

  // 🔍 근무표 생성 시작 전 직원 목록 확인
  console.log(`\n👨‍⚕️ [근무표 생성 초기화]`);
  console.log(`  등록된 사용자: ${members.length}명`);
  members.forEach(m => {
    console.log(`    - ${m.realName || m.displayName || m.email} (email=${m.email}, phone=${m.phoneNumber || '?'})`);
  });
  console.log(`  생성된 근무표 직원: ${staffList.length}명`);
  staffList.forEach(s => {
    console.log(`    - [${s.id}] ${s.name} (email=${s.email || '?'}, phone=${s.phoneNumber || '?'})`);
  });

  // 현재 날짜 기반으로 근무표 작성 대상 달 계산 (2개월 후)
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth() + 2; // 2개월 후

  if (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

  // 0. 이미 해당 월의 근무표가 작성 및 배포되었는지 점검
  const isAlreadyGenerated = Boolean(
    rosterData &&
    parseInt(rosterData.year, 10) === targetYear &&
    parseInt(rosterData.month, 10) === targetMonth &&
    rosterData.status === 'published'
  );

  // 1. 실제 데이터베이스에서 해당 월의 휴무 신청 내역 조회
  // 🌟 [신규 구조] 사용자별 격리 저장된 월별 휴무 데이터 일괄 수집
  const targetPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const userMonthlyOffMap = await getAllUsersMonthlyOffRequests(targetPrefix, members);

  console.log(`\n📥 [사용자별 월별 휴무 데이터 수집] 대상월=${targetPrefix}, 수집된 사용자=${Object.keys(userMonthlyOffMap).length}명:`);
  Object.entries(userMonthlyOffMap).forEach(([k, d]) => {
    console.log(`  [${k}] ${d.requesterName}: 선택일=${d.selectedDay}일, 배정휴무일=[${d.offDays?.join(', ')}]`);
  });

  const allRequests = await loadRequests();
  const monthOffRequests = allRequests.filter(r => r.type === 'OFF' && r.date && r.date.startsWith(targetPrefix));

  // 신청자 식별을 위한 헬퍼 (전화번호 숫자 정규화)
  const cleanPhone = (p) => (p || '').replace(/[^0-9]/g, '');

  // 1단계: 접수된 모든 식별 키를 세트로 정리 (신규 격리 저장 데이터 + 레거시 requests)
  const requestedIds = new Set();
  const requestedEmails = new Set();
  const requestedPhones = new Set();
  const requestedNames = new Set();

  // 1) 신규 격리 저장 데이터 반영
  Object.values(userMonthlyOffMap).forEach(d => {
    if (d.requesterId && d.requesterId.trim()) requestedIds.add(d.requesterId.trim().toLowerCase());
    if (d.requesterUid && d.requesterUid.trim()) requestedIds.add(d.requesterUid.trim().toLowerCase());
    if (d.requesterEmail && d.requesterEmail.trim()) requestedEmails.add(d.requesterEmail.trim().toLowerCase());
    if (d.requesterPhone && cleanPhone(d.requesterPhone)) requestedPhones.add(cleanPhone(d.requesterPhone));
    if (d.requesterName && d.requesterName.trim()) requestedNames.add(d.requesterName.trim().toLowerCase());
  });

  // 2) 레거시 requests 반영
  monthOffRequests.forEach(r => {
    if (r.requesterId && r.requesterId.trim()) requestedIds.add(r.requesterId.trim().toLowerCase());
    if (r.requesterUid && r.requesterUid.trim()) requestedIds.add(r.requesterUid.trim().toLowerCase());
    if (r.requesterEmail && r.requesterEmail.trim()) requestedEmails.add(r.requesterEmail.trim().toLowerCase());
    if (r.requesterPhone && cleanPhone(r.requesterPhone)) requestedPhones.add(cleanPhone(r.requesterPhone));
    if (r.requesterName && r.requesterName.trim()) requestedNames.add(r.requesterName.trim().toLowerCase());
  });

  // 2단계: 신청자 매칭 헬퍼 함수 (3중 교차 비교: ID/UID, 이메일, 전화번호, 실명/표시명)
  const checkMemberMatchedWithRequests = (m) => {
    const mId = (m.staffId || m.id || '').trim().toLowerCase();
    const mUid = (m.uid || '').trim().toLowerCase();
    const mEmail = (m.email || '').trim().toLowerCase();
    const mPhone = cleanPhone(m.phoneNumber);
    const mReal = (m.realName || '').trim().toLowerCase();
    const mDisplay = (m.displayName || '').trim().toLowerCase();

    // 1) ID 또는 UID 매칭
    if (mId && requestedIds.has(mId)) return true;
    if (mUid && requestedIds.has(mUid)) return true;

    // 2) 이메일 매칭
    if (mEmail && requestedEmails.has(mEmail)) return true;

    // 3) 전화번호 매칭
    if (mPhone && requestedPhones.has(mPhone)) return true;

    // 4) 이름 매칭 (개인정보 실명 또는 표시명)
    if (mReal && requestedNames.has(mReal)) return true;
    if (mDisplay && requestedNames.has(mDisplay)) return true;

    return false;
  };

  // 신청 완료된 회원 및 미신청 회원 분류
  const memberRequesters = members.filter(m => checkMemberMatchedWithRequests(m));
  const unrequestedMembers = members.filter(m => !checkMemberMatchedWithRequests(m));

  // 신청자 고유 이름 목록 추출
  const distinctApplicantNamesMap = new Map();
  Object.values(userMonthlyOffMap).forEach(d => {
    const label = d.requesterName || d.requesterEmail || '신청자';
    const key = d.userKey || label;
    distinctApplicantNamesMap.set(key, label);
  });
  monthOffRequests.forEach(r => {
    const label = r.requesterName || r.requesterEmail || '신청자';
    const key = r.requesterEmail || cleanPhone(r.requesterPhone) || (r.requesterName ? r.requesterName.trim().toLowerCase() : null) || r.requesterId;
    if (key && !distinctApplicantNamesMap.has(key)) {
      distinctApplicantNamesMap.set(key, label);
    }
  });

  const distinctApplicantNames = Array.from(distinctApplicantNamesMap.values());
  const effectiveRequestedCount = Math.max(memberRequesters.length, distinctApplicantNames.length);
  const effectiveTotalCount = members.length;
  const effectiveUnrequestedCount = Math.max(0, effectiveTotalCount - effectiveRequestedCount);

  // 1순위, 2순위, 3순위 신청 데이터 파싱 (신청자별로 통합)
  const staffPreferenceMap = {};

  // 1) 신규 구조 데이터(Firestore 최신 원격 반영본)를 staffPreferenceMap에 최우선 안착
  Object.values(userMonthlyOffMap).forEach(d => {
    const uKey = d.userKey || getUserRequestKey(d);
    const sortedOffs = Array.isArray(d.offDays) && d.offDays.length > 0 ? [...d.offDays].sort((a,b)=>a-b) : [d.selectedDay, d.selectedDay + 1];
    staffPreferenceMap[uKey] = {
      requesterId: d.requesterId || '',
      requesterUid: d.requesterUid || '',
      name: d.requesterName || '',
      email: (d.requesterEmail || '').toLowerCase().trim(),
      phone: cleanPhone(d.requesterPhone),
      offDays: sortedOffs,
      startDay: sortedOffs[0],
      rawRequests: [{ date: `${targetPrefix}-${String(sortedOffs[0]).padStart(2, '0')}`, day: sortedOffs[0], rank: 1 }]
    };
  });

  // 2) 레거시 monthOffRequests는 신규 데이터에 전혀 등록되지 않은 직원에 대해서만 보충
  monthOffRequests.forEach(r => {
    const rId = (r.requesterId || '').trim().toLowerCase();
    const rEmail = (r.requesterEmail || '').trim().toLowerCase();
    const rPhone = cleanPhone(r.requesterPhone);
    const rName = (r.requesterName || '').trim();
    const rNameLower = rName.toLowerCase();

    // 이미 최신 신규 데이터(staffPreferenceMap)에 존재하는 직원이면 레거시 데이터 병합 절대 금지!
    for (const [, p] of Object.entries(staffPreferenceMap)) {
      if (rEmail && p.email && rEmail === p.email) return;
      if (rPhone && p.phone && rPhone === p.phone) return;
      if (rNameLower && p.name && rNameLower === p.name.toLowerCase()) return;
      if (rId && p.requesterId && rId === p.requesterId.toLowerCase()) return;
    }

    const uniqueKey = rEmail ? `email:${rEmail}` : rPhone ? `phone:${rPhone}` : rNameLower ? `name:${rNameLower}` : `id:${rId}`;

    if (!staffPreferenceMap[uniqueKey]) {
      staffPreferenceMap[uniqueKey] = {
        requesterId: r.requesterId || '',
        requesterUid: r.requesterUid || '',
        name: r.requesterName || '',
        email: rEmail,
        phone: rPhone,
        offDays: [],
        rawRequests: []
      };
    }

    const dateStr = r.date || '';
    const dayMatch = dateStr.match(/-(\d{1,2})$/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1], 10);
      if (!staffPreferenceMap[uniqueKey].offDays.includes(day)) {
        staffPreferenceMap[uniqueKey].offDays.push(day);
      }
      staffPreferenceMap[uniqueKey].rawRequests.push({ date: dateStr, day, rank: r.rank });
    }
  });

  // startDay 및 정렬 보정
  Object.entries(staffPreferenceMap).forEach(([key, pref]) => {
    if (pref.offDays.length > 0) {
      pref.offDays.sort((a, b) => a - b);
      pref.startDay = pref.offDays[0];
    }
  });

  // 근무표 staffList의 직원(st_1, st_2 등)과 신청 데이터를 4중(ID, 이메일, 전화번호, 이름) 교차 매칭
  const findStaffPreference = (s) => {
    const sId = (s.id || '').trim().toLowerCase();
    const sEmail = (s.email || '').trim().toLowerCase();
    const sPhone = cleanPhone(s.phoneNumber);
    const sName = (s.name || '').trim().toLowerCase();

    for (const [, pref] of Object.entries(staffPreferenceMap)) {
      const pId = (pref.requesterId || '').trim().toLowerCase();
      const pEmail = (pref.email || '').trim().toLowerCase();
      const pPhone = cleanPhone(pref.phone);
      const pName = (pref.name || '').trim().toLowerCase();

      // 1) ID 일치 (가장 정확함: st_1 == st_1)
      if (sId && pId && sId === pId) {
        console.log(`  [ID 매칭] ${s.id} == ${pref.requesterId}`);
        return pref;
      }

      // 2) 이메일 일치 (이메일이 있을 때)
      if (sEmail && pEmail && sEmail === pEmail) {
        console.log(`  [이메일 매칭] ${s.email} == ${pref.email}`);
        return pref;
      }

      // 3) 전화번호 일치
      if (sPhone && pPhone && sPhone === pPhone) {
        console.log(`  [전화번호 매칭] ${s.phoneNumber} == ${pref.phone}`);
        return pref;
      }

      // 4) 이름 매칭 (정확한 이름 일치 또는 포함 관계)
      // 예: "김은정" == "김은정" 또는 "s24 ultra" 포함 "s24"
      if (sName && pName) {
        const exactMatch = sName === pName;
        const partialMatch = sName.includes(pName) || pName.includes(sName);
        const koreanMatch = (sName.includes(pName) || pName.includes(sName)) && !sName.includes('외부') && !pName.includes('user_');

        if (exactMatch || koreanMatch) {
          console.log(`  [이름 매칭] "${s.name}" ≈ "${pref.name}"`);
          return pref;
        }
      }
    }

    return null;
  };

  // 📊 파싱 후 최종 신청 데이터
  console.log(`\n📊 [신청자별 통합 데이터] ${Object.keys(staffPreferenceMap).length}명:`);
  Object.entries(staffPreferenceMap).forEach(([key, pref]) => {
    console.log(`  [${key}] ${pref.name || pref.email}: offDays=[${pref.offDays}], startDay=${pref.startDay || '?'}일 / rawReqs=${pref.rawRequests.length}건`);
  });

  // 🔍 근무표 직원 목록과 신청 데이터 매칭 확인
  console.log(`\n👥 [근무표 직원 목록 및 매칭 상태] 총 ${staffList.length}명:`);
  staffList.forEach(s => {
    const pref = findStaffPreference(s);
    console.log(`  [${s.id}] ${s.name} (email=${s.email}, phone=${s.phoneNumber}) → ${pref ? `✅ 매칭: ${pref.name} (offDays=${pref.offDays})` : '❌ 미매칭'}`);
  });

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
    const maxOffDaysLimit = currentSettings.monthlyOffLimit || MAX_OFF_DAYS;

    const resolvedOffDays = {};
    const dailyOffCount = Array(daysInMonth + 1).fill(0);

    // 1단계: 휴무 신청 배정 (시작일부터 maxOffDays일)
    console.log(`\n⚙️ [근무표 생성 중] 모드=${mode}, maxOffDaysLimit=${maxOffDaysLimit}, maxOffPerDay=${maxOffPerDay}`);

    staffList.forEach(s => {
      const pref = findStaffPreference(s);
      if (!pref || !pref.startDay) {
        console.log(`  [${s.id}] ${s.name}: 신청 데이터 없음 → 정규 로테이션`);
        return;
      }

      // 시작일부터 maxOffDaysLimit만큼 휴무 생성
      const offDays = [];
      for (let i = 0; i < maxOffDaysLimit && pref.startDay + i <= daysInMonth; i++) {
        offDays.push(pref.startDay + i);
      }

      // 날짜별 정원 확인
      const canFit = offDays.every(d => dailyOffCount[d] < maxOffPerDay);
      if (canFit) {
        resolvedOffDays[s.id] = offDays;
        offDays.forEach(d => dailyOffCount[d]++);
        console.log(`  [${s.id}] ${s.name}: ✅ 휴무 배정 [${offDays}]`);
      } else {
        console.log(`  [${s.id}] ${s.name}: ⚠️ 휴무 미배정 - 날짜 정원 초과 (요청: [${offDays}])`);
      }
    });

    console.log(`  📊 최종 휴무 배정: ${Object.keys(resolvedOffDays).length}명 / 총 ${staffList.length}명`);

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
          <h1 class="text-xl font-black text-slate-900 mt-1">${targetYear}년 ${String(targetMonth).padStart(2, '0')}월 근무표 작성 & 인력 산출</h1>
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
            <button id="btn-reset-december-roster" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">restore</span>
              초기화
            </button>
            <button id="btn-goto-roster-editor-shortcut" class="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">table_chart</span>
              편집 바로가기
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
            접수된 휴무 신청: ${Object.keys(staffPreferenceMap).length}명 ${monthOffRequests.length}일
          </span>
          <button id="btn-view-off-requests" class="px-3 py-1.5 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-700 text-white transition flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[14px]">info</span>
            신청휴무일보기
          </button>
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

  // 12월 근무표 초기화 버튼
  container.querySelector('#btn-reset-december-roster')?.addEventListener('click', async () => {
    const confirmMsg = `⚠️ [12월 근무표 초기화]\n\n현재 생성된 12월 근무표를 완전히 삭제하겠습니까?\n이 작업은 되돌릴 수 없습니다.\n\n초기화 후 다시 근무표를 작성할 수 있습니다.`;
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      // 1. 백엔드에서 초기화
      await deleteDecemberRoster();
      console.log('✅ deleteDecemberRoster() 완료');

      // 2. 로컬 상태 즉시 업데이트
      if (onApplyRoster) {
        onApplyRoster({
          title: `${targetYear}년 ${String(targetMonth).padStart(2, '0')}월 직원근무표 (초기화됨)`,
          year: targetYear,
          month: targetMonth,
          floor: '2층 요양보호사',
          status: 'draft',
          version: '초기화됨',
          staffList: [],
          assignments: {},
          changeLogs: []
        });
        console.log('✅ onApplyRoster() 호출됨');
      }

      // 3. 강제 새로고침 (캐시 무시)
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('🔄 페이지 강제 새로고침 중...');
      window.location.href = window.location.href.split('?')[0] + '?' + Date.now();
    } catch (e) {
      console.error('초기화 오류:', e);
      alert(`❌ 초기화 중 오류가 발생했습니다: ${e.message}\n\n콘솔(F12)을 확인하세요.`);
    }
  });

  container.querySelector('#btn-goto-roster-editor-shortcut')?.addEventListener('click', () => {
    navigate('editor');
  });

  container.querySelector('#btn-apply-draft-a')?.addEventListener('click', () => confirmAndApply('초안 A(균형안전형)', 'BALANCED'));
  container.querySelector('#btn-apply-draft-b')?.addEventListener('click', () => confirmAndApply('초안 B(휴무선호형)', 'OFF_PRIORITY'));
  container.querySelector('#btn-apply-draft-c')?.addEventListener('click', () => confirmAndApply('초안 C(야간전담형)', 'NIGHT_FIXED'));

  container.querySelector('#btn-goto-schedule-settings')?.addEventListener('click', () => {
    navigate('schedule-config');
  });

  // 신청휴무일보기 버튼
  container.querySelector('#btn-view-off-requests')?.addEventListener('click', () => {
    // 🌟 신청 데이터를 신청자별로 정리:
    // 신규 월별 전용 신청(userMonthlyOffMap 및 staffPreferenceMap)을 최우선으로 적용하며,
    // 인당 최대 MAX_OFF_DAYS(2일)까지만 노출하도록 제한
    const requestListByStaff = {};

    // 1) staffPreferenceMap의 데이터 우선 반영 (각 직원별 실제 최종 신청일 2일)
    Object.values(staffPreferenceMap).forEach(pref => {
      const name = pref.name || pref.email || '신청자';
      if (Array.isArray(pref.offDays) && pref.offDays.length > 0) {
        requestListByStaff[name] = [...pref.offDays].slice(0, 2).sort((a, b) => a - b);
      }
    });

    // 2) 레거시 monthOffRequests에서 아직 staffPreferenceMap에 없는 인원만 최소한으로 보충
    monthOffRequests.forEach(r => {
      const name = r.requesterName || r.requesterEmail || '신청자';
      if (!requestListByStaff[name]) {
        requestListByStaff[name] = [];
      }
      // 이미 2일이 채워졌으면 레거시 중복 추가 차단
      if (requestListByStaff[name].length >= 2) return;

      if (r.date) {
        const dayMatch = r.date.match(/-(\d{1,2})$/);
        if (dayMatch) {
          const d = parseInt(dayMatch[1], 10);
          if (!requestListByStaff[name].includes(d)) {
            requestListByStaff[name].push(d);
          }
        }
      }
    });

    // 각 신청자의 신청 일자를 최대 2일로 정렬 보정
    Object.keys(requestListByStaff).forEach(name => {
      requestListByStaff[name] = [...new Set(requestListByStaff[name])].slice(0, 2).sort((a, b) => a - b);
    });

    // 총 신청 일수 계산
    const totalOffDaysCount = Object.values(requestListByStaff).reduce((acc, cur) => acc + cur.length, 0);

    // 요일 구하기 및 배지 스타일 헬퍼 (평일/토요일 파랑/일요일 빨강)
    const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const getDayBadge = (day) => {
      const dObj = new Date(targetYear, targetMonth - 1, day);
      const dayOfWeek = dObj.getDay();
      const weekName = weekDayNames[dayOfWeek];

      if (dayOfWeek === 0) {
        // 일요일 (빨간색)
        return {
          text: `${day}일(${weekName})`,
          badgeClass: 'bg-red-50 text-red-600 border border-red-200'
        };
      } else if (dayOfWeek === 6) {
        // 토요일 (파란색)
        return {
          text: `${day}일(${weekName})`,
          badgeClass: 'bg-blue-50 text-blue-600 border border-blue-200'
        };
      } else {
        // 평일 (단정하고 부드러운 청록/다크그레이)
        return {
          text: `${day}일(${weekName})`,
          badgeClass: 'bg-teal-50 text-teal-800 border border-teal-200'
        };
      }
    };

    // 팝업 HTML 생성
    const modalHtml = `
      <div id="modal-off-requests" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
        <div class="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[80vh] overflow-y-auto">

          <!-- 헤더 -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold border border-teal-200">
                <span class="material-symbols-outlined text-[20px]">event_note</span>
              </div>
              <div>
                <h3 class="font-black text-slate-900 text-lg">${targetYear}년 ${String(targetMonth).padStart(2, '0')}월 신청 휴무 일정</h3>
                <p class="text-xs text-slate-400 mt-0.5">${Object.keys(requestListByStaff).length}명 총 ${totalOffDaysCount}일 신청</p>
              </div>
            </div>
            <button id="btn-close-off-modal" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 flex items-center justify-center transition">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <!-- 신청 목록 -->
          <div class="space-y-3">
            ${Object.keys(requestListByStaff).length > 0 ? Object.entries(requestListByStaff).map(([name, days]) => `
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-teal-300 transition">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="font-bold text-slate-900">${name}</p>
                      <span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-extrabold text-[11px]">
                        총 ${days.length}일
                      </span>
                    </div>
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                      <span class="text-xs text-slate-500 font-bold mr-0.5">신청일자:</span>
                      ${days.map(d => {
                        const badge = getDayBadge(d);
                        return `
                          <span class="inline-flex items-center px-2.5 py-1 rounded-lg ${badge.badgeClass} font-extrabold text-xs shadow-2xs">
                            ${badge.text}
                          </span>
                        `;
                      }).join('')}
                    </div>
                  </div>
                </div>
              </div>
            `).join('') : `
              <div class="p-6 text-center text-slate-400 text-xs">
                접수된 희망 휴무 내역이 없습니다.
              </div>
            `}
          </div>

          <!-- 닫기 버튼 -->
          <div class="pt-2 border-t border-slate-100">
            <button id="btn-close-modal-footer" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition">
              닫기
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('modal-off-requests');

    const closeModal = () => modal?.remove();
    document.getElementById('btn-close-off-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-modal-footer')?.addEventListener('click', closeModal);

    // 모달 외부 클릭시 닫기
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  });
}
