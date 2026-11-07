// UTF-8 Clean Mock Data for Roster Simulation

export const initialStaffList = [
  { id: 'staff_1', name: '박정희', role: '팀장', level: '숙련(7년)', type: '직고용', nightOk: true, prefOff: [7, 8, 21, 22] },
  { id: 'staff_2', name: '김미숙', role: '요양보호사', level: '숙련(5년)', type: '야간전담', nightOk: true, prefOff: [5, 6, 19, 20] },
  { id: 'staff_3', name: '이순자', role: '요양보호사', level: '일반(3년)', type: '직고용', nightOk: true, prefOff: [10, 11] },
  { id: 'staff_4', name: '최영희', role: '요양보호사', level: '숙련(6년)', type: '직고용', nightOk: true, prefOff: [1, 2, 15] },
  { id: 'staff_5', name: '정미경', role: '요양보호사', level: '일반(2년)', type: '직고용', nightOk: false, prefOff: [14, 28] },
  { id: 'staff_6', name: '강옥순', role: '요양보호사', level: '신규(6개월)', type: '직고용', nightOk: false, prefOff: [3, 4] },
  { id: 'staff_7', name: '조명희', role: '요양보호사', level: '일반(3년)', type: '파견', nightOk: true, prefOff: [12, 13] },
  { id: 'staff_8', name: '한선화', role: '요양보호사', level: '숙련(4년)', type: '직고용', nightOk: true, prefOff: [8, 9] },
  { id: 'staff_9', name: '윤숙자', role: '요양보호사', level: '일반(2년)', type: '파견', nightOk: true, prefOff: [17, 18] },
  { id: 'staff_10', name: '장혜숙', role: '요양보호사', level: '신규(3개월)', type: '직고용', nightOk: false, prefOff: [22, 23] }
];

export const shiftTypes = {
  D: { code: 'D', name: '데이', time: '07:00~15:00', hours: 8, bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  E: { code: 'E', name: '이브닝', time: '15:00~23:00', hours: 8, bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  N: { code: 'N', name: '나이트', time: '23:00~07:00', hours: 8, bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', isNight: true },
  O: { code: 'O', name: '휴무/비번', time: '-', hours: 0, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  Y: { code: 'Y', name: '연차', time: '-', hours: 8, bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  R: { code: 'R', name: '희망휴무', time: '-', hours: 0, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' }
};

export function generateInitialRoster(year = 2026, month = 11) {
  const daysInMonth = 30;
  const assignments = {};

  initialStaffList.forEach((staff, idx) => {
    assignments[staff.id] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      let code = 'D';
      const dayOfWeek = (day + 6) % 7;

      if (staff.id === 'staff_2') {
        if (day >= 11 && day <= 14) code = 'N';
        else if (day % 3 === 0) code = 'N';
        else code = 'O';
      } else if (staff.prefOff.includes(day)) {
        code = 'O';
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        code = (idx + day) % 2 === 0 ? 'O' : 'D';
      } else {
        const cycle = ['D', 'D', 'E', 'E', 'O'];
        code = cycle[(day + idx) % cycle.length];
      }
      assignments[staff.id].push({ day, code });
    }
  });

  return assignments;
}
