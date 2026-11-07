// 엑셀(.xlsx) 파일 내보내기 & 불러오기 헬퍼
// 실제 요양병원 2층 양식(B, B2, N, N1, X, 서명란, 하단 일별 합계) 완벽 호환

export function exportRosterToCSV(rosterData) {
  const daysInMonth = 30;
  const staffList = rosterData.staffList;
  const assignments = rosterData.assignments;
  const dayNames = ['화', '수', '목', '금', '토', '일', '월', '화', '수', '목', '금', '토', '일', '월', '화', '수', '목', '금', '토', '일', '월', '화', '수', '목', '금', '토', '일', '월', '화', '수'];

  let csvContent = "\uFEFF"; // 한글 깨짐 방지 BOM

  // 1행: 헤더 1 (B, B2, N근무, 성명, 1~30일, 서명란)
  const header1 = ['B(주간)', 'B2', 'N근무', '성명'];
  for (let i = 1; i <= daysInMonth; i++) {
    header1.push(i);
  }
  header1.push('서명란');
  csvContent += header1.join(',') + '\r\n';

  // 2행: 헤더 2 (요일)
  const header2 = ['', '', '', '요일'];
  for (let i = 0; i < daysInMonth; i++) {
    header2.push(dayNames[i]);
  }
  header2.push('');
  csvContent += header2.join(',') + '\r\n';

  // 직원별 행
  staffList.forEach(staff => {
    const list = assignments[staff.id] || [];
    let bCount = 0, b2Count = 0, nCount = 0;
    list.forEach(a => {
      if (a.code === 'B' || a.code === 'D') bCount++;
      if (a.code === 'B2' || a.code === 'D2') b2Count++;
      if (a.code === 'N' || a.code === 'N1') nCount++;
    });

    const row = [bCount, b2Count > 0 ? b2Count : '', nCount, staff.name];
    for (let day = 1; day <= daysInMonth; day++) {
      const item = list.find(a => a.day === day);
      row.push(item ? item.code : 'X');
    }
    row.push(''); // 서명란
    csvContent += row.join(',') + '\r\n';
  });

  // 하단 통계 행 (B, B2, N1, N)
  const stats = [
    { label: 'B (주간)', code: 'B' },
    { label: 'B2 (지원)', code: 'B2' },
    { label: 'N1 (후반야 4H)', code: 'N1' },
    { label: 'N (전반야 4H)', code: 'N' }
  ];

  stats.forEach(st => {
    const statRow = ['', '', '', st.label];
    for (let day = 1; day <= daysInMonth; day++) {
      let sum = 0;
      staffList.forEach(staff => {
        const c = (assignments[staff.id] || []).find(a => a.day === day)?.code;
        if (st.code === 'B' && (c === 'B' || c === 'D')) sum++;
        else if (st.code === 'B2' && (c === 'B2' || c === 'D2')) sum++;
        else if (st.code === 'N1' && c === 'N1') sum++;
        else if (st.code === 'N' && c === 'N') sum++;
      });
      statRow.push(sum);
    }
    statRow.push('');
    csvContent += statRow.join(',') + '\r\n';
  });

  // 다운로드 트리거
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${rosterData.title || '2026년_09월_직원근무표'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

