import { db, isOfflineFallback } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { logger } from './loggerService';
import { STORAGE_KEYS, MAX_OFF_DAYS } from '../constants';

const STORAGE_KEY_REQUESTS = STORAGE_KEYS.REQUESTS;
const STORAGE_KEY_MONTHLY_OFF = STORAGE_KEYS.MONTHLY_OFF_REQUESTS || 'careshift_monthly_off_requests';

// 기본 초기 신청 데이터
const initialRequests = [
  {
    id: 'req_1',
    type: 'SWAP', // 맞교환
    typeName: '근무 맞교환',
    requesterId: 'st_7',
    requesterName: '김현자',
    targetId: 'st_8',
    targetName: '남기현',
    date: '2026-12-15',
    fromShift: 'N',
    toShift: 'B',
    reason: '집안 경조사로 인해 오후 근무로 변경 희망',
    status: 'PENDING_TARGET', // 동료 수락 대기
    statusText: '동료(남기현) 수락 대기중',
    createdAt: '2026-11-02 14:20'
  }
];

// ---------------------------------------------------------------------------
// 🌟 [신규 구조] 사용자별·월별 독립 희망 휴무 관리 (Firestore & LocalStorage)
// 경로: users/{userKey}/monthly_off/{yearMonth}
// ---------------------------------------------------------------------------

// 사용자 키 헬퍼 (이메일 우선, 없으면 UID 또는 staffId)
export function getUserRequestKey(userOrStaff) {
  if (!userOrStaff) return 'unknown_user';
  const email = (userOrStaff.email || userOrStaff.requesterEmail || '').trim().toLowerCase();
  if (email) return email;
  const uid = (userOrStaff.uid || userOrStaff.requesterUid || '').trim().toLowerCase();
  if (uid) return uid;
  const id = (userOrStaff.id || userOrStaff.staffId || userOrStaff.requesterId || '').trim().toLowerCase();
  if (id) return id;
  const name = (userOrStaff.name || userOrStaff.requesterName || '').trim().toLowerCase();
  if (name) return `name_${name}`;
  return 'unknown_user';
}

// 로컬 사용자별 월별 신청 캐시 맵 가져오기
function getLocalMonthlyOffMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MONTHLY_OFF);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// 로컬 사용자별 월별 신청 캐시 맵 저장
function saveLocalMonthlyOffMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY_MONTHLY_OFF, JSON.stringify(map));
  } catch (e) {
    console.warn("로컬 캐시 저장 오류:", e);
  }
}

/**
 * 특정 사용자의 특정 월 희망 휴무 신청 정보 저장
 * @param {Object} userOrStaff - { id, uid, name, email, phoneNumber }
 * @param {string} yearMonth - 예: '2026-12'
 * @param {number} selectedDay - 시작일 (예: 9)
 * @param {Array<number>} offDays - 휴무일 배열 (예: [9, 10])
 * @param {string} reason - 사유
 */
