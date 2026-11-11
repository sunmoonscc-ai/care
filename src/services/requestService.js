import { db, isOfflineFallback } from './firebase';
import {
  collection,
  doc,
  getDocs,
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

export async function loadRequests() {
  let firestoreList = [];
  if (!isOfflineFallback && db) {
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

export async function updateRequestStatus(reqId, newStatus, newStatusText) {
  const list = await loadRequests();
  const target = list.find(r => r.id === reqId);
  if (target) {
    target.status = newStatus;
    target.statusText = newStatusText;
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));
  }

  if (!isOfflineFallback && db) {
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
