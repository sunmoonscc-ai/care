import { db, isOfflineFallback } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { buildDynamicStaffList, generateRealHospitalRoster } from './realRosterData';
import { getAppSettings } from './settingsService';
import { getRegisteredMembers } from './userService';

const STORAGE_KEY_ROSTER = 'careshift_real_roster_202609';

// 캐시된 인메모리 데이터 (즉각적인 화면 렌더링용)
let cachedRoster = null;

// 최신 설정값과 가입 회원 명단을 바탕으로 동적 기본 근무표 생성
export function createDefaultRoster() {
  const settings = getAppSettings();
  const members = getRegisteredMembers();
  const staffList = buildDynamicStaffList(settings.totalStaffCount, members);
  const assignments = generateRealHospitalRoster(staffList);

  return {
    title: '2026년 09 월 직원근무표 ( 2층 요양보호사)',
    year: 2026,
    month: 9,
    floor: '2층 요양보호사',
    printedAt: '2026-08-24 11:47',
    status: 'published',
    version: '배포본 v1.0',
    staffList: staffList,
    assignments: assignments,
    changeLogs: [
      { id: 'log_1', date: '2026-08-24', content: '2026년 9월 정규 근무표 최초 배포 (수간호사 승인)', author: '수간호사' },
      { id: 'log_2', date: '2026-08-28', content: '윤인국 10일 N 대체근무 지정 (빨간색 표시)', author: '팀장' }
    ]
  };
}

// 1. 대기시간 0ms로 즉시 로컬 캐시 또는 기본 데이터 반환 (Instant Load)
export function getLocalRosterData() {
  const settings = getAppSettings();
  const members = getRegisteredMembers();
  const expectedStaffList = buildDynamicStaffList(settings.totalStaffCount, members);

  if (cachedRoster) {
    // 직원 목록이 동적으로 변경되었는지 확인 및 동기화
    cachedRoster.staffList = expectedStaffList;
    expectedStaffList.forEach(s => {
      if (!cachedRoster.assignments[s.id]) {
        const fresh = generateRealHospitalRoster([s]);
        cachedRoster.assignments[s.id] = fresh[s.id];
      }
    });
    return cachedRoster;
  }

  const localRoster = localStorage.getItem(STORAGE_KEY_ROSTER);
  if (localRoster) {
    try {
      cachedRoster = JSON.parse(localRoster);
      cachedRoster.staffList = expectedStaffList;
      expectedStaffList.forEach(s => {
        if (!cachedRoster.assignments[s.id]) {
          const fresh = generateRealHospitalRoster([s]);
          cachedRoster.assignments[s.id] = fresh[s.id];
        }
      });
      return cachedRoster;
    } catch (e) {
      console.warn("Local storage parse error, generating fresh data:", e);
    }
  }

  // 로컬에도 없으면 즉시 동적 기본 서식 반환
  cachedRoster = createDefaultRoster();
  localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(cachedRoster));
  return cachedRoster;
}

// 2. 백그라운드 비동기 Firestore 동기화 (캐시와 DB 비교 후 필요 시 업데이트)
export async function syncRosterFromFirestore(force = false) {
  if (isOfflineFallback || !db) return getLocalRosterData();

  try {
    const fetchPromise = getDoc(doc(db, 'rosters', '202609_2fl'));
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore timeout')), 3500)
    );

    const rosterDoc = await Promise.race([fetchPromise, timeoutPromise]);
    if (rosterDoc && rosterDoc.exists()) {
      const remoteData = rosterDoc.data();
      const localStr = localStorage.getItem(STORAGE_KEY_ROSTER);
      const remoteStr = JSON.stringify(remoteData);

      if (localStr !== remoteStr || force) {
        console.log("🔄 [syncRosterFromFirestore] 근무표 DB 변경사항 감지 -> 캐시 갱신 완료");
        cachedRoster = remoteData;
        
        // 동적 직원 정보 동기화
        const settings = getAppSettings();
        const members = getRegisteredMembers();
        cachedRoster.staffList = buildDynamicStaffList(settings.totalStaffCount, members);

        localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(cachedRoster));
        return { updated: true, data: cachedRoster };
      } else {
        console.log("✅ [syncRosterFromFirestore] 근무표 로컬 캐시와 Firestore DB 일치함");
        cachedRoster = remoteData;
        const settings = getAppSettings();
        const members = getRegisteredMembers();
        cachedRoster.staffList = buildDynamicStaffList(settings.totalStaffCount, members);
        return { updated: false, data: cachedRoster };
      }
    }
  } catch (e) {
    console.log("Firestore background sync skipped (network timeout or offline):", e.message);
  }

  return { updated: false, data: getLocalRosterData() };
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

// 12월 근무표 초기화 (관리자 전용)
export async function deleteDecemberRoster() {
  const decemberKey = '202612_2fl';

  // 로컬스토리지에서 12월 데이터 삭제
  localStorage.removeItem(decemberKey);

  // Firestore에서 12월 데이터 삭제
  if (!isOfflineFallback && db) {
    try {
      const docRef = doc(db, 'rosters', decemberKey);
      // deleteDoc을 사용하면 문서를 완전히 삭제하므로, 빈 객체로 설정하거나 직접 삭제
      setDoc(docRef, {
        title: '',
        year: 2026,
        month: 12,
        status: 'draft',
        staffList: [],
        assignments: {},
        changeLogs: []
      }).catch(err => {
        console.warn("Firestore December roster reset warning:", err);
      });
    } catch (e) {
      console.warn("December roster reset error:", e);
    }
  }

  console.log("✅ 12월 근무표 초기화 완료");
}