export async function saveUserMonthlyOffRequest(userOrStaff, yearMonth, selectedDay, offDays, reason = '개인 사정') {
  const userKey = getUserRequestKey(userOrStaff);
  const cleanPhone = (userOrStaff.phoneNumber || userOrStaff.requesterPhone || '').replace(/[^0-9]/g, '');

  const data = {
    userKey,
    yearMonth,
    selectedDay,
    offDays: Array.isArray(offDays) ? offDays : [selectedDay, selectedDay + 1],
    reason: reason || '개인 사정',
    requesterId: userOrStaff.id || userOrStaff.staffId || userOrStaff.requesterId || '',
    requesterUid: userOrStaff.uid || userOrStaff.requesterUid || '',
    requesterName: userOrStaff.name || userOrStaff.displayName || userOrStaff.requesterName || '',
    requesterEmail: (userOrStaff.email || userOrStaff.requesterEmail || '').toLowerCase().trim(),
    requesterPhone: cleanPhone,
    status: 'PENDING_ADMIN',
    statusText: '관리자(수간호사) 승인 대기중',
    updatedAt: new Date().toISOString(),
    updatedAtTimestamp: Date.now()
  };

  // 1. 로컬 캐시 즉시 업데이트
  const localMap = getLocalMonthlyOffMap();
  if (!localMap[yearMonth]) localMap[yearMonth] = {};
  localMap[yearMonth][userKey] = data;
  saveLocalMonthlyOffMap(localMap);

  console.log(`💾 [saveUserMonthlyOffRequest] 로컬 저장 완료 (${userKey} - ${yearMonth}: [${data.offDays}])`);

  // 2. Firestore 저장:
  // 최상위 `monthly_off_requests` 컬렉션에 `${yearMonth}_${userKey}` 문서로 저장하여
  // 콘솔에서 한눈에 확인 가능 및 1회 쿼리로 일괄 수집 가능하도록 최적화
  if (db) {
    try {
      const topLevelDocId = `${yearMonth}_${userKey}`;
      const topLevelDocRef = doc(db, 'monthly_off_requests', topLevelDocId);
      await setDoc(topLevelDocRef, data, { merge: true });
      console.log(`✅ [Firestore 저장 성공] monthly_off_requests/${topLevelDocId}`);

      // 사용자 서브컬렉션에도 동시 백업 (기존 구조 호환)
      const subDocRef = doc(db, 'users', userKey, 'monthly_off', yearMonth);
      await setDoc(subDocRef, data, { merge: true });
    } catch (e) {
      console.error(`❌ [Firestore 저장 실패] monthly_off_requests:`, e.message);
    }
  }

  // 3. 하위 호환성을 위해 requests 컬렉션 및 기존 캐시에도 OFF 데이터 동기화 유지
  try {
    const legacyItems = data.offDays.map((d, idx) => ({
      type: 'OFF',
      typeName: '희망 휴무(OFF)',
      requesterId: data.requesterId,
      requesterUid: data.requesterUid,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      requesterPhone: data.requesterPhone,
      targetId: '',
      targetName: '-',
      date: `${yearMonth}-${String(d).padStart(2, '0')}`,
      fromShift: 'D',
      toShift: 'OFF',
      reason: data.reason,
      rank: 1,
      month: yearMonth,
      status: 'PENDING_ADMIN',
      statusText: '관리자(수간호사) 승인 대기중'
    }));
    await replaceStaffMonthlyOffRequests(data.requesterId, data.requesterName, yearMonth, legacyItems);
  } catch (err) {
    console.warn("하위호환 requests 컬렉션 동기화 건너뜀:", err.message);
  }

  return data;
}

/**
 * 특정 사용자의 특정 월 희망 휴무 조회
 */
export async function getUserMonthlyOffRequest(userOrStaff, yearMonth) {
  const userKey = getUserRequestKey(userOrStaff);

  // 1. Firestore 최상위 컬렉션 우선 조회
  if (db) {
    try {
      const topDocRef = doc(db, 'monthly_off_requests', `${yearMonth}_${userKey}`);
      const topSnap = await getDoc(topDocRef);
      if (topSnap.exists()) {
        const data = topSnap.data();
        const localMap = getLocalMonthlyOffMap();
        if (!localMap[yearMonth]) localMap[yearMonth] = {};
        localMap[yearMonth][userKey] = data;
        saveLocalMonthlyOffMap(localMap);
        return data;
      }

      // 서브컬렉션 폴백 조회
      const docRef = doc(db, 'users', userKey, 'monthly_off', yearMonth);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const localMap = getLocalMonthlyOffMap();
        if (!localMap[yearMonth]) localMap[yearMonth] = {};
        localMap[yearMonth][userKey] = data;
        saveLocalMonthlyOffMap(localMap);
        return data;
      }
    } catch (e) {
      console.warn(`Firestore 사용자 휴무 조회 실패 (${userKey}):`, e.message);
    }
  }

  // 2. 로컬 캐시 조회
  const localMap = getLocalMonthlyOffMap();
  if (localMap[yearMonth] && localMap[yearMonth][userKey]) {
    return localMap[yearMonth][userKey];
  }

  return null;
}

/**
 * 관리자용: 특정 월의 모든 등록 사용자 희망 휴무 일괄 수집
 * 🌟 [개선] Firestore 최신 원격 데이터를 최우선으로 수집하고,
 * 로컬 캐시나 레거시 데이터가 최신 원격 데이터를 덮어쓰지 않도록 보장
 */
