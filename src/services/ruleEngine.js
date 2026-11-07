// 실제 요양병원 현장 근무표 검증 규칙 (B/D, N, N1, B2, X/OFF)

export function validateRoster(staffList, rosterAssignments) {
  const violations = [];
  const daysInMonth = 30;

  // 1. 직원별 규칙 점검
  staffList.forEach(staff => {
    const list = rosterAssignments[staff.id] || [];
    let consecutiveNights = 0;
    let consecutiveWorkDays = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const isWork = (item.code === 'B' || item.code === 'D' || item.code === 'N' || item.code === 'N1' || item.code === 'B2');
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

      // 야간(N, N1) 연속 점검
      if (isNight) {
        consecutiveNights++;
        if (consecutiveNights >= 2) {
          violations.push({
            type: 'warning',
            rule: '야간 2일 연속 배치',
            staffId: staff.id,
            staffName: staff.name,
            day: item.day,
            message: `${staff.name}님: ${item.day}일에 야간(${item.code}) 연속 배치 (피로도 주의)`
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
            message: `${staff.name}님: 전일 야간 후 ${item.day}일에 주간(${item.code}) 출근 배정 (비번 X 필요)`
          });
        }
        consecutiveNights = 0;
      }
    }
  });

  // 2. 날짜별 주간(B/D) 최소 3~4명, 야간(N 1명, N1 1명 또는 N 2명) 필수 인원 점검
  for (let day = 1; day <= daysInMonth; day++) {
    let dayCount = 0;
    let n1Count = 0;
    let nCount = 0;

    staffList.forEach(staff => {
      const item = (rosterAssignments[staff.id] || []).find(a => a.day === day);
      if (item) {
        if (item.code === 'B' || item.code === 'D') dayCount++;
        if (item.code === 'N1') n1Count++;
        if (item.code === 'N') nCount++;
      }
    });

    // 주간 최소 인원 점검
    if (dayCount < 3) {
      violations.push({
        type: 'warning',
        rule: '주간(B/D) 최소 인원 미달',
        day,
        message: `9/${day} 주간 인원 ${dayCount}명으로 병동 최소 기준(3명) 미달`
      });
    }

    // 야간 전반야/후반야 필수 2인 체계 점검
    const totalNight = n1Count + nCount;
    if (totalNight < 2) {
      violations.push({
        type: 'error',
        rule: '야간(N/N1) 필수 인원 공백',
        day,
        message: `9/${day} 야간 총원 ${totalNight}명 (전반야/후반야 교대조 2명 미달)`
      });
    }
  }

  return violations;
}
