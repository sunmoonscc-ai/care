// 실제 요양병원 현장 근무코드 및 규칙 체계 (업로드된 실제 근무표 이미지 반영)

export const realShiftTypes = {
  D: { code: 'D', name: '주간/데이', hours: 8, bg: 'bg-white', text: 'text-slate-800', border: 'border-slate-300' },
  B: { code: 'B', name: '주간(B)', hours: 8, bg: 'bg-white', text: 'text-slate-800', border: 'border-slate-300' },
  D2: { code: 'D2', name: '주간지원(D2)', hours: 8, bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' },
  B2: { code: 'B2', name: '주간지원(B2)', hours: 8, bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' },
  N: { code: 'N', name: '야간/전반야(4H 휴식)', hours: 8, bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400', isNight: true },
  N1: { code: 'N1', name: '야간1/후반야(4H 휴식)', hours: 8, bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400', isNight: true },
  OFF: { code: 'OFF', name: '일반휴무', hours: 0, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  X: { code: 'X', name: '비번/휴무', hours: 0, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  REQ_OFF: { code: 'OFF', name: '신청휴무(빨간색)', hours: 0, bg: 'bg-rose-50', text: 'text-rose-600 font-bold', border: 'border-rose-300', isRequested: true },
  REQ_X: { code: 'X', name: '신청비번(빨간색)', hours: 0, bg: 'bg-rose-50', text: 'text-rose-600 font-bold', border: 'border-rose-300', isRequested: true }
};

// 2층 요양보호사 실제 직원 데이터 (제공된 이미지 명단 기준)
export const realStaffList = [
  { id: 'st_1', name: '한애순', role: '요양보호사', fixedD: 11, fixedN: 7 },
  { id: 'st_2', name: '이성태', role: '요양보호사', fixedD: 11, fixedN: 6 },
  { id: 'st_3', name: '윤인국', role: '요양보호사', fixedD: 11, fixedN: 6 },
  { id: 'st_4', name: '박춘열', role: '요양보호사', fixedD: 10, fixedN: 7 },
  { id: 'st_5', name: '석기호', role: '요양보호사', fixedD: 10, fixedN: 7 },
  { id: 'st_6', name: '이상진', role: '요양보호사', fixedD: 10, fixedN: 7 },
  { id: 'st_7', name: '김현자', role: '요양보호사', fixedD: 10, fixedN: 7 },
  { id: 'st_8', name: '남기현', role: '요양보호사', fixedD: 10, fixedN: 7 },
  { id: 'st_9', name: '김선애', role: '요양보호사', fixedD: 11, fixedN: 6 },
  { id: 'st_10', name: '허향옥', role: '요양보호사(지원)', fixedD: 8, fixedN: 0 }
];

// 실제 2026년 9월 2층 요양보호사 근무표 패턴 생성
export function generateRealHospitalRoster() {
  const assignments = {};
  
  // 9월 첫날 화요일 시작, 30일
  // 이미지 1: 한애순 B B N X N1 X B X B B N X N1 X B B X X B N1 X X B N1 X B N X X B
  const patterns = {
    st_1: ['B','B','N','X','N1','X','B','X','B','B','N','X','N1','X','B','B','X','X','B','N1','X','X','B','N1','X','B','N','X','X','B'],
    st_2: ['N1','X','B','N','X','B','X','B','B','N1','X','X','B','N','X','N1','X','B','B','X','X','B','B2','X','B','N','X','B','B','X'],
    st_3: ['X','B','X','B','X','B','B','N1','X','N','X','B','X','B','B','X','N','X','N1','X','B','X','N1','X','N','X','B','B','X','B'],
    st_4: ['B','X','B','X','N','X','B','N','X','B','N1','X','B','B','X','B','B','X','N','X','N1','X','X','B','B','X','X','N1','X','N'],
    st_5: ['N','X','B','X','X','B','N1','X','X','B','X','B','N','X','X','X','B','N','X','B','X','B','B','X','N1','N1','X','B','B','N1'],
    st_6: ['X','B','N1','X','B','X','N','X','X','B','B','N','X','B','N','X','N1','X','X','B','B','N','X','B','X','X','N1','X','B','B'],
    st_7: ['X','N1','X','B','B','N1','X','B','N','X','B','N1','X','X','B','N','X','B','X','N','X','B','B','X','X','X','B','N','X','B'],
    st_8: ['B','N','X','B','B','X','B','B','N1','X','X','X','B','X','N1','X','B','N1','X','B','N','X','N','X','B','B','X','X','N1','X'],
    st_9: ['X','B','B','N1','X','N','X','B','B','X','B','B','X','N1','X','B','B','X','X','X','B','N1','X','N','X','B','B','X','N','X'],
    st_10: ['','','','','','','','','','','','','','B','B','X','B','B','X','B','B','X','B','X','X','X','B','X','X']
  };

  // 신청에 의해 빨간색으로 표시된 날짜들(희망휴무 또는 수동변경)
  const requestedOffs = {
    st_1: [17, 18],
    st_2: [20, 21],
    st_3: [10], // 윤인국 10일 N 빨간색(대체근무)
    st_5: [4, 5],
    st_7: [24, 25, 26],
    st_8: [26, 27],
    st_9: [24],
    st_10: [24, 25, 26]
  };

  realStaffList.forEach(staff => {
    assignments[staff.id] = [];
    const p = patterns[staff.id] || [];
    const reqList = requestedOffs[staff.id] || [];

    for (let day = 1; day <= 30; day++) {
      const code = p[day - 1] || 'X';
      const isReq = reqList.includes(day);
      assignments[staff.id].push({
        day,
        code: code === '' ? 'X' : code,
        isRequested: isReq,
        note: isReq ? '요청 반영/변경' : ''
      });
    }
  });

  return assignments;
}