export async function getAllUsersMonthlyOffRequests(yearMonth, registeredUsers = []) {
  const resultMap = {}; // userKey -> request data

  // 1. Firestore 최상위 `monthly_off_requests` 컬렉션 원격 조회 (최신 원격 데이터 최우선!)
  if (db) {
    try {
      const qTop = query(
        collection(db, 'monthly_off_requests'),
        where('yearMonth', '==', yearMonth)
      );
      const topSnap = await getDocs(qTop);
      topSnap.forEach(d => {
        const data = d.data();
        if (data) {
          const userKey = data.userKey || getUserRequestKey(data);
          resultMap[userKey] = data;
          console.log(`🌐 [Firestore 최신 수신] ${userKey} (${data.requesterName}): [${data.offDays}]`);
        }
      });
    } catch (e) {
      console.warn("monthly_off_requests 쿼리 실패 (단일 조회 시도):", e.message);
    }

    // 1-2. 혹시 최상위에 아직 반영 안 된 직원은 users 서브컬렉션 병렬 조회
    try {
      const keysToFetch = new Set();
      registeredUsers.forEach(u => {
        const k = getUserRequestKey(u);
        if (k && k !== 'unknown_user' && !resultMap[k]) keysToFetch.add(k);
      });

      const fetchPromises = Array.from(keysToFetch).map(async (key) => {
        try {
          const docRef = doc(db, 'users', key, 'monthly_off', yearMonth);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            return { key, data: snap.data() };
          }
        } catch (e) {
          // ignore individual read errors
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(res => {
        if (res && res.data && !resultMap[res.key]) {
          resultMap[res.key] = res.data;
        }
      });
    } catch (e) {
      console.warn("getAllUsersMonthlyOffRequests 서브컬렉션 조회 오류:", e.message);
    }
  }

  // 2. Firestore에 전혀 없는 사용자만 로컬 캐시에서 폴백으로 보충 (Firestore에 있으면 절대 덮어쓰지 않음!)
  const localMap = getLocalMonthlyOffMap();
  if (localMap[yearMonth]) {
    Object.entries(localMap[yearMonth]).forEach(([k, localData]) => {
      if (!resultMap[k]) {
        resultMap[k] = localData;
      }
    });
  }

  // 3. 최신 Firestore 결과로 로컬 캐시 덮어써서 동기화
  if (!localMap[yearMonth]) localMap[yearMonth] = {};
  Object.assign(localMap[yearMonth], resultMap);
  saveLocalMonthlyOffMap(localMap);

  return resultMap;
}

export async function loadRequests() {
  let firestoreList = [];
  if (db) {
    try {
      const q = query(collection(db, 'requests'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Firestore 로드 실패:", e.message);
    }
  }

  let localList = [];
  const local = localStorage.getItem(STORAGE_KEY_REQUESTS);
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {
      console.warn("localStorage 파싱 실패:", e.message);
    }
  }

  // Firestore 데이터와 로컬스토리지 데이터를 ID 기준으로 병합 (Firestore가 최신)
  const combinedMap = new Map();
  localList.forEach(item => {
    if (item?.id) combinedMap.set(item.id, item);
  });
  firestoreList.forEach(item => {
    if (item?.id) combinedMap.set(item.id, item);
  });

  const merged = Array.from(combinedMap.values());

  console.log(`📊 [신청 데이터 로드]`);
  console.log(`  Firestore: ${firestoreList.length}건`);
  console.log(`  localStorage: ${localList.length}건`);
  console.log(`  병합 결과: ${merged.length}건 (중복 제거됨)`);

  // OFF 신청만 필터링해서 수 확인
  const offRequests = merged.filter(r => r.type === 'OFF');
  console.log(`  OFF 신청: ${offRequests.length}건`);

  if (merged.length > 0) {
    // 최신 순으로 정렬
    merged.sort((a, b) => {
      const timeA = a.createdAtTimestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAtTimestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(merged));
    return merged;
  }

  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(initialRequests));
  return initialRequests;
}

export async function saveRequest(newReq) {
  const list = await loadRequests();
  const item = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    ...newReq,
    createdAt: new Date().toLocaleString('ko-KR')
  };
  list.unshift(item);
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));

  console.log(`\n💾 [saveRequest]`);
  console.log(`  localStorage: ✅ 저장 완료`);

  // Firestore에 항상 저장 시도 (db가 있으면)
  if (db) {
    // UI 지연 방지를 위해 비동기 백그라운드 저장
    addDoc(collection(db, 'requests'), item)
      .then(docRef => {
        console.log(`  ✅ Firestore 저장 성공: ${docRef.id}`);
      })
      .catch(e => {
        console.error(`  ❌ Firestore 저장 실패: ${e.message}`);
      });
  } else {
    console.warn(`  ⚠️ db가 없음 - Firestore 저장 불가`);
  }

  return item;
}

