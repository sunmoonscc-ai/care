// 실제 요양병원 현장 근무표 검증 규칙 (B/D, E, N, N1, B2, X/OFF 및 역듀티, 연속근무 등)
import { getAppSettings } from './settingsService';

export function validateRoster(staffList, rosterAssignments) {
  const violations = [];
  const daysInMonth = 30;
  const settings = getAppSettings();
  const rules = settings.rosterRules || {};

  // 1. 직원별 규칙 점검
  staffList.forEach(staff => {
    const list = rosterAssignments[staff.id] || [];
    let consecutiveNights = 0;
    let consecutiveWorkDays = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const isWork = (item.code === 'B' || item.code === 'D' || item.code === 'E' || item.code === 'N' || item.code === 'N1' || item.code === 'B2' || item.code === 'MID');
      const isNight = (item.code === 'N' || item.code === 'N1');

      if (isWork) {
        consecutiveWorkDays++;
      } else {
        consecutiveWorkDays = 0;
      }

      // 연속 근무 상한 검증 (6일 초과 시)
      if (consecutiveWorkDays > 6) {
        violations.push({
          type: 'error',
          rule: '연속 근무 상한 초과',
          staffId: staff.id,
          staffName: staff.name,
          day: item.day,
          message: `${staff.name}님: ${item.day}일 기준 ${consecutiveWorkDays}일 연속 근무 (최대 6일 상한)`
        });
      }

      // 🛑 역듀티(Reverse Duty) 검증: 전일 E(저녁 23시) 후 당일 D(낮 07시) 출근 금지
      if (rules.noReverseDuty !== false && prev && prev.code === 'E' && (item.code === 'D' || item.code === 'B')) {
        violations.push({
          type: 'error',
          rule: '역듀티(E➔D) 금지 위반',
          staffId: staff.id,
          staffName: staff.name,
          day: item.day,
          message: `${staff.name}님: ${prev.day}일 Evening(23시 퇴근) 후 ${item.day}일 Day(07시 출근) 배치됨 (수면시간 부족)`
        });
      }

      // 야간(N, N1) 연속 점검 (설정된 상한 기준, 기본 2일)
      const maxNight = rules.maxConsecutiveNight || 2;
      if (isNight) {
        consecutiveNights++;
        if (consecutiveNights > maxNight) {
          violations.push({
            type: 'warning',
            rule: `연속 야간(${maxNight}일 상한) 초과`,
            staffId: staff.id,
            staffName: staff.name,
            day: item.day,
            message: `${staff.name}님: ${item.day}일에 야간(${item.code}) ${consecutiveNights}일 연속 배치 (피로도 한계 초과)`
          });
        }
      } else {
        // N 또는 N1 후 다음날 비번(X 또는 OFF) 미배치 점검
        if (prev && (prev.code === 'N' || prev.code === 'N1') && isWork) {
          violations.push({
            type: 'error',
            rule: '야간 근무 후 휴무 미보장',
            staffId: staff.id,
            staffName: staff.name,
            day: item.day,
            message: `${staff.name}님: 전일 야간 후 ${item.day}일에 주간/저녁(${item.code}) 출근 배정 (비번 OFF 필요)`
          });
        }
        consecutiveNights = 0;
      }
    }
  });

  // 2. 날짜별 주간 최소 3~4명, 야간 2명 필수 인원 점검
  for (let day = 1; day <= daysInMonth; day++) {
    let dayCount = 0;
    let n1Count = 0;
    let nCount = 0;

    staffList.forEach(staff => {
      const item = (rosterAssignments[staff.id] || []).find(a => a.day === day);
      if (item) {
        if (item.code === 'B' || item.code === 'D' || item.code === 'E' || item.code === 'MID') dayCount++;
        if (item.code === 'N1') n1Count++;
        if (item.code === 'N') nCount++;
      }
    });

    // 주간 최소 인원 점검
    if (dayCount < 3) {
      violations.push({
        type: 'warning',
        rule: '주간/오후 최소 인원 미달',
        day,
        message: `${day}일 주간/저녁 인원 ${dayCount}명으로 병동 최소 기준(3명) 미달`
      });
    }

    // 야간 필수 2인 체계 점검
    const totalNight = n1Count + nCount;
    if (totalNight < 2) {
      violations.push({
        type: 'error',
        rule: '야간(Night) 필수 인원 공백',
        day,
        message: `${day}일 야간 총원 ${totalNight}명 (야간 순찰/낙상방지 2명 미달)`
      });
    }
  }

  return violations;
}
