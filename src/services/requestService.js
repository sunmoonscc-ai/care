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
  // 1. 현재 로컬 및 DB에 등록된 전체 목록 로드
  const all = await loadRequests();

  // 2. 삭제 대상 필터링: staffId 기반 매칭 (가장 정확한 방법)
  // staffId가 없으면 staffName으로 매칭, 모두 없으면 이메일로 매칭
  const toDelete = all.filter(r => {
    if (r.type !== 'OFF' || !r.date || !r.date.startsWith(monthPrefix)) return false;

    const rStaffId = (r.requesterId || '').trim().toLowerCase();
    const rStaffName = (r.requesterName || '').trim().toLowerCase();
    const rEmail = (r.requesterEmail || '').trim().toLowerCase();

    const inputStaffId = (staffId || '').trim().toLowerCase();
    const inputStaffName = (staffName || '').trim().toLowerCase();
    const inputEmail = newRequestItems.length > 0 ? (newRequestItems[0].requesterEmail || '').trim().toLowerCase() : '';

    // staffId 매칭 (최우선)
    if (inputStaffId && rStaffId === inputStaffId) return true;

    // staffName 매칭
    if (inputStaffName && rStaffName === inputStaffName) return true;

    // 이메일 매칭
    if (inputEmail && rEmail === inputEmail) return true;

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

  // 4. 로컬 캐시 즉시 갱신
  const updatedList = [...preparedNew, ...remaining];
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(updatedList));

  // 5. Firestore 동기화 (로컬 업데이트 후 원격 동기화)
  if (!isOfflineFallback && db) {
    try {
      const q = query(collection(db, 'requests'));
      const snap = await getDocs(q);
      const deletePromises = [];

      const inputStaffId = (staffId || '').trim().toLowerCase();
      const inputStaffName = (staffName || '').trim().toLowerCase();
      const inputEmail = newRequestItems.length > 0 ? (newRequestItems[0].requesterEmail || '').trim().toLowerCase() : '';

      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.type !== 'OFF' || !data.date || !data.date.startsWith(monthPrefix)) return;

        const rStaffId = (data.requesterId || '').trim().toLowerCase();
        const rStaffName = (data.requesterName || '').trim().toLowerCase();
        const rEmail = (data.requesterEmail || '').trim().toLowerCase();

        if ((inputStaffId && rStaffId === inputStaffId) ||
            (inputStaffName && rStaffName === inputStaffName) ||
            (inputEmail && rEmail === inputEmail)) {
          deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)));
        }
      });

      // 삭제 완료 대기
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // 새 건 등록
      if (preparedNew.length > 0) {
        const addPromises = preparedNew.map(item => addDoc(collection(db, 'requests'), item));
        await Promise.all(addPromises);
      }
    } catch (e) {
      console.warn("Firestore replace error:", e);
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