// 특정 직원의 특정 월 기존 희망휴무 신청 건 전체 일괄 삭제/교체
export async function replaceStaffMonthlyOffRequests(staffId, staffName, monthPrefix, newRequestItems = []) {
  // 1. 현재 로컬 및 DB에 등록된 전체 목록 로드
  const all = await loadRequests();

  // 2. 삭제 대상 필터링: 해당 월의 모든 OFF 신청 중 staffId, staffName, email, phone, uid 중 하나라도 일치
  const inputStaffId = (staffId || '').trim().toLowerCase();
  const inputStaffName = (staffName || '').trim().toLowerCase();
  const inputEmail = newRequestItems.length > 0 ? (newRequestItems[0].requesterEmail || '').trim().toLowerCase() : '';
  const inputPhone = newRequestItems.length > 0 ? ((newRequestItems[0].requesterPhone || '').replace(/[^0-9]/g, '')) : '';
  const inputUid = newRequestItems.length > 0 ? (newRequestItems[0].requesterUid || '').trim().toLowerCase() : '';

  console.log(`🔍 [휴무신청 삭제 전 확인]`);
  console.log(`  입력값: staffId=${inputStaffId}, staffName=${inputStaffName}, email=${inputEmail || '(비어있음)'}, phone=${inputPhone || '(비어있음)'}, uid=${inputUid || '(비어있음)'}`);
  console.log(`  대상월: ${monthPrefix}`);

  const toDelete = all.filter(r => {
    if (r.type !== 'OFF' || !r.date || !r.date.startsWith(monthPrefix)) return false;

    const rStaffId = (r.requesterId || '').trim().toLowerCase();
    const rStaffName = (r.requesterName || '').trim().toLowerCase();
    const rEmail = (r.requesterEmail || '').trim().toLowerCase();
    const rPhone = ((r.requesterPhone || '').replace(/[^0-9]/g, ''));
    const rUid = (r.requesterUid || '').trim().toLowerCase();

    // 5중 조건: staffId, staffName, email, phone, uid 중 하나라도 일치하면 삭제 대상
    const isMatch = (inputStaffId && rStaffId === inputStaffId) ||
                    (inputStaffName && rStaffName === inputStaffName) ||
                    (inputEmail && rEmail === inputEmail) ||
                    (inputPhone && rPhone === inputPhone) ||
                    (inputUid && rUid === inputUid);

    if (isMatch) {
      console.log(`  ✅ 삭제 대상 발견: [${r.id}] ${r.requesterName || r.requesterEmail} (${r.date})`);
    }

    return isMatch;
  });

  console.log(`  💾 총 ${toDelete.length}건 삭제 예정`);

  const deleteIds = new Set(toDelete.map(d => d.id));
  const remaining = all.filter(r => !deleteIds.has(r.id));

  // 3. 새 신청 건 생성 (MAX_OFF_DAYS 초과 방지)
  const validatedItems = newRequestItems.map(item => ({
    ...item,
    requesterEmail: (item.requesterEmail || '').toLowerCase().trim(),
    requesterPhone: (item.requesterPhone || '').replace(/[^0-9]/g, '')
  }));

  // 각 rank 별로 최대 MAX_OFF_DAYS개만 유지
  const rank1Items = validatedItems.filter(i => i.rank === 1).slice(0, MAX_OFF_DAYS);
  const rank2Items = validatedItems.filter(i => i.rank === 2).slice(0, MAX_OFF_DAYS);
  const rank3Items = validatedItems.filter(i => i.rank === 3).slice(0, MAX_OFF_DAYS);

  const preparedNew = [...rank1Items, ...rank2Items, ...rank3Items].map((item, idx) => ({
    id: `req_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
    ...item,
    createdAt: new Date().toISOString(),
    createdAtTimestamp: Date.now()
  }));

  // 4. 로컬 캐시 즉시 갱신
  const updatedList = [...preparedNew, ...remaining];
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(updatedList));

  console.log(`\n✅ [휴무신청 저장 완료]`);
  console.log(`  기존 신청 삭제: ${toDelete.length}건`);
  console.log(`  새 신청 추가: ${preparedNew.length}건`);
  console.log(`  유지된 신청: ${remaining.length}건`);
  console.log(`  로컬 총 신청: ${updatedList.length}건`);

  // 저장된 신청 상세 정보 출력
  const newUserReqs = updatedList.filter(r =>
    r.type === 'OFF' &&
    r.date &&
    r.date.startsWith(monthPrefix) &&
    ((inputStaffId && (r.requesterId || '').trim().toLowerCase() === inputStaffId) ||
     (inputStaffName && (r.requesterName || '').trim().toLowerCase() === inputStaffName) ||
     (inputEmail && (r.requesterEmail || '').trim().toLowerCase() === inputEmail) ||
     (inputPhone && ((r.requesterPhone || '').replace(/[^0-9]/g, '')) === inputPhone))
  );

  console.log(`  ${inputStaffName || inputEmail || '신청자'}의 신청 내역:`);
  newUserReqs.forEach(r => {
    console.log(`    - [${r.id}] ${r.date} (${r.status || 'PENDING'})`);
  });

  // 5. Firestore 동기화 (항상 시도)
  console.log(`\n🔥 [Firestore 저장 시도]`);
  console.log(`  isOfflineFallback: ${isOfflineFallback}`);
  console.log(`  db: ${!!db ? '있음' : '없음'}`);

  try {
    if (!db) {
      console.warn(`  ⚠️ db가 없음 - Firestore 저장 불가`);
      return preparedNew;
    }

    const q = query(collection(db, 'requests'));
    const snap = await getDocs(q);
    const deletePromises = [];

    console.log(`📲 [Firestore 동기화] ${snap.size}건 중 삭제 대상 검색...`);

    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.type !== 'OFF' || !data.date || !data.date.startsWith(monthPrefix)) return;

      const rStaffId = (data.requesterId || '').trim().toLowerCase();
      const rStaffName = (data.requesterName || '').trim().toLowerCase();
      const rEmail = (data.requesterEmail || '').trim().toLowerCase();
      const rPhone = ((data.requesterPhone || '').replace(/[^0-9]/g, ''));
      const rUid = (data.requesterUid || '').trim().toLowerCase();

      // 5중 조건: staffId, staffName, email, phone, uid 중 하나라도 일치하면 삭제
      if ((inputStaffId && rStaffId === inputStaffId) ||
          (inputStaffName && rStaffName === inputStaffName) ||
          (inputEmail && rEmail === inputEmail) ||
          (inputPhone && rPhone === inputPhone) ||
          (inputUid && rUid === inputUid)) {
        console.log(`  🗑️ Firestore 삭제: [${docSnap.id}] ${data.requesterName || data.requesterEmail}`);
        deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)));
      }
    });

    if (deletePromises.length > 0) {
      console.log(`  ⏳ ${deletePromises.length}건 삭제 중...`);
      await Promise.all(deletePromises);
      console.log(`  ✅ Firestore 삭제 완료`);
    }

    if (preparedNew.length > 0) {
      console.log(`  ⏳ ${preparedNew.length}건 추가 중...`);
      const addPromises = preparedNew.map(item => addDoc(collection(db, 'requests'), item));
      await Promise.all(addPromises);
      console.log(`  ✅ Firestore 추가 완료`);
    }
  } catch (e) {
    console.error(`  ❌ Firestore 동기화 오류: ${e.message}`);
    logger.error('RequestService', 'Firestore 동기화 실패', e);
  }

  return preparedNew;
}

// Firestore requests 컬렉션 실시간 구독 리스너 (원격 신청 즉시 감지)
export function subscribeRequests(onChange) {
  if (!db) return () => {};

  try {
    const q = query(collection(db, 'requests'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = a.createdAtTimestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAtTimestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      // 로컬 스토리지도 자동 최신화
      if (list.length > 0) {
        localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));
      }

      if (onChange) onChange(list);
    }, (err) => {
      console.warn("Firestore requests 실시간 감시 오류:", err.message);
    });

    return unsubscribe;
  } catch (e) {
    console.warn("subscribeRequests 설정 실패:", e.message);
    return () => {};
  }
}

export async function updateRequestStatus(reqId, newStatus, newStatusText) {
  const list = await loadRequests();
  const target = list.find(r => r.id === reqId);
  if (target) {
    target.status = newStatus;
    target.statusText = newStatusText;
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));
  }

  if (db) {
    try {
      await updateDoc(doc(db, 'requests', reqId), {
        status: newStatus,
        statusText: newStatusText
      });
    } catch (e) {
      console.warn("Firestore request update error:", e);
    }
  }

  return target;
}
