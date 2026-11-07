import { db, isOfflineFallback } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { realStaffList, generateRealHospitalRoster } from './realRosterData';

const STORAGE_KEY_ROSTER = 'careshift_real_roster_202609';

// 캐시된 인메모리 데이터 (즉각적인 화면 렌더링용)
let cachedRoster = null;

// 1. 대기시간 0ms로 즉시 로컬 캐시 또는 기본 데이터 반환 (Instant Load)
export function getLocalRosterData() {
  if (cachedRoster) return cachedRoster;

  const localRoster = localStorage.getItem(STORAGE_KEY_ROSTER);
  if (localRoster) {
    try {
      cachedRoster = JSON.parse(localRoster);
      return cachedRoster;
    } catch (e) {
      console.warn("Local storage parse error, generating fresh data:", e);
    }
  }

  // 로컬에도 없으면 즉시 기본 서식 반환
  cachedRoster = {
    title: '2026년 09 월 직원근무표 ( 2층 요양보호사)',
    year: 2026,
    month: 9,
    floor: '2층 요양보호사',
    printedAt: '2026-08-24 11:47',
    status: 'published',
    version: '배포본 v1.0',
    staffList: realStaffList,
    assignments: generateRealHospitalRoster(),
    changeLogs: [
      { id: 'log_1', date: '2026-08-24', content: '2026년 9월 정규 근무표 최초 배포 (수간호사 승인)', author: '수간호사' },
      { id: 'log_2', date: '2026-08-28', content: '윤인국 10일 N 대체근무 지정 (빨간색 표시)', author: '팀장' }
    ]
  };

  localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(cachedRoster));
  return cachedRoster;
}

// 2. 백그라운드 비동기 Firestore 동기화 (최대 2.5초 타임아웃 방어)
export async function syncRosterFromFirestore() {
  if (isOfflineFallback || !db) return getLocalRosterData();

  try {
    const fetchPromise = getDoc(doc(db, 'rosters', '202609_2fl'));
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore timeout')), 2500)
    );

    const rosterDoc = await Promise.race([fetchPromise, timeoutPromise]);
    if (rosterDoc && rosterDoc.exists()) {
      cachedRoster = rosterDoc.data();
      localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(cachedRoster));
      return cachedRoster;
    }
  } catch (e) {
    console.log("Firestore background sync skipped (network timeout or offline):", e.message);
  }

  return getLocalRosterData();
}

// 3. 근무표 데이터 저장 (로컬 즉시 반영 + 파이어베이스 백그라운드 저장)
export async function saveRosterData(data) {
  cachedRoster = data;
  localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(data));

  if (!isOfflineFallback && db) {
    // UI 멈춤 없이 백그라운드에서 조용히 저장
    setDoc(doc(db, 'rosters', '202609_2fl'), data).catch(err => {
      console.warn("Background Firestore save warning:", err);
    });
  }
}
