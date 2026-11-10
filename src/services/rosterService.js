import { db, isOfflineFallback } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { buildDynamicStaffList, generateRealHospitalRoster } from './realRosterData';
import { getAppSettings } from './settingsService';
import { getRegisteredMembers } from './userService';
import { logger } from './loggerService';
import { cacheManager, CACHE_TTL } from './cacheService';
import { DEFAULT_YEAR, DEFAULT_MONTH, FLOOR_NAME, FIRESTORE_TIMEOUT, STORAGE_KEYS } from '../constants';

const STORAGE_KEY_ROSTER = STORAGE_KEYS.ROSTER;
const CACHE_KEY_ROSTER = 'roster_cached';

// 최신 설정값과 가입 회원 명단을 바탕으로 동적 기본 근무표 생성
export function createDefaultRoster() {
  const settings = getAppSettings();
  const members = getRegisteredMembers();
  const staffList = buildDynamicStaffList(settings.totalStaffCount, members);
  const assignments = generateRealHospitalRoster(staffList);
  const now = new Date();

  return {
    title: `${DEFAULT_YEAR}년 ${String(DEFAULT_MONTH).padStart(2, '0')} 월 직원근무표 (${FLOOR_NAME})`,
    year: DEFAULT_YEAR,
    month: DEFAULT_MONTH,
    floor: FLOOR_NAME,
    printedAt: now.toLocaleDateString('ko-KR'),
    status: 'draft',
    version: '기본값',
    staffList: staffList,
    assignments: assignments,
    changeLogs: []
  };
}

// 1. 대기시간 0ms로 즉시 로컬 캐시 또는 기본 데이터 반환 (Instant Load)
export function getLocalRosterData() {
  const settings = getAppSettings();
  const members = getRegisteredMembers();
  const expectedStaffList = buildDynamicStaffList(settings.totalStaffCount, members);

  // 메모리 캐시 확인
  let cachedRoster = cacheManager.get(CACHE_KEY_ROSTER);
  if (cachedRoster) {
    cachedRoster.staffList = expectedStaffList;
    expectedStaffList.forEach(s => {
      if (!cachedRoster.assignments[s.id]) {
        const fresh = generateRealHospitalRoster([s]);
        cachedRoster.assignments[s.id] = fresh[s.id];
      }
    });
    return cachedRoster;
  }

  // localStorage에서 로드
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
      cacheManager.set(CACHE_KEY_ROSTER, cachedRoster, CACHE_TTL.LONG);
      return cachedRoster;
    } catch (e) {
      logger.warn('RosterService', 'localStorage 파싱 실패', e.message);
    }
  }

  // 로컬에도 없으면 기본값 생성
  cachedRoster = createDefaultRoster();
  localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(cachedRoster));
  cacheManager.set(CACHE_KEY_ROSTER, cachedRoster, CACHE_TTL.LONG);
  return cachedRoster;
}

// 2. 백그라운드 비동기 Firestore 동기화 (캐시와 DB 비교 후 필요 시 업데이트)
export async function syncRosterFromFirestore(force = false) {
  if (isOfflineFallback || !db) return getLocalRosterData();

  try {
    const firestoreKey = `${DEFAULT_YEAR}${String(DEFAULT_MONTH).padStart(2, '0')}_2fl`;
    const fetchPromise = getDoc(doc(db, 'rosters', firestoreKey));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), FIRESTORE_TIMEOUT)
    );

    const rosterDoc = await Promise.race([fetchPromise, timeoutPromise]);
    if (rosterDoc && rosterDoc.exists()) {
      const remoteData = rosterDoc.data();
      const localStr = localStorage.getItem(STORAGE_KEY_ROSTER);
      const remoteStr = JSON.stringify(remoteData);

      if (localStr !== remoteStr || force) {
        // 동적 직원 정보 동기화
        const settings = getAppSettings();
        const members = getRegisteredMembers();
        remoteData.staffList = buildDynamicStaffList(settings.totalStaffCount, members);

        localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(remoteData));
        cacheManager.set(CACHE_KEY_ROSTER, remoteData, CACHE_TTL.LONG);
        return { updated: true, data: remoteData };
      } else {
        const settings = getAppSettings();
        const members = getRegisteredMembers();
        remoteData.staffList = buildDynamicStaffList(settings.totalStaffCount, members);
        cacheManager.set(CACHE_KEY_ROSTER, remoteData, CACHE_TTL.LONG);
        return { updated: false, data: remoteData };
      }
    }
  } catch (e) {
    logger.debug('RosterService', 'Firestore 동기화 스킵', e.message);
  }

  return { updated: false, data: getLocalRosterData() };
}

// 3. 근무표 데이터 저장 (로컬 즉시 반영 + 파이어베이스 백그라운드 저장)
export async function saveRosterData(data) {
  cacheManager.set(CACHE_KEY_ROSTER, data, CACHE_TTL.LONG);

  // 년월 기반 동적 키 생성
  const storageKey = `${STORAGE_KEY_ROSTER}_${data.year}${String(data.month).padStart(2, '0')}`;
  const firestoreKey = `${data.year}${String(data.month).padStart(2, '0')}_2fl`;

  localStorage.setItem(storageKey, JSON.stringify(data));

  if (!isOfflineFallback && db) {
    setDoc(doc(db, 'rosters', firestoreKey), data).catch(err => {
      logger.warn('RosterService', '근무표 저장 실패', err);
    });
  }
}

// 12월 근무표 완전 초기화 (관리자 전용)
export async function deleteDecemberRoster() {
  // 1. 캐시 초기화
  cacheManager.delete(CACHE_KEY_ROSTER);

  // 2. 로컬스토리지 완전 삭제
  const keysToRemove = [
    'careshift_roster_202612',
    'careshift_real_roster_202609',
    'careshift_real_roster_202612',
    'careshift_roster_2026-12',
    'december_roster',
    'roster_december',
    'roster_2026_12'
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  // 3. Firestore 완전 삭제
  if (!isOfflineFallback && db) {
    try {
      const firestoreKeysToDelete = [
        '202612_2fl',
        '202609_2fl',
        '2026-12-2fl',
        'december_roster'
      ];

      for (const key of firestoreKeysToDelete) {
        try {
          await deleteDoc(doc(db, 'rosters', key));
        } catch (e) {
          if (!e.message.includes('not-found')) {
            logger.warn('RosterService', `근무표 삭제 실패: ${key}`, e.message);
          }
        }
      }
    } catch (e) {
      logger.error('RosterService', '근무표 초기화 실패', e);
    }
  }
}
