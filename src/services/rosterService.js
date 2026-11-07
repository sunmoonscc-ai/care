import { db, isOfflineFallback } from './firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { realStaffList, generateRealHospitalRoster } from './realRosterData';

const STORAGE_KEY_ROSTER = 'careshift_real_roster_202609';

export async function loadRosterData() {
  if (!isOfflineFallback && db) {
    try {
      const rosterDoc = await getDoc(doc(db, 'rosters', '202609_2fl'));
      if (rosterDoc.exists()) {
        return rosterDoc.data();
      }
    } catch (e) {
      console.warn("Firestore fetch error, fallback to local storage:", e);
    }
  }

  // 로컬 스토리지 확인
  const localRoster = localStorage.getItem(STORAGE_KEY_ROSTER);
  if (localRoster) {
    return JSON.parse(localRoster);
  }

  // 실제 병원 서식 기반 초기 데이터 세팅
  const initial = {
    title: '2026년 09 월 직원근무표 ( 2층 요양보호사)',
    year: 2026,
    month: 9,
    floor: '2층 요양보호사',
    printedAt: '2026-08-24 11:47',
    status: 'published', // 배포 완료 상태
    version: '배포본 v1.0',
    staffList: realStaffList,
    assignments: generateRealHospitalRoster(),
    changeLogs: [
      { id: 'log_1', date: '2026-08-24', content: '2026년 9월 정규 근무표 최초 배포 (수간호사 승인)', author: '수간호사' },
      { id: 'log_2', date: '2026-08-28', content: '윤인국 10일 N 대체근무 지정 (빨간색 표시)', author: '팀장' },
      { id: 'log_3', date: '2026-08-30', content: '한애순 17, 18일 희망휴무(X) 승인 및 반영', author: '수간호사' }
    ]
  };

  localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(initial));
  return initial;
}

export async function saveRosterData(data) {
  localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(data));

  if (!isOfflineFallback && db) {
    try {
      await setDoc(doc(db, 'rosters', '202609_2fl'), data);
    } catch (e) {
      console.warn("Firestore save error (stored locally):", e);
    }
  }
}
