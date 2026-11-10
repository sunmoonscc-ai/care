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

const STORAGE_KEY_REQUESTS = 'careshift_shift_requests';

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
      const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Firestore requests load error (fallback):", e);
    }
  }

  let localList = [];
  const local = localStorage.getItem(STORAGE_KEY_REQUESTS);
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {}
  }

  // Firestore 데이터와 로컬스토리지 데이터를 ID 및 (신청자+날짜+type) 기준으로 병합
  const combinedMap = new Map();
  // 1) 로컬 데이터 먼저 추가
  localList.forEach(item => {
    if (item && item.id) combinedMap.set(item.id, item);
  });
  // 2) Firestore 최신 데이터로 덮어쓰기/추가
  firestoreList.forEach(item => {
    if (item && item.id) combinedMap.set(item.id, item);
  });

  const merged = Array.from(combinedMap.values());
  if (merged.length > 0) {
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

  if (!isOfflineFallback && db) {
    // UI 지연 방지를 위해 비동기 백그라운드 저장
    addDoc(collection(db, 'requests'), item).catch(e => {
      console.warn("Firestore request add background warning:", e);
    });
  }

  return item;
}

// 특정 직원의 특정 월 기존 희망휴무 신청 건 전체 일괄 삭제/교체
export async function replaceStaffMonthlyOffRequests(staffId, staffName, monthPrefix, newRequestItems = []) {
  // 정규화 헬퍼 함수
  const normalizeString = (s) => (s || '').trim().toLowerCase();
  const normalizePhone = (p) => (p || '').replace(/[^0-9]/g, '');

  // 1. 현재 로컬 및 DB에 등록된 전체 목록 로드
  const all = await loadRequests();

  // 2. 삭제 대상 필터링: 신청자 식별 정보가 일치하고, 해당 월의 모든 OFF 신청 건
  const normalizedStaffId = normalizeString(staffId);
  const normalizedStaffName = normalizeString(staffName);

  const toDelete = all.filter(r => {
    if (r.type !== 'OFF' || !r.date || !r.date.startsWith(monthPrefix)) return false;

    // ID 매칭 (최우선)
    if (r.requesterId && normalizeString(r.requesterId) === normalizedStaffId) return true;

    // 이름 매칭
    if (r.requesterName && normalizeString(r.requesterName) === normalizedStaffName) return true;

    // newRequestItems에 있는 신청자의 이메일/전화번호로 매칭 (이전 신청 제거)
    if (newRequestItems.length > 0) {
      const firstNew = newRequestItems[0];
      if (firstNew.requesterEmail && r.requesterEmail &&
          normalizeString(r.requesterEmail) === normalizeString(firstNew.requesterEmail)) {
        return true;
      }
      if (firstNew.requesterPhone && r.requesterPhone &&
          normalizePhone(r.requesterPhone) === normalizePhone(firstNew.requesterPhone)) {
        return true;
      }
    }

    return false;
  });

  const deleteIds = new Set(toDelete.map(d => d.id));
  const remaining = all.filter(r => !deleteIds.has(r.id));

  // 3. 새 신청 건 생성
  const preparedNew = newRequestItems.map((item, idx) => ({
    id: `req_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
    ...item,
    createdAt: new Date().toLocaleString('ko-KR')
  }));

  // 4. 로컬 캐시 즉시 갱신 (과거 건이 싹 사라지고 새 건만 남음)
  const updatedList = [...preparedNew, ...remaining];
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(updatedList));

  // 5. Firestore 원격 동기화 (원격 DB에서도 이전 건 전부 삭제 및 새 건 등록)
  if (!isOfflineFallback && db) {
    try {
      // Firestore에 남아있을 과거 신청 문서 모두 조회 후 삭제
      const q = query(collection(db, 'requests'));
      const snap = await getDocs(q);
      const deletePromises = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.type !== 'OFF' || !data.date || !data.date.startsWith(monthPrefix)) return;

        // ID 매칭
        if (data.requesterId && normalizeString(data.requesterId) === normalizedStaffId) {
          deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)).catch(() => {}));
          return;
        }

        // 이름 매칭
        if (data.requesterName && normalizeString(data.requesterName) === normalizedStaffName) {
          deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)).catch(() => {}));
          return;
        }

        // 이메일/전화번호 매칭
        if (newRequestItems.length > 0) {
          const firstNew = newRequestItems[0];
          if (firstNew.requesterEmail && data.requesterEmail &&
              normalizeString(data.requesterEmail) === normalizeString(firstNew.requesterEmail)) {
            deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)).catch(() => {}));
            return;
          }
          if (firstNew.requesterPhone && data.requesterPhone &&
              normalizePhone(data.requesterPhone) === normalizePhone(firstNew.requesterPhone)) {
            deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)).catch(() => {}));
          }
        }
      });

      await Promise.all(deletePromises);

      // 새 건 등록
      const addPromises = preparedNew.map(item => addDoc(collection(db, 'requests'), item).catch(() => {}));
      await Promise.all(addPromises);
    } catch (e) {
      console.warn("Firestore replace warning:", e);
    }
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
